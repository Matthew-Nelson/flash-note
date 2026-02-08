import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  noteTypeSchema,
  generateNoteSchema,
  storedAuthSchema,
  generatedNoteSchema,
  validateLogin,
  validateRegister,
  validateGenerateNote,
} from './schemas';

describe('Extension Validation Schemas', () => {
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
    };

    it('should accept valid registration data', () => {
      expect(registerSchema.safeParse(validData).success).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      expect(
        registerSchema.safeParse({ ...validData, password: 'Pass1' }).success
      ).toBe(false);
    });

    it('should reject password without uppercase letter', () => {
      expect(
        registerSchema.safeParse({ ...validData, password: 'password1' }).success
      ).toBe(false);
    });

    it('should reject password without lowercase letter', () => {
      expect(
        registerSchema.safeParse({ ...validData, password: 'PASSWORD1' }).success
      ).toBe(false);
    });

    it('should reject password without number', () => {
      expect(
        registerSchema.safeParse({ ...validData, password: 'Password' }).success
      ).toBe(false);
    });

    it('should reject invalid email', () => {
      expect(
        registerSchema.safeParse({ ...validData, email: 'bad' }).success
      ).toBe(false);
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
  });

  describe('validateRegister', () => {
    it('should return success for valid input', () => {
      const result = validateRegister({
        email: 'test@example.com',
        password: 'Password1',
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
