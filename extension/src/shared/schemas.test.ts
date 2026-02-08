import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  loginSchema,
  registerSchema,
  noteTypeSchema,
  generateNoteSchema,
  storedAuthSchema,
  generatedNoteSchema,
  validateEmail,
  validateLogin,
  validateRegister,
  validateGenerateNote,
} from './schemas';

describe('Extension Validation Schemas', () => {
  describe('emailSchema', () => {
    it('should accept valid email', () => {
      expect(emailSchema.safeParse('test@example.com').success).toBe(true);
    });

    it('should reject empty string', () => {
      expect(emailSchema.safeParse('').success).toBe(false);
    });

    it('should reject invalid email', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
      expect(emailSchema.safeParse('@').success).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should return success for valid email', () => {
      const result = validateEmail('test@example.com');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test@example.com');
      }
    });

    it('should return errors for invalid email', () => {
      const result = validateEmail('bad');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.invalidFields).toContain('email');
      }
    });

    it('should return errors for empty string', () => {
      const result = validateEmail('');
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should accept valid credentials', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'password',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing fields', () => {
      expect(loginSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    const validData = {
      email: 'test@example.com',
      password: 'Password1',
      confirmPassword: 'Password1',
      acceptedLegalTerms: true as const,
    };

    it('should accept valid registration data', () => {
      expect(registerSchema.safeParse(validData).success).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      expect(
        registerSchema.safeParse({ ...validData, password: 'Pass1', confirmPassword: 'Pass1' }).success
      ).toBe(false);
    });

    it('should reject password without uppercase letter', () => {
      expect(
        registerSchema.safeParse({ ...validData, password: 'password1', confirmPassword: 'password1' }).success
      ).toBe(false);
    });

    it('should reject password without lowercase letter', () => {
      expect(
        registerSchema.safeParse({ ...validData, password: 'PASSWORD1', confirmPassword: 'PASSWORD1' }).success
      ).toBe(false);
    });

    it('should reject password without number', () => {
      expect(
        registerSchema.safeParse({ ...validData, password: 'Password', confirmPassword: 'Password' }).success
      ).toBe(false);
    });

    it('should reject invalid email', () => {
      expect(
        registerSchema.safeParse({ ...validData, email: 'bad' }).success
      ).toBe(false);
    });

    it('should reject empty confirmPassword', () => {
      const result = registerSchema.safeParse({
        ...validData,
        confirmPassword: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.errors.map((e) => e.message);
        expect(messages).toContain('Please confirm your password');
      }
    });

    it('should reject mismatched passwords', () => {
      const result = registerSchema.safeParse({
        ...validData,
        confirmPassword: 'Different1',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.errors.map((e) => e.path.join('.'));
        expect(paths).toContain('confirmPassword');
      }
    });

    it('should reject when confirmPassword is missing', () => {
      const { confirmPassword: _, ...noConfirm } = validData;
      expect(registerSchema.safeParse(noConfirm).success).toBe(false);
    });

    it('should reject when acceptedLegalTerms is false', () => {
      expect(
        registerSchema.safeParse({ ...validData, acceptedLegalTerms: false }).success
      ).toBe(false);
    });

    it('should reject when acceptedLegalTerms is missing', () => {
      const { acceptedLegalTerms: _, ...noConsent } = validData;
      expect(registerSchema.safeParse(noConsent).success).toBe(false);
    });
  });

  describe('noteTypeSchema', () => {
    it('should accept valid note types', () => {
      const validTypes = ['daily_note', 'initial_eval', 'progress_note', 'discharge'];
      validTypes.forEach((type) => {
        expect(noteTypeSchema.safeParse(type).success).toBe(true);
      });
    });

    it('should reject invalid note types', () => {
      expect(noteTypeSchema.safeParse('invalid').success).toBe(false);
      expect(noteTypeSchema.safeParse('').success).toBe(false);
    });
  });

  describe('generateNoteSchema', () => {
    const validData = {
      noteType: 'daily_note' as const,
      quickNotes: 'Patient reports improved mobility and decreased pain.',
    };

    it('should accept valid note generation input', () => {
      expect(generateNoteSchema.safeParse(validData).success).toBe(true);
    });

    it('should accept optional patientContext', () => {
      expect(
        generateNoteSchema.safeParse({
          ...validData,
          patientContext: '65yo female, knee replacement',
        }).success
      ).toBe(true);
    });

    it('should reject quickNotes shorter than 10 characters', () => {
      expect(
        generateNoteSchema.safeParse({ ...validData, quickNotes: 'short' }).success
      ).toBe(false);
    });

    it('should reject quickNotes longer than 5000 characters', () => {
      expect(
        generateNoteSchema.safeParse({
          ...validData,
          quickNotes: 'a'.repeat(5001),
        }).success
      ).toBe(false);
    });

    it('should reject patientContext longer than 500 characters', () => {
      expect(
        generateNoteSchema.safeParse({
          ...validData,
          patientContext: 'a'.repeat(501),
        }).success
      ).toBe(false);
    });

    it('should reject invalid noteType', () => {
      expect(
        generateNoteSchema.safeParse({ ...validData, noteType: 'invalid' }).success
      ).toBe(false);
    });
  });

  describe('storedAuthSchema', () => {
    const validAuth = {
      accessToken: 'token',
      refreshToken: 'refresh',
      csrfToken: 'csrf',
      user: {
        id: 'user-1',
        email: 'test@example.com',
        subscriptionStatus: 'trialing',
      },
      expiresAt: Date.now() + 60000,
    };

    it('should accept valid stored auth', () => {
      expect(storedAuthSchema.safeParse(validAuth).success).toBe(true);
    });

    it('should accept optional trialEndsAt and emailVerified', () => {
      expect(
        storedAuthSchema.safeParse({
          ...validAuth,
          user: {
            ...validAuth.user,
            trialEndsAt: '2025-01-01T00:00:00Z',
            emailVerified: true,
          },
        }).success
      ).toBe(true);
    });

    it('should reject missing accessToken', () => {
      const { accessToken: _, ...noToken } = validAuth;
      expect(storedAuthSchema.safeParse(noToken).success).toBe(false);
    });

    it('should reject missing user', () => {
      const { user: _, ...noUser } = validAuth;
      expect(storedAuthSchema.safeParse(noUser).success).toBe(false);
    });

    it('should reject invalid user email', () => {
      expect(
        storedAuthSchema.safeParse({
          ...validAuth,
          user: { ...validAuth.user, email: 'not-email' },
        }).success
      ).toBe(false);
    });
  });

  describe('generatedNoteSchema', () => {
    const validNote = {
      subjective: 'Patient reports pain.',
      objective: 'ROM 120 degrees.',
      assessment: 'Improving.',
      plan: 'Continue treatment.',
    };

    it('should accept valid generated note', () => {
      expect(generatedNoteSchema.safeParse(validNote).success).toBe(true);
    });

    it('should accept optional billing', () => {
      expect(
        generatedNoteSchema.safeParse({
          ...validNote,
          billing: {
            suggestedCodes: [{ cptCode: '97110', description: 'Therapeutic exercises' }],
          },
        }).success
      ).toBe(true);
    });

    it('should accept optional goals', () => {
      expect(
        generatedNoteSchema.safeParse({
          ...validNote,
          goals: {
            shortTerm: [{ description: 'Walk 100ft', status: 'progressing' }],
          },
        }).success
      ).toBe(true);
    });

    it('should accept optional alerts and metadata', () => {
      expect(
        generatedNoteSchema.safeParse({
          ...validNote,
          alerts: ['Review medication'],
          metadata: { generationTimeMs: 1234 },
        }).success
      ).toBe(true);
    });

    it('should reject missing required SOAP sections', () => {
      expect(generatedNoteSchema.safeParse({}).success).toBe(false);
      const { subjective: _, ...noSubjective } = validNote;
      expect(generatedNoteSchema.safeParse(noSubjective).success).toBe(false);
    });
  });

  describe('validateLogin', () => {
    it('should return success for valid input', () => {
      const result = validateLogin({
        email: 'test@example.com',
        password: 'password',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('should return errors for invalid input', () => {
      const result = validateLogin({ email: '', password: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should return invalidFields for invalid input', () => {
      const result = validateLogin({ email: 'bad', password: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.invalidFields).toContain('email');
        expect(result.invalidFields).toContain('password');
      }
    });
  });

  describe('validateRegister', () => {
    it('should return success for valid input', () => {
      const result = validateRegister({
        email: 'test@example.com',
        password: 'Password1',
        confirmPassword: 'Password1',
        acceptedLegalTerms: true,
      });
      expect(result.success).toBe(true);
    });

    it('should return errors for invalid input', () => {
      const result = validateRegister({ email: '', password: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should return invalidFields for mismatched passwords', () => {
      const result = validateRegister({
        email: 'test@example.com',
        password: 'Password1',
        confirmPassword: 'Different1',
        acceptedLegalTerms: true,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.invalidFields).toContain('confirmPassword');
      }
    });

    it('should return invalidFields for unchecked legal terms', () => {
      const result = validateRegister({
        email: 'test@example.com',
        password: 'Password1',
        confirmPassword: 'Password1',
        acceptedLegalTerms: false,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.invalidFields).toContain('acceptedLegalTerms');
      }
    });
  });

  describe('validateGenerateNote', () => {
    it('should return success for valid input', () => {
      const result = validateGenerateNote({
        noteType: 'daily_note',
        quickNotes: 'Patient reports improved mobility and decreased pain.',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.noteType).toBe('daily_note');
      }
    });

    it('should return errors for invalid input', () => {
      const result = validateGenerateNote({ noteType: 'invalid', quickNotes: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });
});
