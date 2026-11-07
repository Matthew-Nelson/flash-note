import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import {
  generateNoteSchema,
  noteIdSchema,
  saveNoteSchema,
  updateNoteSectionsSchema,
  updateSectionStyleSchema,
} from './notes';

/** Rejected issues as path/code/message, so a test pins the rule that failed. */
function issues(result: { error?: { issues: z.ZodIssue[] } }) {
  return result.error?.issues.map(({ path, code, message }) => ({
    path: path.join('.'),
    code,
    message,
  }));
}

describe('generateNoteSchema', () => {
  const validInput = {
    noteType: 'daily_note',
    quickNotes: 'pt reports pain 5/10, ROM improving',
  };

  it('accepts valid input with all fields', () => {
    const result = generateNoteSchema.safeParse({
      ...validInput,
      patientContext: '65 y/o female, chronic LBP',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid input without patientContext', () => {
    const result = generateNoteSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('accepts all note types', () => {
    for (const noteType of ['daily_note', 'initial_eval', 'progress_note', 'discharge']) {
      const result = generateNoteSchema.safeParse({ ...validInput, noteType });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid note type', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, noteType: 'invalid' });
    expect(issues(result)).toMatchObject([{ path: 'noteType', code: 'invalid_value' }]);
  });

  it('rejects quickNotes shorter than 10 characters', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, quickNotes: 'short' });
    expect(issues(result)).toMatchObject([
      { path: 'quickNotes', code: 'too_small', message: 'Please provide more detail' },
    ]);
  });

  it('rejects quickNotes longer than 5000 characters', () => {
    const result = generateNoteSchema.safeParse({
      ...validInput,
      quickNotes: 'a'.repeat(5001),
    });
    expect(issues(result)).toMatchObject([{ path: 'quickNotes', code: 'too_big' }]);
  });

  it('rejects patientContext longer than 500 characters', () => {
    const result = generateNoteSchema.safeParse({
      ...validInput,
      patientContext: 'a'.repeat(501),
    });
    expect(issues(result)).toMatchObject([{ path: 'patientContext', code: 'too_big' }]);
  });

  it('accepts empty string patientContext as optional', () => {
    const result = generateNoteSchema.safeParse({
      ...validInput,
      patientContext: '',
    });
    // Empty string is valid — max(500) accepts it, and it's optional
    expect(result.success).toBe(true);
  });

  it('rejects missing quickNotes', () => {
    const result = generateNoteSchema.safeParse({ noteType: 'daily_note' });
    expect(issues(result)).toMatchObject([{ path: 'quickNotes', code: 'invalid_type' }]);
  });

  it('rejects missing noteType', () => {
    const result = generateNoteSchema.safeParse({ quickNotes: 'some valid notes here' });
    expect(issues(result)).toMatchObject([{ path: 'noteType' }]);
  });

  // --- Modality ---

  it('accepts valid modality "in_person"', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, modality: 'in_person' });
    expect(result.success).toBe(true);
  });

  it('accepts valid modality "telehealth"', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, modality: 'telehealth' });
    expect(result.success).toBe(true);
  });

  it('accepts input without modality', () => {
    const result = generateNoteSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.modality).toBeUndefined();
    }
  });

  it('rejects invalid modality', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, modality: 'invalid' });
    expect(issues(result)).toMatchObject([{ path: 'modality', code: 'invalid_value' }]);
  });

  // --- Duration ---

  it('accepts valid duration', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, duration: '45' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.duration).toBe(45);
    }
  });

  it('accepts input without duration', () => {
    const result = generateNoteSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.duration).toBeUndefined();
    }
  });

  it('rejects negative duration', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, duration: '-1' });
    expect(issues(result)).toMatchObject([{ path: 'duration', code: 'too_small' }]);
  });

  it('rejects duration above 480', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, duration: '481' });
    expect(issues(result)).toMatchObject([{ path: 'duration', code: 'too_big' }]);
  });

  it('rejects non-integer duration', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, duration: '45.5' });
    expect(issues(result)).toMatchObject([{ path: 'duration', code: 'invalid_type' }]);
  });

  it('rejects non-numeric duration', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, duration: 'abc' });
    expect(issues(result)).toMatchObject([{ path: 'duration', code: 'invalid_type' }]);
  });

  it('rejects empty string duration with min validation error', () => {
    // Number("") evaluates to 0, which fails .min(1).
    // This documents the behavior that the client MUST prevent by stripping the field
    // when the input is empty — otherwise a blank optional field causes a validation error.
    const result = generateNoteSchema.safeParse({ ...validInput, duration: '' });
    expect(issues(result)).toMatchObject([{ path: 'duration', code: 'too_small' }]);
  });

  // --- Phase 4 extensions (templateId, patientId) ---

  it('accepts optional templateId UUID', () => {
    const result = generateNoteSchema.safeParse({
      ...validInput,
      templateId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID templateId', () => {
    const result = generateNoteSchema.safeParse({
      ...validInput,
      templateId: 'not-a-uuid',
    });
    expect(issues(result)).toMatchObject([{ path: 'templateId', code: 'invalid_format' }]);
  });

  it('accepts optional patientId UUID', () => {
    const result = generateNoteSchema.safeParse({
      ...validInput,
      patientId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null patientId', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, patientId: null });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Phase 4 — noteIdSchema
// ============================================================================

describe('noteIdSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      noteIdSchema.safeParse('123e4567-e89b-12d3-a456-426614174000').success
    ).toBe(true);
  });

  it('rejects non-UUID strings', () => {
    expect(issues(noteIdSchema.safeParse('not-a-uuid'))).toMatchObject([
      { path: '', code: 'invalid_format' },
    ]);
  });
});

// ============================================================================
// Phase 4 — saveNoteSchema (B-3 patientContextSnapshot explicit field)
// ============================================================================

describe('saveNoteSchema', () => {
  const validSave = {
    templateId: '00000000-0000-0000-0000-000000000001',
    noteType: 'daily_note' as const,
    content: [
      {
        sectionId: '00000000-0000-0000-0000-000000000011',
        title: 'Subjective',
        content: 'Patient reports improved ROM.',
      },
    ],
    quickNotes: 'pt c/o knee pain, ROM improving',
  };

  it('accepts minimal valid input', () => {
    expect(saveNoteSchema.safeParse(validSave).success).toBe(true);
  });

  it('B-3: preserves patientContextSnapshot when explicitly provided', () => {
    const result = saveNoteSchema.safeParse({
      ...validSave,
      patientContextSnapshot: 'hx TKA 2024',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.patientContextSnapshot).toBe('hx TKA 2024');
    }
  });

  it('accepts null patientContextSnapshot', () => {
    const result = saveNoteSchema.safeParse({
      ...validSave,
      patientContextSnapshot: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects patientContextSnapshot over 2000 chars', () => {
    const result = saveNoteSchema.safeParse({
      ...validSave,
      patientContextSnapshot: 'a'.repeat(2001),
    });
    expect(issues(result)).toMatchObject([
      { path: 'patientContextSnapshot', code: 'too_big' },
    ]);
  });

  it('rejects empty content array', () => {
    expect(issues(saveNoteSchema.safeParse({ ...validSave, content: [] }))).toMatchObject([
      { path: 'content', code: 'too_small' },
    ]);
  });

  it('rejects content over 20 sections', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      sectionId: `00000000-0000-0000-0000-00000000${String(i).padStart(4, '0')}`,
      title: `Section ${i}`,
      content: 'x',
    }));
    expect(issues(saveNoteSchema.safeParse({ ...validSave, content: tooMany }))).toMatchObject([
      { path: 'content', code: 'too_big' },
    ]);
  });

  it('rejects section content over 10000 chars', () => {
    const big = {
      ...validSave,
      content: [{ ...validSave.content[0], content: 'a'.repeat(10001) }],
    };
    expect(issues(saveNoteSchema.safeParse(big))).toMatchObject([
      { path: 'content.0.content', code: 'too_big' },
    ]);
  });

  it('rejects invalid templateId (non-UUID)', () => {
    expect(
      issues(saveNoteSchema.safeParse({ ...validSave, templateId: 'bad' }))
    ).toMatchObject([{ path: 'templateId', code: 'invalid_format' }]);
  });

  it('rejects invalid noteType', () => {
    expect(
      issues(saveNoteSchema.safeParse({
        ...validSave,
        noteType: 'not_a_type' as unknown as 'daily_note',
      }))
    ).toMatchObject([{ path: 'noteType', code: 'invalid_value' }]);
  });

  it('accepts valid modality and durationMinutes', () => {
    const result = saveNoteSchema.safeParse({
      ...validSave,
      modality: 'telehealth',
      durationMinutes: 45,
    });
    expect(result.success).toBe(true);
  });

  it('rejects durationMinutes over 480', () => {
    expect(
      issues(saveNoteSchema.safeParse({ ...validSave, durationMinutes: 481 }))
    ).toMatchObject([{ path: 'durationMinutes', code: 'too_big' }]);
  });
});

// ============================================================================
// Phase 4 — updateNoteSectionsSchema
// ============================================================================

describe('updateNoteSectionsSchema', () => {
  const validUpdate = {
    noteId: '00000000-0000-0000-0000-000000000001',
    expectedUpdatedAt: '2026-04-18T20:00:00.000Z',
    sections: {
      '00000000-0000-0000-0000-000000000011': 'new subjective text',
    },
  };

  it('accepts a valid update', () => {
    expect(updateNoteSectionsSchema.safeParse(validUpdate).success).toBe(true);
  });

  it('rejects non-UUID noteId', () => {
    expect(
      issues(updateNoteSectionsSchema.safeParse({ ...validUpdate, noteId: 'bad' }))
    ).toMatchObject([{ path: 'noteId', code: 'invalid_format' }]);
  });

  it('rejects non-ISO expectedUpdatedAt', () => {
    expect(
      issues(updateNoteSectionsSchema.safeParse({
        ...validUpdate,
        expectedUpdatedAt: 'yesterday',
      }))
    ).toMatchObject([{ path: 'expectedUpdatedAt', code: 'invalid_format' }]);
  });

  it('rejects empty sections object', () => {
    expect(
      issues(updateNoteSectionsSchema.safeParse({ ...validUpdate, sections: {} }))
    ).toMatchObject([
      { path: 'sections', code: 'custom', message: 'At least one section must be provided' },
    ]);
  });

  it('rejects section content over 10000 chars', () => {
    expect(
      issues(updateNoteSectionsSchema.safeParse({
        ...validUpdate,
        sections: { '00000000-0000-0000-0000-000000000011': 'a'.repeat(10001) },
      }))
    ).toMatchObject([
      { path: 'sections.00000000-0000-0000-0000-000000000011', code: 'too_big' },
    ]);
  });

  it('rejects sections with non-UUID keys', () => {
    expect(
      issues(updateNoteSectionsSchema.safeParse({
        ...validUpdate,
        sections: { 'not-a-uuid': 'text' },
      }))
    ).toMatchObject([{ path: 'sections.not-a-uuid', code: 'invalid_key' }]);
  });
});

// ============================================================================
// Phase 4 — updateSectionStyleSchema
// ============================================================================

describe('updateSectionStyleSchema', () => {
  const sectionId = '00000000-0000-0000-0000-000000000011';

  it('accepts verbosity-only update', () => {
    expect(
      updateSectionStyleSchema.safeParse({ sectionId, verbosity: 'detailed' }).success
    ).toBe(true);
  });

  it('accepts styling-only update', () => {
    expect(
      updateSectionStyleSchema.safeParse({ sectionId, styling: 'bullets' }).success
    ).toBe(true);
  });

  it('accepts both verbosity and styling', () => {
    expect(
      updateSectionStyleSchema.safeParse({
        sectionId,
        verbosity: 'concise',
        styling: 'paragraph',
      }).success
    ).toBe(true);
  });

  it('rejects when neither verbosity nor styling is provided', () => {
    expect(issues(updateSectionStyleSchema.safeParse({ sectionId }))).toMatchObject([
      { path: '', code: 'custom', message: 'At least one of verbosity or styling is required' },
    ]);
  });

  it('rejects invalid verbosity', () => {
    expect(
      issues(updateSectionStyleSchema.safeParse({
        sectionId,
        verbosity: 'verbose' as unknown as 'concise',
      }))
    ).toMatchObject([{ path: 'verbosity', code: 'invalid_value' }]);
  });

  it('rejects invalid styling', () => {
    expect(
      issues(updateSectionStyleSchema.safeParse({
        sectionId,
        styling: 'prose' as unknown as 'paragraph',
      }))
    ).toMatchObject([{ path: 'styling', code: 'invalid_value' }]);
  });

  it('rejects non-UUID sectionId', () => {
    expect(
      issues(updateSectionStyleSchema.safeParse({ sectionId: 'bad', verbosity: 'concise' }))
    ).toMatchObject([{ path: 'sectionId', code: 'invalid_format' }]);
  });
});

// The default SOAP template and its sections are seeded with fixed IDs
// (migrations 002 and 003) that are not RFC 9562 UUIDs: the version and variant
// nibbles are 0. Every schema that accepts a template or section ID must keep
// accepting them, or notes on the default template cannot be generated, saved,
// or edited.
describe('seeded default template IDs', () => {
  const templateId = '00000000-0000-0000-0000-000000000001';
  const sectionIds = [
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000014',
  ];

  it('generateNoteSchema accepts the default templateId', () => {
    expect(
      generateNoteSchema.safeParse({
        noteType: 'daily_note',
        quickNotes: 'pt reports pain 5/10, ROM improving',
        templateId,
      }).success
    ).toBe(true);
  });

  it('saveNoteSchema accepts the default templateId and every seeded sectionId', () => {
    const result = saveNoteSchema.safeParse({
      templateId,
      noteType: 'daily_note',
      content: sectionIds.map((sectionId) => ({ sectionId, title: 'Section', content: 'x' })),
      quickNotes: 'pt c/o knee pain, ROM improving',
    });
    expect(result.success).toBe(true);
  });

  it('updateNoteSectionsSchema accepts seeded sectionIds as record keys', () => {
    const result = updateNoteSectionsSchema.safeParse({
      noteId: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e',
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
      sections: Object.fromEntries(sectionIds.map((id) => [id, 'updated'])),
    });
    expect(result.success).toBe(true);
  });

  it('updateSectionStyleSchema accepts every seeded sectionId', () => {
    for (const sectionId of sectionIds) {
      expect(
        updateSectionStyleSchema.safeParse({ sectionId, verbosity: 'concise' }).success
      ).toBe(true);
    }
  });
});
