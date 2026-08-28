import 'server-only';

import type pg from 'pg';
import { z } from 'zod';

import { db } from '@/server/db';
import type {
  ClinicalNote,
  ClinicalNoteWithPatient,
  NoteSection,
  NoteType,
  QueryScope,
} from '@/lib/types';
import type {
  ClinicalNoteRow,
  ClinicalNoteWithPatientRow,
} from '@/lib/types/database';

/**
 * Data Access Layer for clinical_notes table.
 *
 * Rule 5 boundary: every read/write is scope-filtered. Create and update
 * require a transactional PoolClient — they only ever run inside the
 * save-note / update-note transactions (Rule 1 + Rule 9).
 *
 * Rule 3: clinical_notes.content is JSONB. pg returns it as `unknown`; the
 * row mapper Zod-parses it into NoteSection[] so any hand-written DB content
 * that doesn't match the schema fails loudly on read.
 */

const CLINICAL_NOTE_COLUMNS = `id, user_id, organization_id, patient_id, template_id,
                               note_type, content, quick_notes, patient_context,
                               modality, duration_minutes, generation_time_ms,
                               archived_at, created_at, updated_at`;

// Rule 3: runtime-validate JSONB content shape on read.
const NoteSectionSchema = z.object({
  sectionId: z.string().uuid(),
  title: z.string(),
  content: z.string(),
});
export const NoteContentSchema = z.array(NoteSectionSchema);

const noteTypeSchema = z.enum([
  'daily_note',
  'initial_eval',
  'progress_note',
  'discharge',
]);
const modalitySchema = z.enum(['in_person', 'telehealth']);

function rowToClinicalNote(row: ClinicalNoteRow): ClinicalNote {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    patientId: row.patient_id,
    templateId: row.template_id,
    noteType: noteTypeSchema.parse(row.note_type) as NoteType,
    content: NoteContentSchema.parse(row.content),
    quickNotes: row.quick_notes,
    patientContext: row.patient_context,
    modality:
      row.modality === null ? null : modalitySchema.parse(row.modality),
    durationMinutes: row.duration_minutes,
    generationTimeMs: row.generation_time_ms,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToClinicalNoteWithPatient(
  row: ClinicalNoteWithPatientRow
): ClinicalNoteWithPatient {
  return {
    ...rowToClinicalNote(row),
    patientFirstName: row.patient_first_name,
    patientLastName: row.patient_last_name,
  };
}

function scopeWhereClause(
  scope: QueryScope,
  startIdx: number,
  columnPrefix = ''
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

export interface CreateClinicalNoteInput {
  patientId?: string | null;
  templateId: string;
  noteType: NoteType;
  content: NoteSection[];
  quickNotes: string;
  patientContext?: string | null;
  modality?: 'in_person' | 'telehealth' | null;
  durationMinutes?: number | null;
  generationTimeMs?: number | null;
}

/**
 * Insert a clinical_notes row. Always called inside the save-note transaction
 * (see Research §5.5) — callers must provide a PoolClient.
 */
export async function createClinicalNote(
  client: pg.PoolClient,
  scope: { userId: string; organizationId: string | null },
  input: CreateClinicalNoteInput
): Promise<ClinicalNote> {
  const result = await client.query<ClinicalNoteRow>(
    `INSERT INTO clinical_notes
       (user_id, organization_id, patient_id, template_id, note_type,
        content, quick_notes, patient_context, modality, duration_minutes, generation_time_ms)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
     RETURNING ${CLINICAL_NOTE_COLUMNS}`,
    [
      scope.userId,
      scope.organizationId ?? null,
      input.patientId ?? null,
      input.templateId,
      input.noteType,
      JSON.stringify(input.content),
      input.quickNotes,
      input.patientContext ?? null,
      input.modality ?? null,
      input.durationMinutes ?? null,
      input.generationTimeMs ?? null,
    ]
  );

  if (result.rows.length === 0) {
    throw new Error('createClinicalNote: INSERT RETURNING returned no rows');
  }
  return rowToClinicalNote(result.rows[0]);
}

/**
 * Fetch a single note by ID within scope, LEFT JOINing patients to hydrate
 * patient_first_name / patient_last_name for detail-page rendering.
 *
 * Returns null if the note does not exist, is archived, or is out-of-scope.
 */
export async function findClinicalNoteById(
  scope: QueryScope,
  noteId: string
): Promise<ClinicalNoteWithPatient | null> {
  const { sql: scopeSql, params: scopeParams } = scopeWhereClause(scope, 1, 'cn');
  const idIndex = scopeParams.length + 1;
  const result = await db.query<ClinicalNoteWithPatientRow>(
    `SELECT cn.id, cn.user_id, cn.organization_id, cn.patient_id, cn.template_id,
            cn.note_type, cn.content, cn.quick_notes, cn.patient_context,
            cn.modality, cn.duration_minutes, cn.generation_time_ms,
            cn.archived_at, cn.created_at, cn.updated_at,
            p.first_name AS patient_first_name, p.last_name AS patient_last_name
     FROM clinical_notes cn
     LEFT JOIN patients p ON p.id = cn.patient_id
     WHERE ${scopeSql} AND cn.id = $${idIndex} AND cn.archived_at IS NULL`,
    [...scopeParams, noteId]
  );

  if (result.rows.length === 0) return null;
  return rowToClinicalNoteWithPatient(result.rows[0]);
}

export interface FindClinicalNotesByScopeInput {
  patientId?: string;
  noteType?: NoteType;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface FindClinicalNotesByScopeResult {
  notes: ClinicalNoteWithPatient[];
  total: number;
}

/**
 * List notes within scope, optionally filtered by patient, note type, and/or a
 * free-text search term, paginated and sorted newest-first. LEFT JOINs patients
 * for denormalized names.
 *
 * Search strategy: ILIKE against `quick_notes` and the JSONB `content` rendered
 * as text, so a term matches either the therapist's shorthand or the generated
 * SOAP sections. Mirrors `findPatientsByScope` — LIKE metacharacters (% and _)
 * and the escape character itself are escaped before the term is wrapped in
 * `%...%`, so user input cannot smuggle in wildcards.
 *
 * The search predicate is applied to BOTH the count and the list query so
 * `total` (and therefore the page count) reflects the filtered result set.
 */
export async function findClinicalNotesByScope(
  scope: QueryScope,
  filters: FindClinicalNotesByScopeInput = {}
): Promise<FindClinicalNotesByScopeResult> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);

  const { sql: scopeSql, params: scopeParams } = scopeWhereClause(scope, 1, 'cn');
  const paramList: unknown[] = [...scopeParams];
  let filterClause = '';

  if (filters.patientId) {
    paramList.push(filters.patientId);
    filterClause += ` AND cn.patient_id = $${paramList.length}`;
  }
  if (filters.noteType) {
    paramList.push(filters.noteType);
    filterClause += ` AND cn.note_type = $${paramList.length}`;
  }
  if (filters.search && filters.search.trim().length > 0) {
    // Escape LIKE metacharacters (% and _) and the escape char (\) itself.
    const safe = filters.search.trim().replace(/[\\%_]/g, '\\$&');
    paramList.push(`%${safe}%`);
    const idx = paramList.length;
    filterClause += ` AND (cn.quick_notes ILIKE $${idx} OR cn.content::text ILIKE $${idx})`;
  }

  const countResult = await db.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM clinical_notes cn
     WHERE ${scopeSql} AND cn.archived_at IS NULL${filterClause}`,
    paramList
  );
  const total = countResult.rows[0]?.total ?? 0;

  paramList.push(limit, offset);
  const listResult = await db.query<ClinicalNoteWithPatientRow>(
    `SELECT cn.id, cn.user_id, cn.organization_id, cn.patient_id, cn.template_id,
            cn.note_type, cn.content, cn.quick_notes, cn.patient_context,
            cn.modality, cn.duration_minutes, cn.generation_time_ms,
            cn.archived_at, cn.created_at, cn.updated_at,
            p.first_name AS patient_first_name, p.last_name AS patient_last_name
     FROM clinical_notes cn
     LEFT JOIN patients p ON p.id = cn.patient_id
     WHERE ${scopeSql} AND cn.archived_at IS NULL${filterClause}
     ORDER BY cn.created_at DESC
     LIMIT $${paramList.length - 1} OFFSET $${paramList.length}`,
    paramList
  );

  return {
    notes: listResult.rows.map((r) => rowToClinicalNoteWithPatient(r)),
    total,
  };
}

/**
 * Update note content with optimistic locking on `updated_at`.
 *
 * Returns null when the UPDATE affected 0 rows — ambiguous between "note not
 * found / out of scope / archived" and "optimistic lock failed". Caller maps
 * both to the `conflict` error code (Research §3.3, §5.5 minor refinement).
 *
 * Must be called inside the update-note transaction so the subsequent
 * note_versions INSERTs see the same snapshot.
 */
export async function updateClinicalNoteContent(
  client: pg.PoolClient,
  scope: QueryScope,
  noteId: string,
  content: NoteSection[],
  expectedUpdatedAt: Date | string
): Promise<ClinicalNote | null> {
  const { sql: scopeSql, params: scopeParams } = scopeWhereClause(scope, 2);
  const params: unknown[] = [JSON.stringify(content), ...scopeParams];
  const idIndex = params.length + 1;
  params.push(noteId);
  const lockIndex = params.length + 1;
  params.push(expectedUpdatedAt);

  const result = await client.query<ClinicalNoteRow>(
    `UPDATE clinical_notes SET content = $1::jsonb, updated_at = NOW()
     WHERE ${scopeSql}
       AND id = $${idIndex}
       AND updated_at = $${lockIndex}
       AND archived_at IS NULL
     RETURNING ${CLINICAL_NOTE_COLUMNS}`,
    params
  );

  if (result.rows.length === 0) return null;
  return rowToClinicalNote(result.rows[0]);
}

/**
 * Soft-delete a note within scope. Returns true if a row was archived.
 */
export async function archiveClinicalNote(
  scope: QueryScope,
  noteId: string
): Promise<boolean> {
  const { sql: scopeSql, params: scopeParams } = scopeWhereClause(scope, 1);
  const idIndex = scopeParams.length + 1;
  const result = await db.query<{ id: string }>(
    `UPDATE clinical_notes SET archived_at = NOW()
     WHERE ${scopeSql} AND id = $${idIndex} AND archived_at IS NULL
     RETURNING id`,
    [...scopeParams, noteId]
  );
  return result.rows.length > 0;
}
