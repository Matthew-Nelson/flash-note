import 'server-only';

import { db } from '@/server/db';
import type {
  NoteTemplate,
  NoteTemplateSection,
  NoteTemplateWithSections,
  QueryScope,
  Styling,
  Verbosity,
} from '@/lib/types';
import type {
  NoteTemplateRow,
  NoteTemplateSectionRow,
} from '@/lib/types/database';

/**
 * Data Access Layer for note_templates + note_template_sections.
 *
 * Read-only in Plan 04-01. Templates are either built-in (user_id IS NULL,
 * is_builtin = TRUE — shared by everyone) or user-owned (user_id set). Plan
 * 04-02/03 introduces user-owned template CRUD; Plan 04-01 only ships the
 * read paths needed for note generation.
 *
 * findTemplateWithUserStyle overlays per-user verbosity/styling preferences
 * via LEFT JOIN + COALESCE (user preference wins, falls back to template
 * default) — see Research §6.2 Option A.
 */

const TEMPLATE_COLUMNS = `id, user_id, organization_id, name, is_builtin,
                          archived_at, created_at, updated_at`;
const SECTION_COLUMNS = `id, template_id, title, sort_order, verbosity, styling,
                         prompt_instructions, include_in_copy_all, created_at, updated_at`;

function rowToTemplate(row: NoteTemplateRow): NoteTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    name: row.name,
    isBuiltin: row.is_builtin,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTemplateSection(row: NoteTemplateSectionRow): NoteTemplateSection {
  return {
    id: row.id,
    templateId: row.template_id,
    title: row.title,
    sortOrder: row.sort_order,
    verbosity: row.verbosity,
    styling: row.styling,
    promptInstructions: row.prompt_instructions,
    includeInCopyAll: row.include_in_copy_all,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetch all built-in templates with their sections (sections sorted by
 * sort_order ASC). Built-in templates have user_id IS NULL and is_builtin = TRUE.
 */
export async function findBuiltinTemplates(): Promise<NoteTemplateWithSections[]> {
  const templatesResult = await db.query<NoteTemplateRow>(
    `SELECT ${TEMPLATE_COLUMNS} FROM note_templates
     WHERE is_builtin = TRUE AND archived_at IS NULL
     ORDER BY created_at`
  );
  if (templatesResult.rows.length === 0) return [];

  const templateIds = templatesResult.rows.map((r) => r.id);
  const sectionsResult = await db.query<NoteTemplateSectionRow>(
    `SELECT ${SECTION_COLUMNS} FROM note_template_sections
     WHERE template_id = ANY($1::uuid[])
     ORDER BY sort_order`,
    [templateIds]
  );

  const sectionsByTemplateId = new Map<string, NoteTemplateSection[]>();
  for (const row of sectionsResult.rows) {
    const list = sectionsByTemplateId.get(row.template_id) ?? [];
    list.push(rowToTemplateSection(row));
    sectionsByTemplateId.set(row.template_id, list);
  }

  return templatesResult.rows.map((r) => ({
    ...rowToTemplate(r),
    sections: sectionsByTemplateId.get(r.id) ?? [],
  }));
}

/**
 * Fetch a single template by ID with its sections, regardless of ownership.
 * Callers that need authorization should use findTemplatesByScope() first.
 *
 * Returns null if the template does not exist or is archived.
 */
export async function findTemplateById(
  templateId: string
): Promise<NoteTemplateWithSections | null> {
  const templateResult = await db.query<NoteTemplateRow>(
    `SELECT ${TEMPLATE_COLUMNS} FROM note_templates
     WHERE id = $1 AND archived_at IS NULL`,
    [templateId]
  );
  if (templateResult.rows.length === 0) return null;

  const sectionsResult = await db.query<NoteTemplateSectionRow>(
    `SELECT ${SECTION_COLUMNS} FROM note_template_sections
     WHERE template_id = $1
     ORDER BY sort_order`,
    [templateId]
  );

  return {
    ...rowToTemplate(templateResult.rows[0]),
    sections: sectionsResult.rows.map((r) => rowToTemplateSection(r)),
  };
}

/**
 * List templates visible within scope: built-in templates plus the caller's
 * own / their org's custom templates. Sections are not hydrated by this query
 * (callers that need sections should call findTemplateById).
 */
export async function findTemplatesByScope(
  scope: QueryScope
): Promise<NoteTemplate[]> {
  const scopeClause =
    scope.type === 'user'
      ? `user_id = $1`
      : `organization_id = $1`;
  const scopeValue =
    scope.type === 'user' ? scope.userId : scope.organizationId;

  const result = await db.query<NoteTemplateRow>(
    `SELECT ${TEMPLATE_COLUMNS} FROM note_templates
     WHERE archived_at IS NULL AND (is_builtin = TRUE OR ${scopeClause})
     ORDER BY is_builtin DESC, name`,
    [scopeValue]
  );
  return result.rows.map((r) => rowToTemplate(r));
}

/**
 * Fetch a template with sections, overlaying per-user style preferences.
 *
 * Overlay rule: for each section, if the user has a row in user_style_preferences
 * for that section, their (verbosity, styling) wins; otherwise the section's
 * default (verbosity, styling) is used. LEFT JOIN + COALESCE in SQL.
 */
export async function findTemplateWithUserStyle(
  templateId: string,
  userId: string
): Promise<NoteTemplateWithSections | null> {
  const templateResult = await db.query<NoteTemplateRow>(
    `SELECT ${TEMPLATE_COLUMNS} FROM note_templates
     WHERE id = $1 AND archived_at IS NULL`,
    [templateId]
  );
  if (templateResult.rows.length === 0) return null;

  const sectionsResult = await db.query<NoteTemplateSectionRow>(
    `SELECT
       nts.id, nts.template_id, nts.title, nts.sort_order,
       COALESCE(usp.verbosity, nts.verbosity) AS verbosity,
       COALESCE(usp.styling, nts.styling) AS styling,
       nts.prompt_instructions, nts.include_in_copy_all,
       nts.created_at, nts.updated_at
     FROM note_template_sections nts
     LEFT JOIN user_style_preferences usp
       ON usp.section_id = nts.id AND usp.user_id = $2
     WHERE nts.template_id = $1
     ORDER BY nts.sort_order`,
    [templateId, userId]
  );

  return {
    ...rowToTemplate(templateResult.rows[0]),
    sections: sectionsResult.rows.map((r) => rowToTemplateSection(r)),
  };
}

// Re-exported for DAL consumers that want to check verbosity/styling types
// without importing the domain types directly (keeps DAL usage self-contained).
export type { Verbosity, Styling };
