import { describe, it, expect } from 'vitest';
import { formatPhoneDisplay, formatPhoneInput } from './phone';

describe('formatPhoneDisplay', () => {
  it('returns empty string for null', () => {
    expect(formatPhoneDisplay(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatPhoneDisplay(undefined)).toBe('');
  });

  it('returns empty string for an empty string', () => {
    expect(formatPhoneDisplay('')).toBe('');
  });

  it('returns empty string for whitespace-only', () => {
    expect(formatPhoneDisplay('   ')).toBe('');
  });

  it('formats 10 digits as (XXX) XXX-XXXX', () => {
    expect(formatPhoneDisplay('5551234567')).toBe('(555) 123-4567');
  });

  it('formats 10 digits when the input already had punctuation', () => {
    expect(formatPhoneDisplay('(555) 123-4567')).toBe('(555) 123-4567');
    expect(formatPhoneDisplay('555.123.4567')).toBe('(555) 123-4567');
    expect(formatPhoneDisplay('555-123-4567')).toBe('(555) 123-4567');
  });

  it('formats 11 digits with leading 1 as 1 (XXX) XXX-XXXX', () => {
    expect(formatPhoneDisplay('15551234567')).toBe('1 (555) 123-4567');
  });

  it('formats 7 digits as XXX-XXXX (local number)', () => {
    expect(formatPhoneDisplay('5551234')).toBe('555-1234');
  });

  it('formats 7-digit input with punctuation as XXX-XXXX', () => {
    expect(formatPhoneDisplay('555-1234')).toBe('555-1234');
    expect(formatPhoneDisplay('555.1234')).toBe('555-1234');
  });

  it('returns non-standard-length digits verbatim', () => {
    expect(formatPhoneDisplay('123')).toBe('123');
    expect(formatPhoneDisplay('12345')).toBe('12345');
  });

  it('returns international-format input verbatim', () => {
    expect(formatPhoneDisplay('+44 20 7946 0958')).toBe('+44 20 7946 0958');
  });

  it('returns extension-style input verbatim (preserves "x" and "ext")', () => {
    // Letters-bearing input is preserved verbatim to avoid silent loss of
    // extension context.
    expect(formatPhoneDisplay('555-0100 x123')).toBe('555-0100 x123');
    expect(formatPhoneDisplay('555-0100 ext 123')).toBe('555-0100 ext 123');
  });

  it('returns raw whitespace-trimmed input for unknown shapes', () => {
    expect(formatPhoneDisplay('call me')).toBe('call me');
  });

  it('is pure — does not mutate input reference', () => {
    const input = '5551234567';
    formatPhoneDisplay(input);
    expect(input).toBe('5551234567');
  });
});

describe('formatPhoneInput', () => {
  it('returns empty string for empty input', () => {
    expect(formatPhoneInput('')).toBe('');
  });

  it('progressively formats 1-3 digits without punctuation', () => {
    expect(formatPhoneInput('5')).toBe('5');
    expect(formatPhoneInput('55')).toBe('55');
    expect(formatPhoneInput('555')).toBe('555');
  });

  it('adds a dash once the user has typed the 4th digit', () => {
    expect(formatPhoneInput('5551')).toBe('555-1');
    expect(formatPhoneInput('55512')).toBe('555-12');
    expect(formatPhoneInput('5551234')).toBe('555-1234');
  });

  it('switches to (XXX) XXX-XXXX formatting at the 8th digit', () => {
    expect(formatPhoneInput('55512345')).toBe('(555) 123-45');
    expect(formatPhoneInput('555123456')).toBe('(555) 123-456');
    expect(formatPhoneInput('5551234567')).toBe('(555) 123-4567');
  });

  it('formats 11-digit US numbers as 1 (XXX) XXX-XXXX', () => {
    expect(formatPhoneInput('15551234567')).toBe('1 (555) 123-4567');
  });

  it('caps at 10 digits for non-1-prefixed input (ignores overflow)', () => {
    // Extra digits beyond 10 are discarded.
    expect(formatPhoneInput('55512345678')).toBe('(555) 123-4567');
  });

  it('caps at 11 digits for 1-prefixed input', () => {
    expect(formatPhoneInput('155512345678')).toBe('1 (555) 123-4567');
  });

  it('ignores existing punctuation in input (re-derives from digits)', () => {
    expect(formatPhoneInput('(555) 123-4567')).toBe('(555) 123-4567');
    expect(formatPhoneInput('555.123.4567')).toBe('(555) 123-4567');
  });

  it('preserves international input (leading +) verbatim', () => {
    expect(formatPhoneInput('+44 20 7946 0958')).toBe('+44 20 7946 0958');
  });

  it('preserves input with letters verbatim (extensions etc.)', () => {
    expect(formatPhoneInput('555-0100 ext 123')).toBe('555-0100 ext 123');
    expect(formatPhoneInput('555-0100 x123')).toBe('555-0100 x123');
  });

  it('is idempotent on already-formatted output', () => {
    const input = '(555) 123-4567';
    expect(formatPhoneInput(input)).toBe(input);
    expect(formatPhoneInput(formatPhoneInput(input))).toBe(input);
  });

  it('never returns "undefined" or null', () => {
    expect(typeof formatPhoneInput('')).toBe('string');
    expect(typeof formatPhoneInput('5')).toBe('string');
    expect(typeof formatPhoneInput('5551234567')).toBe('string');
  });
});
