/**
 * Test factories for NoteTemplate / NoteTemplateSection rows and domain objects.
 */
import type {
  NoteTemplate,
  NoteTemplateSection,
  NoteTemplateWithSections,
} from '@/lib/types';
import type {
  NoteTemplateRow,
  NoteTemplateSectionRow,
} from '@/lib/types/database';

const SOAP_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001';
const SUBJECTIVE_ID = '00000000-0000-0000-0000-000000000011';

export function createMockTemplateRow(
  overrides: Partial<NoteTemplateRow> = {}
): NoteTemplateRow {
  return {
    id: SOAP_TEMPLATE_ID,
    user_id: null,
    organization_id: null,
    name: 'SOAP Note',
    is_builtin: true,
    archived_at: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockTemplate(
  overrides: Partial<NoteTemplate> = {}
): NoteTemplate {
  return {
    id: SOAP_TEMPLATE_ID,
    userId: null,
    organizationId: null,
    name: 'SOAP Note',
    isBuiltin: true,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockTemplateSectionRow(
  overrides: Partial<NoteTemplateSectionRow> = {}
): NoteTemplateSectionRow {
  return {
    id: SUBJECTIVE_ID,
    template_id: SOAP_TEMPLATE_ID,
    title: 'Subjective',
    sort_order: 1,
    verbosity: 'concise',
    styling: 'paragraph',
    prompt_instructions: '<placeholder>',
    include_in_copy_all: true,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockTemplateSection(
  overrides: Partial<NoteTemplateSection> = {}
): NoteTemplateSection {
  return {
    id: SUBJECTIVE_ID,
    templateId: SOAP_TEMPLATE_ID,
    title: 'Subjective',
    sortOrder: 1,
    verbosity: 'concise',
    styling: 'paragraph',
    promptInstructions: '<placeholder>',
    includeInCopyAll: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockTemplateWithSections(
  overrides: Partial<NoteTemplateWithSections> = {}
): NoteTemplateWithSections {
  return {
    ...createMockTemplate(),
    sections: [
      createMockTemplateSection(),
      createMockTemplateSection({
        id: '00000000-0000-0000-0000-000000000012',
        title: 'Objective',
        sortOrder: 2,
        verbosity: 'detailed',
      }),
      createMockTemplateSection({
        id: '00000000-0000-0000-0000-000000000013',
        title: 'Assessment',
        sortOrder: 3,
      }),
      createMockTemplateSection({
        id: '00000000-0000-0000-0000-000000000014',
        title: 'Plan',
        sortOrder: 4,
        styling: 'bullets',
      }),
    ],
    ...overrides,
  };
}
