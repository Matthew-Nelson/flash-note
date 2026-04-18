import 'server-only';

import type pg from 'pg';

import { db } from '@/server/db';
import type {
  NoteSection,
  NoteVersion,
  NoteVersionSource,
  NoteVersionWithSection,
  QueryScope,
} from '@/lib/types';
import type {
  NoteVersionRow,
  NoteVersionWithSectionRow,
} from '@/lib/types/database';

/**
 * Data Access Layer for note_versions table.
 *
 * PHI-05 (append-only): this module contains NO UPDATE or DELETE SQL. The DB
 * also enforces immutability via triggers (see 002_phi_storage.sql). The only
 * write paths are createInitialVersions (called on save) and
 * createVersionForSection (called on per-section edit).
 *
 * Reads are scope-enforced by INNER JOINing clinical_notes and filtering on
 * the parent note's user_id / organization_id (Rule 5).
 */

const VERSION_COLUMNS = `id, note_id, section_id, version, content, source, created_by, created_at`;

function rowToNoteVersion(row: NoteVersionRow): NoteVersion {
  return {
    id: row.id,
    noteId: row.note_id,
    sectionId: row.section_id,
    version: row.version,
    content: row.content,
    source: row.source,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function rowToNoteVersionWithSection(
  row: NoteVersionWithSectionRow
): NoteVersionWithSection {
  return {
    ...rowToNoteVersion(row),
    sectionTitle: row.section_title,
  };
}

function scopeWhereClause(
  scope: QueryScope,
  startIdx: number,
  columnPrefix: string
): { sql: string; params: unknown[] } {
  const prefix = columnPrefix ? `${columnPrefix}.` : '';
  if (scope.type === 'user') {
    return {
      sql: `${prefix}user_id = $${startIdx}`,
      params: [scope.userId],
    };
  }
  return {
    sql: `${prefix}organization_id = $${startIdx}`,
    params: [scope.organizationId],
  };
}

/**
 * Bulk-insert one initial version row per section in the generated content.
 * All rows are version=1, source='generated'. Must be called inside the
 * save-note transaction so the INSERT shares atomicity with the clinical_notes
 * row it versions.
 *
 * Uses pg array parameters + unnest() to keep the statement a single INSERT
 * regardless of section count.
 */
export async function createInitialVersions(
  client: pg.PoolClient,
  noteId: string,
  content: NoteSection[],
  userId: string
): Promise<NoteVersion[]> {
  if (content.length === 0) {
    return [];
  }

  const sectionIds = content.map((s) => s.sectionId);
  const contents = content.map((s) => s.content);

  const result = await client.query<NoteVersionRow>(
    `INSERT INTO note_versions (note_id, section_id, version, content, source, created_by)
     SELECT $1::uuid, unnest($2::uuid[]), 1, unnest($3::text[]), 'generated', $4::uuid
     RETURNING ${VERSION_COLUMNS}`,
    [noteId, sectionIds, contents, userId]
  );

  return result.rows.map((r) => rowToNoteVersion(r));
}

/**
 * Insert a new version row for a single section. Version number is computed
 * atomically via a subquery (`SELECT COALESCE(MAX(version), 0) + 1 FROM
 * note_versions WHERE note_id = $1 AND section_id = $2`).
 *
 * A concurrent insert could theoretically compute the same version — the
 * UNIQUE INDEX on (note_id, section_id, version) catches it as a duplicate-key
 * error. The enclosing transaction rolls back; the caller maps to `conflict`.
 */
export async function createVersionForSection(
  client: pg.PoolClient,
  noteId: string,
  sectionId: string,
  content: string,
  source: NoteVersionSource,
  userId: string
): Promise<NoteVersion> {
  const result = await client.query<NoteVersionRow>(
    `INSERT INTO note_versions (note_id, section_id, version, content, source, created_by)
     VALUES (
       $1,
       $2,
       (SELECT COALESCE(MAX(version), 0) + 1 FROM note_versions WHERE note_id = $1 AND section_id = $2),
       $3,
       $4,
       $5
     )
     RETURNING ${VERSION_COLUMNS}`,
    [noteId, sectionId, content, source, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('createVersionForSection: INSERT RETURNING returned no rows');
  }
  return rowToNoteVersion(result.rows[0]);
}

/**
 * All versions for a note, grouped (implicitly by ORDER BY) by section, newest
 * version first per section. Section title is joined in for UI rendering.
 *
 * Scope enforcement: INNER JOINs clinical_notes and filters on cn.user_id /
 * organization_id — a user cannot read version history for a note outside
 * their scope.
 */
export async function findVersionsByNoteId(
  scope: QueryScope,
  noteId: string
): Promise<NoteVersionWithSection[]> {
  const { sql: scopeSql, params: scopeParams } = scopeWhereClause(scope, 1, 'cn');
  const noteIndex = scopeParams.length + 1;
  const result = await db.query<NoteVersionWithSectionRow>(
    `SELECT nv.id, nv.note_id, nv.section_id, nv.version, nv.content, nv.source,
            nv.created_by, nv.created_at,
            nts.title AS section_title
     FROM note_versions nv
     INNER JOIN clinical_notes cn ON cn.id = nv.note_id
     INNER JOIN note_template_sections nts ON nts.id = nv.section_id
     WHERE ${scopeSql} AND nv.note_id = $${noteIndex}
     ORDER BY nv.section_id, nv.version DESC`,
    [...scopeParams, noteId]
  );

  return result.rows.map((r) => rowToNoteVersionWithSection(r));
}

/**
 * Latest version per section for a note (DISTINCT ON section_id, version DESC).
 * Useful for rendering the "current" note content as the composition of the
 * latest version rows — an alternative to reading clinical_notes.content
 * directly.
 */
export async function findLatestVersionsByNoteId(
  scope: QueryScope,
  noteId: string
): Promise<NoteVersionWithSection[]> {
  const { sql: scopeSql, params: scopeParams } = scopeWhereClause(scope, 1, 'cn');
  const noteIndex = scopeParams.length + 1;
  const result = await db.query<NoteVersionWithSectionRow>(
    `SELECT DISTINCT ON (nv.section_id)
            nv.id, nv.note_id, nv.section_id, nv.version, nv.content, nv.source,
            nv.created_by, nv.created_at,
            nts.title AS section_title
     FROM note_versions nv
     INNER JOIN clinical_notes cn ON cn.id = nv.note_id
     INNER JOIN note_template_sections nts ON nts.id = nv.section_id
     WHERE ${scopeSql} AND nv.note_id = $${noteIndex}
     ORDER BY nv.section_id, nv.version DESC`,
    [...scopeParams, noteId]
  );

  return result.rows.map((r) => rowToNoteVersionWithSection(r));
}
