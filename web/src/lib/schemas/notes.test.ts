import { describe, it, expect } from 'vitest';
import {
  generateNoteSchema,
  noteIdSchema,
  saveNoteSchema,
  updateNoteSectionsSchema,
  updateSectionStyleSchema,
} from './notes';

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
    expect(result.success).toBe(false);
  });

  it('rejects quickNotes shorter than 10 characters', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, quickNotes: 'short' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.quickNotes?.[0]).toContain('more detail');
    }
  });

  it('rejects quickNotes longer than 5000 characters', () => {
    const result = generateNoteSchema.safeParse({
      ...validInput,
      quickNotes: 'a'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects patientContext longer than 500 characters', () => {
    const result = generateNoteSchema.safeParse({
      ...validInput,
      patientContext: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
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
    expect(result.success).toBe(false);
  });

  it('rejects missing noteType', () => {
    const result = generateNoteSchema.safeParse({ quickNotes: 'some valid notes here' });
    expect(result.success).toBe(false);
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
    expect(result.success).toBe(false);
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
    expect(result.success).toBe(false);
  });

  it('rejects duration above 480', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, duration: '481' });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer duration', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, duration: '45.5' });
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric duration', () => {
    const result = generateNoteSchema.safeParse({ ...validInput, duration: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejects empty string duration with min validation error', () => {
    // Number("") evaluates to 0, which fails .min(1).
    // This documents the behavior that the client MUST prevent by stripping the field
    // when the input is empty — otherwise a blank optional field causes a validation error.
    const result = generateNoteSchema.safeParse({ ...validInput, duration: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.duration).toBeDefined();
    }
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
    expect(result.success).toBe(false);
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
    expect(noteIdSchema.safeParse('not-a-uuid').success).toBe(false);
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
    expect(result.success).toBe(false);
  });

  it('rejects empty content array', () => {
    expect(saveNoteSchema.safeParse({ ...validSave, content: [] }).success).toBe(false);
  });

  it('rejects content over 20 sections', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      sectionId: `00000000-0000-0000-0000-00000000${String(i).padStart(4, '0')}`,
      title: `Section ${i}`,
      content: 'x',
    }));
    expect(saveNoteSchema.safeParse({ ...validSave, content: tooMany }).success).toBe(
      false
    );
  });

  it('rejects section content over 10000 chars', () => {
    const big = {
      ...validSave,
      content: [{ ...validSave.content[0], content: 'a'.repeat(10001) }],
    };
    expect(saveNoteSchema.safeParse(big).success).toBe(false);
  });

  it('rejects invalid templateId (non-UUID)', () => {
    expect(
      saveNoteSchema.safeParse({ ...validSave, templateId: 'bad' }).success
    ).toBe(false);
  });

  it('rejects invalid noteType', () => {
    expect(
      saveNoteSchema.safeParse({
        ...validSave,
        noteType: 'not_a_type' as unknown as 'daily_note',
      }).success
    ).toBe(false);
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
      saveNoteSchema.safeParse({ ...validSave, durationMinutes: 481 }).success
    ).toBe(false);
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
      updateNoteSectionsSchema.safeParse({ ...validUpdate, noteId: 'bad' }).success
    ).toBe(false);
  });

  it('rejects non-ISO expectedUpdatedAt', () => {
    expect(
      updateNoteSectionsSchema.safeParse({
        ...validUpdate,
        expectedUpdatedAt: 'yesterday',
      }).success
    ).toBe(false);
  });

  it('rejects empty sections object', () => {
    expect(
      updateNoteSectionsSchema.safeParse({ ...validUpdate, sections: {} }).success
    ).toBe(false);
  });

  it('rejects section content over 10000 chars', () => {
    expect(
      updateNoteSectionsSchema.safeParse({
        ...validUpdate,
        sections: { '00000000-0000-0000-0000-000000000011': 'a'.repeat(10001) },
      }).success
    ).toBe(false);
  });

  it('rejects sections with non-UUID keys', () => {
    expect(
      updateNoteSectionsSchema.safeParse({
        ...validUpdate,
        sections: { 'not-a-uuid': 'text' },
      }).success
    ).toBe(false);
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
    expect(updateSectionStyleSchema.safeParse({ sectionId }).success).toBe(false);
  });

  it('rejects invalid verbosity', () => {
    expect(
      updateSectionStyleSchema.safeParse({
        sectionId,
        verbosity: 'verbose' as unknown as 'concise',
      }).success
    ).toBe(false);
  });

  it('rejects invalid styling', () => {
    expect(
      updateSectionStyleSchema.safeParse({
        sectionId,
        styling: 'prose' as unknown as 'paragraph',
      }).success
    ).toBe(false);
  });

  it('rejects non-UUID sectionId', () => {
    expect(
      updateSectionStyleSchema.safeParse({ sectionId: 'bad', verbosity: 'concise' })
        .success
    ).toBe(false);
  });
});
