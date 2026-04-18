import { describe, it, expect } from 'vitest';
import {
  pronounSchema,
  patientIdSchema,
  createPatientSchema,
  updatePatientSchema,
  updatePatientContextSchema,
  patientSearchSchema,
} from './patients';

describe('pronounSchema', () => {
  it.each(['he/him', 'she/her', 'they/them', 'other'] as const)(
    'accepts valid pronoun "%s"',
    (value) => {
      expect(pronounSchema.safeParse(value).success).toBe(true);
    }
  );

  it('rejects arbitrary free-text pronoun', () => {
    expect(pronounSchema.safeParse('ze/zir').success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(pronounSchema.safeParse('').success).toBe(false);
  });
});

describe('patientIdSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      patientIdSchema.safeParse('123e4567-e89b-12d3-a456-426614174000').success
    ).toBe(true);
  });

  it('rejects non-UUID strings', () => {
    expect(patientIdSchema.safeParse('not-a-uuid').success).toBe(false);
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
    expect(createPatientSchema.safeParse({ ...validInput, firstName: '   ' }).success).toBe(
      false
    );
  });

  it('rejects firstName longer than 100 chars', () => {
    expect(
      createPatientSchema.safeParse({ ...validInput, firstName: 'a'.repeat(101) })
        .success
    ).toBe(false);
  });

  it('rejects lastName shorter than 1 char', () => {
    expect(createPatientSchema.safeParse({ ...validInput, lastName: '' }).success).toBe(
      false
    );
  });

  it('rejects lastName longer than 100 chars', () => {
    expect(
      createPatientSchema.safeParse({ ...validInput, lastName: 'a'.repeat(101) }).success
    ).toBe(false);
  });

  it('rejects missing firstName', () => {
    const input: Record<string, unknown> = { lastName: 'Doe' };
    expect(createPatientSchema.safeParse(input).success).toBe(false);
  });

  it('rejects missing lastName', () => {
    const input: Record<string, unknown> = { firstName: 'Jane' };
    expect(createPatientSchema.safeParse(input).success).toBe(false);
  });

  it('rejects invalid dateOfBirth format (not YYYY-MM-DD)', () => {
    expect(
      createPatientSchema.safeParse({ ...validInput, dateOfBirth: '03/15/1985' }).success
    ).toBe(false);
  });

  it('accepts null dateOfBirth', () => {
    expect(
      createPatientSchema.safeParse({ ...validInput, dateOfBirth: null }).success
    ).toBe(true);
  });

  it('rejects invalid pronoun', () => {
    expect(
      createPatientSchema.safeParse({ ...validInput, pronoun: 'xe/xem' }).success
    ).toBe(false);
  });

  it('rejects email without @', () => {
    expect(
      createPatientSchema.safeParse({ ...validInput, email: 'not-email' }).success
    ).toBe(false);
  });

  it('rejects email longer than 255 chars', () => {
    const longLocal = 'a'.repeat(250);
    expect(
      createPatientSchema.safeParse({ ...validInput, email: `${longLocal}@x.com` }).success
    ).toBe(false);
  });

  it('rejects phone longer than 32 chars', () => {
    expect(
      createPatientSchema.safeParse({ ...validInput, phone: '1'.repeat(33) }).success
    ).toBe(false);
  });

  it('rejects context longer than 2000 chars', () => {
    expect(
      createPatientSchema.safeParse({ ...validInput, context: 'a'.repeat(2001) }).success
    ).toBe(false);
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
      updatePatientSchema.safeParse({ firstName: 'a'.repeat(101) }).success
    ).toBe(false);
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
      updatePatientContextSchema.safeParse({ context: 'a'.repeat(2001) }).success
    ).toBe(false);
  });

  it('rejects missing context key', () => {
    expect(updatePatientContextSchema.safeParse({}).success).toBe(false);
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
      patientSearchSchema.safeParse({ search: 'a'.repeat(101) }).success
    ).toBe(false);
  });

  it('clamps limit via max validation (rejects 101)', () => {
    expect(patientSearchSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('rejects limit below 1', () => {
    expect(patientSearchSchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('rejects negative offset', () => {
    expect(patientSearchSchema.safeParse({ offset: -1 }).success).toBe(false);
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
    expect(patientSearchSchema.safeParse({ limit: 50.5 }).success).toBe(false);
  });
});
