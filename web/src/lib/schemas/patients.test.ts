import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import {
  pronounSchema,
  patientIdSchema,
  createPatientSchema,
  updatePatientSchema,
  updatePatientContextSchema,
  patientSearchSchema,
} from './patients';

/** Rejected issues as path/code, so a test pins the rule that failed. */
function issues(result: { error?: { issues: z.ZodIssue[] } }) {
  return result.error?.issues.map(({ path, code }) => ({ path: path.join('.'), code }));
}

describe('pronounSchema', () => {
  it.each(['he/him', 'she/her', 'they/them', 'other'] as const)(
    'accepts valid pronoun "%s"',
    (value) => {
      expect(pronounSchema.safeParse(value).success).toBe(true);
    }
  );

  it('rejects arbitrary free-text pronoun', () => {
    expect(issues(pronounSchema.safeParse('ze/zir'))).toEqual([
      { path: '', code: 'invalid_value' },
    ]);
  });

  it('rejects empty string', () => {
    expect(issues(pronounSchema.safeParse(''))).toEqual([
      { path: '', code: 'invalid_value' },
    ]);
  });
});

describe('patientIdSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      patientIdSchema.safeParse('123e4567-e89b-12d3-a456-426614174000').success
    ).toBe(true);
  });

  it('rejects non-UUID strings', () => {
    expect(issues(patientIdSchema.safeParse('not-a-uuid'))).toEqual([
      { path: '', code: 'invalid_format' },
    ]);
  });
});

describe('createPatientSchema', () => {
  const validInput = {
    firstName: 'Jane',
    lastName: 'Doe',
  };

  it('accepts minimal valid input (firstName + lastName only)', () => {
    expect(createPatientSchema.safeParse(validInput).success).toBe(true);
  });

  it('accepts full valid input with all optional fields', () => {
    const result = createPatientSchema.safeParse({
      ...validInput,
      dateOfBirth: '1985-03-15',
      pronoun: 'they/them',
      phone: '555-0100',
      email: 'jane@example.com',
      context: 'Post-op TKA 6wk',
    });
    expect(result.success).toBe(true);
  });

  it('rejects firstName shorter than 1 char (empty after trim)', () => {
    expect(issues(createPatientSchema.safeParse({ ...validInput, firstName: '   ' }))).toEqual([
      { path: 'firstName', code: 'too_small' },
    ]);
  });

  it('rejects firstName longer than 100 chars', () => {
    expect(
      issues(createPatientSchema.safeParse({ ...validInput, firstName: 'a'.repeat(101) }))
    ).toEqual([{ path: 'firstName', code: 'too_big' }]);
  });

  it('rejects lastName shorter than 1 char', () => {
    expect(issues(createPatientSchema.safeParse({ ...validInput, lastName: '' }))).toEqual([
      { path: 'lastName', code: 'too_small' },
    ]);
  });

  it('rejects lastName longer than 100 chars', () => {
    expect(
      issues(createPatientSchema.safeParse({ ...validInput, lastName: 'a'.repeat(101) }))
    ).toEqual([{ path: 'lastName', code: 'too_big' }]);
  });

  it('rejects missing firstName', () => {
    const input: Record<string, unknown> = { lastName: 'Doe' };
    expect(issues(createPatientSchema.safeParse(input))).toEqual([
      { path: 'firstName', code: 'invalid_type' },
    ]);
  });

  it('rejects missing lastName', () => {
    const input: Record<string, unknown> = { firstName: 'Jane' };
    expect(issues(createPatientSchema.safeParse(input))).toEqual([
      { path: 'lastName', code: 'invalid_type' },
    ]);
  });

  it('rejects invalid dateOfBirth format (not YYYY-MM-DD)', () => {
    expect(
      issues(createPatientSchema.safeParse({ ...validInput, dateOfBirth: '03/15/1985' }))
    ).toEqual([{ path: 'dateOfBirth', code: 'invalid_format' }]);
  });

  it('accepts null dateOfBirth', () => {
    expect(
      createPatientSchema.safeParse({ ...validInput, dateOfBirth: null }).success
    ).toBe(true);
  });

  it('rejects invalid pronoun', () => {
    expect(
      issues(createPatientSchema.safeParse({ ...validInput, pronoun: 'xe/xem' }))
    ).toEqual([{ path: 'pronoun', code: 'invalid_value' }]);
  });

  it('rejects email without @', () => {
    expect(
      issues(createPatientSchema.safeParse({ ...validInput, email: 'not-email' }))
    ).toEqual([{ path: 'email', code: 'invalid_format' }]);
  });

  it('rejects email longer than 255 chars', () => {
    const longLocal = 'a'.repeat(250);
    expect(
      issues(createPatientSchema.safeParse({ ...validInput, email: `${longLocal}@x.com` }))
    ).toEqual([{ path: 'email', code: 'too_big' }]);
  });

  it('rejects phone longer than 32 chars', () => {
    expect(
      issues(createPatientSchema.safeParse({ ...validInput, phone: '1'.repeat(33) }))
    ).toEqual([{ path: 'phone', code: 'too_big' }]);
  });

  it('rejects context longer than 2000 chars', () => {
    expect(
      issues(createPatientSchema.safeParse({ ...validInput, context: 'a'.repeat(2001) }))
    ).toEqual([{ path: 'context', code: 'too_big' }]);
  });

  it('accepts context exactly 2000 chars', () => {
    expect(
      createPatientSchema.safeParse({ ...validInput, context: 'a'.repeat(2000) }).success
    ).toBe(true);
  });

  it('trims whitespace from firstName/lastName', () => {
    const result = createPatientSchema.safeParse({
      firstName: '  Jane  ',
      lastName: '  Doe  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe('Jane');
      expect(result.data.lastName).toBe('Doe');
    }
  });
});

describe('updatePatientSchema', () => {
  it('accepts empty object (all fields optional via partial)', () => {
    expect(updatePatientSchema.safeParse({}).success).toBe(true);
  });

  it('accepts partial update with only firstName', () => {
    expect(updatePatientSchema.safeParse({ firstName: 'Janet' }).success).toBe(true);
  });

  it('still enforces max length on provided fields', () => {
    expect(
      issues(updatePatientSchema.safeParse({ firstName: 'a'.repeat(101) }))
    ).toEqual([{ path: 'firstName', code: 'too_big' }]);
  });
});

describe('updatePatientContextSchema', () => {
  it('accepts a context string under 2000 chars', () => {
    expect(
      updatePatientContextSchema.safeParse({ context: 'post-op TKA' }).success
    ).toBe(true);
  });

  it('accepts null context (clears the field)', () => {
    expect(updatePatientContextSchema.safeParse({ context: null }).success).toBe(true);
  });

  it('rejects context longer than 2000 chars', () => {
    expect(
      issues(updatePatientContextSchema.safeParse({ context: 'a'.repeat(2001) }))
    ).toEqual([{ path: 'context', code: 'too_big' }]);
  });

  it('rejects missing context key', () => {
    expect(issues(updatePatientContextSchema.safeParse({}))).toEqual([
      { path: 'context', code: 'invalid_type' },
    ]);
  });
});

describe('patientSearchSchema', () => {
  it('accepts empty input (uses defaults)', () => {
    const result = patientSearchSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
      expect(result.data.search).toBeUndefined();
    }
  });

  it('accepts a search string up to 100 chars', () => {
    expect(
      patientSearchSchema.safeParse({ search: 'a'.repeat(100) }).success
    ).toBe(true);
  });

  it('rejects search longer than 100 chars', () => {
    expect(
      issues(patientSearchSchema.safeParse({ search: 'a'.repeat(101) }))
    ).toEqual([{ path: 'search', code: 'too_big' }]);
  });

  it('clamps limit via max validation (rejects 101)', () => {
    expect(issues(patientSearchSchema.safeParse({ limit: 101 }))).toEqual([
      { path: 'limit', code: 'too_big' },
    ]);
  });

  it('rejects limit below 1', () => {
    expect(issues(patientSearchSchema.safeParse({ limit: 0 }))).toEqual([
      { path: 'limit', code: 'too_small' },
    ]);
  });

  it('rejects negative offset', () => {
    expect(issues(patientSearchSchema.safeParse({ offset: -1 }))).toEqual([
      { path: 'offset', code: 'too_small' },
    ]);
  });

  it('coerces string limit/offset to numbers', () => {
    const result = patientSearchSchema.safeParse({ limit: '25', offset: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
      expect(result.data.offset).toBe(10);
    }
  });

  it('rejects fractional limit', () => {
    expect(issues(patientSearchSchema.safeParse({ limit: 50.5 }))).toEqual([
      { path: 'limit', code: 'invalid_type' },
    ]);
  });
});
