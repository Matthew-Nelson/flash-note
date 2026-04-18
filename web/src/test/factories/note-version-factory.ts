/**
 * Test factories for NoteVersion rows and domain objects.
 */
import type { NoteVersion, NoteVersionWithSection } from '@/lib/types';
import type {
  NoteVersionRow,
  NoteVersionWithSectionRow,
} from '@/lib/types/database';

const DEFAULT_VERSION_ID = '00000000-0000-0000-0000-0000000c1f01';
const DEFAULT_NOTE_ID = '00000000-0000-0000-0000-0000000cdcde';
const DEFAULT_SECTION_ID = '00000000-0000-0000-0000-000000000011';
const DEFAULT_USER_ID = '00000000-0000-0000-0000-00000000aaaa';

export function createMockVersionRow(
  overrides: Partial<NoteVersionRow> = {}
): NoteVersionRow {
  return {
    id: DEFAULT_VERSION_ID,
    note_id: DEFAULT_NOTE_ID,
    section_id: DEFAULT_SECTION_ID,
    version: 1,
    content: 'Patient reports ROM improving.',
    source: 'generated',
    created_by: DEFAULT_USER_ID,
    created_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockVersion(
  overrides: Partial<NoteVersion> = {}
): NoteVersion {
  return {
    id: DEFAULT_VERSION_ID,
    noteId: DEFAULT_NOTE_ID,
    sectionId: DEFAULT_SECTION_ID,
    version: 1,
    content: 'Patient reports ROM improving.',
    source: 'generated',
    createdBy: DEFAULT_USER_ID,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockVersionWithSectionRow(
  overrides: Partial<NoteVersionWithSectionRow> = {}
): NoteVersionWithSectionRow {
  return {
    ...createMockVersionRow(),
    section_title: 'Subjective',
    ...overrides,
  };
}

export function createMockVersionWithSection(
  overrides: Partial<NoteVersionWithSection> = {}
): NoteVersionWithSection {
  return {
    ...createMockVersion(),
    sectionTitle: 'Subjective',
    ...overrides,
  };
}
