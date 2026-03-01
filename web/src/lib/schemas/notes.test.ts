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
});
