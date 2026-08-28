import { z } from 'zod';

import { searchListParamsSchema, singleParam } from './list-params';

/**
 * Note Zod schemas — Rule 3 boundary for Server Actions that generate,
 * save, and update clinical notes.
 *
 * Phase 4 extends generateNoteSchema with `templateId` + optional `patientId`
 * (both UUIDs). New schemas: saveNoteSchema, updateNoteSectionsSchema,
 * updateSectionStyleSchema, noteIdSchema.
 */

export const generateNoteSchema = z.object({
  noteType: z.enum(['daily_note', 'initial_eval', 'progress_note', 'discharge']),
  modality: z.enum(['in_person', 'telehealth']).optional(),
  duration: z.coerce.number().int().min(1).max(480).optional(),
  patientContext: z.string().trim().max(500).optional(),
  quickNotes: z.string().trim().min(10, 'Please provide more detail').max(5000),
  // Phase 4 additions — required for template-driven generation (Plan 04-03).
  // Made optional in the schema so existing callers don't break; Plan 04-03
  // will make templateId required once the generation path is cut over.
  templateId: z.string().uuid().optional(),
  patientId: z.string().uuid().nullable().optional(),
});

export type GenerateNoteInput = z.infer<typeof generateNoteSchema>;
export type Modality = z.infer<typeof generateNoteSchema>['modality'];

/**
 * noteIdSchema — URL param validation for /dashboard/notes/[id] routes.
 */
export const noteIdSchema = z.string().uuid();

/**
 * A single section in the saved note content JSONB array.
 * sectionId references note_template_sections.id.
 * title is a denormalized snapshot captured at save time.
 */
const noteSectionSchema = z.object({
  sectionId: z.string().uuid(),
  title: z.string().min(1).max(100),
  content: z.string().max(10000),
});

/**
 * saveNoteSchema — accepted by saveNoteAction (Plan 04-03).
 *
 * B-3: `patientContextSnapshot` is explicitly declared. Without this field
 * Zod strict-mode strips the key on parse and saveNoteAction can't persist
 * the context snapshot captured at generation time.
 */
export const saveNoteSchema = z.object({
  templateId: z.string().uuid(),
  patientId: z.string().uuid().nullable().optional(),
  noteType: z.enum(['daily_note', 'initial_eval', 'progress_note', 'discharge']),
  content: z.array(noteSectionSchema).min(1).max(20),
  quickNotes: z.string().trim().min(10).max(5000),
  patientContextSnapshot: z.string().max(2000).nullable().optional(),
  modality: z.enum(['in_person', 'telehealth']).nullable().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(480).nullable().optional(),
  generationTimeMs: z.coerce.number().int().min(0).nullable().optional(),
});

export type SaveNoteInput = z.infer<typeof saveNoteSchema>;

/**
 * updateNoteSectionsSchema — accepted by updateNoteSectionsAction.
 *
 * `expectedUpdatedAt` is the optimistic-lock token — the client reads
 * `note.updatedAt` from the Server Component and round-trips the ISO string
 * back; the DAL compares to clinical_notes.updated_at in the WHERE clause.
 *
 * `sections` is a sparse Record<sectionId, newContent> — only edited sections
 * appear. At least one section must be present.
 */
export const updateNoteSectionsSchema = z.object({
  noteId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime(),
  sections: z
    .record(z.string().uuid(), z.string().max(10000))
    .refine(
      (v) => Object.keys(v).length > 0,
      'At least one section must be provided'
    ),
});

export type UpdateNoteSectionsInput = z.infer<typeof updateNoteSectionsSchema>;

/**
 * updateSectionStyleSchema — per-user style preferences overlay.
 * At least one of verbosity/styling must be present.
 */
export const updateSectionStyleSchema = z
  .object({
    sectionId: z.string().uuid(),
    verbosity: z.enum(['concise', 'detailed']).optional(),
    styling: z.enum(['paragraph', 'bullets']).optional(),
  })
  .refine(
    (v) => v.verbosity !== undefined || v.styling !== undefined,
    'At least one of verbosity or styling is required'
  );

export type UpdateSectionStyleInput = z.infer<typeof updateSectionStyleSchema>;

/**
 * notesListParamsSchema — Rule 3 boundary for the /dashboard/notes URL.
 *
 * Extends the shared `q` + `page` shape with the two notes-specific filters.
 * See list-params.ts for why every field is array-normalized and degrades to a
 * default rather than throwing.
 */
export const notesListParamsSchema = searchListParamsSchema.extend({
  noteType: singleParam(
    z.enum(['daily_note', 'initial_eval', 'progress_note', 'discharge'])
  )
    .optional()
    .catch(undefined),
  patientId: singleParam(z.string().uuid()).optional().catch(undefined),
});

export type NotesListParams = z.infer<typeof notesListParamsSchema>;
