import { describe, it, expect } from 'vitest';
import { generateNoteSchema } from './notes';

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
});
