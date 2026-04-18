/**
 * Test factories for ClinicalNote rows and domain objects.
 */
import type { ClinicalNote, NoteSection, NoteType } from '@/lib/types';
import type { ClinicalNoteRow } from '@/lib/types/database';

const DEFAULT_NOTE_ID = '00000000-0000-0000-0000-0000000cdcde';
const DEFAULT_USER_ID = '00000000-0000-0000-0000-00000000aaaa';
const DEFAULT_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001';
const SUBJECTIVE_SECTION_ID = '00000000-0000-0000-0000-000000000011';

export function createMockNoteSection(
  overrides: Partial<NoteSection> = {}
): NoteSection {
  return {
    sectionId: SUBJECTIVE_SECTION_ID,
    title: 'Subjective',
    content: 'Patient reports ROM improving.',
    ...overrides,
  };
}

export function createMockNoteRow(
  overrides: Partial<ClinicalNoteRow> = {}
): ClinicalNoteRow {
  return {
    id: DEFAULT_NOTE_ID,
    user_id: DEFAULT_USER_ID,
    organization_id: null,
    patient_id: null,
    template_id: DEFAULT_TEMPLATE_ID,
    note_type: 'daily_note',
    content: [createMockNoteSection()],
    quick_notes: 'pt c/o knee pain, ROM 100 deg',
    patient_context: null,
    modality: null,
    duration_minutes: null,
    generation_time_ms: null,
    archived_at: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockNote(
  overrides: Partial<ClinicalNote> = {}
): ClinicalNote {
  return {
    id: DEFAULT_NOTE_ID,
    userId: DEFAULT_USER_ID,
    organizationId: null,
    patientId: null,
    templateId: DEFAULT_TEMPLATE_ID,
    noteType: 'daily_note' as NoteType,
    content: [createMockNoteSection()],
    quickNotes: 'pt c/o knee pain, ROM 100 deg',
    patientContext: null,
    modality: null,
    durationMinutes: null,
    generationTimeMs: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}
