import { describe, it, expect } from 'vitest';
import { sanitizeFieldErrors } from './validation';

describe('sanitizeFieldErrors', () => {
  it('preserves field names but replaces messages with generic text', () => {
    const input = {
      quickNotes: ['Please provide more detail'],
      noteType: ['Invalid enum value'],
    };
    const result = sanitizeFieldErrors(input);

    expect(result).toEqual({
      quickNotes: ['Validation failed'],
      noteType: ['Validation failed'],
    });
  });

  it('handles single field error', () => {
    const input = { quickNotes: ['Please provide more detail'] };
    const result = sanitizeFieldErrors(input);

    expect(result).toEqual({
      quickNotes: ['Validation failed'],
    });
  });

  it('filters to allowlisted fields only', () => {
    const input = {
      quickNotes: ['error'],
      unknownField: ['should be filtered'],
      noteType: ['error'],
    };
    const allowedFields = ['quickNotes', 'noteType'];
    const result = sanitizeFieldErrors(input, allowedFields);

    expect(result).toEqual({
      quickNotes: ['Validation failed'],
      noteType: ['Validation failed'],
    });
    expect(result.unknownField).toBeUndefined();
  });

  it('handles multiple errors on same field (collapses to single message)', () => {
    const input = {
      quickNotes: ['Too short', 'Invalid characters', 'Must be alphanumeric'],
    };
    const result = sanitizeFieldErrors(input);

    expect(result).toEqual({
      quickNotes: ['Validation failed'],
    });
  });

  it('never includes original error messages in output', () => {
    const input = {
      quickNotes: ['Please provide more detail'],
      patientContext: ['Too long'],
    };
    const result = sanitizeFieldErrors(input);
    const output = JSON.stringify(result);

    expect(output).not.toContain('Please provide more detail');
    expect(output).not.toContain('Too long');
  });

  it('returns empty object for empty input', () => {
    const result = sanitizeFieldErrors({});
    expect(result).toEqual({});
  });

  it('handles missing fields from allowlist gracefully', () => {
    const input = {
      quickNotes: ['error'],
    };
    const allowedFields = ['quickNotes', 'patientContext', 'noteType'];
    const result = sanitizeFieldErrors(input, allowedFields);

    // Only quickNotes should be in result
    expect(Object.keys(result)).toEqual(['quickNotes']);
    expect(result.patientContext).toBeUndefined();
  });

  it('handles empty array for a field (does not include field in output)', () => {
    const input = {
      quickNotes: [],
      noteType: ['Invalid enum value'],
    };
    const result = sanitizeFieldErrors(input);

    // quickNotes has empty array — should not appear in sanitized output
    expect(result.quickNotes).toBeUndefined();
    expect(result).toEqual({
      noteType: ['Validation failed'],
    });
  });
});
