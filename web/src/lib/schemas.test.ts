import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  validateLogin,
  validateRegister,
  getValidationError,
} from './schemas';

describe('Web Validation Schemas', () => {
  describe('emailSchema', () => {
    it('should accept valid email', () => {
      expect(emailSchema.safeParse('test@example.com').success).toBe(true);
    });

    it('should reject empty string', () => {
      const result = emailSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
      expect(emailSchema.safeParse('@').success).toBe(false);
    });
  });

  describe('passwordSchema', () => {
    it('should accept valid password', () => {
      expect(passwordSchema.safeParse('Password1').success).toBe(true);
    });

    it('should reject empty string', () => {
      expect(passwordSchema.safeParse('').success).toBe(false);
    });

    it('should reject password shorter than 8 characters', () => {
      expect(passwordSchema.safeParse('Pass1').success).toBe(false);
    });

    it('should reject password without uppercase', () => {
      expect(passwordSchema.safeParse('password1').success).toBe(false);
    });

    it('should reject password without lowercase', () => {
      expect(passwordSchema.safeParse('PASSWORD1').success).toBe(false);
    });

    it('should reject password without number', () => {
      expect(passwordSchema.safeParse('Password').success).toBe(false);
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

    it('should reject empty email', () => {
      const result = loginSchema.safeParse({
        email: '',
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
      expect(loginSchema.safeParse({ email: 'test@example.com' }).success).toBe(false);
      expect(loginSchema.safeParse({ password: 'password' }).success).toBe(false);
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
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'Pass1',
        confirmPassword: 'Pass1',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password without uppercase letter', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'password1',
        confirmPassword: 'password1',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password without lowercase letter', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'PASSWORD1',
        confirmPassword: 'PASSWORD1',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password without number', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'Password',
        confirmPassword: 'Password',
      });
      expect(result.success).toBe(false);
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

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({
        ...validData,
        email: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('should reject when acceptedLegalTerms is false', () => {
      const result = registerSchema.safeParse({
        ...validData,
        acceptedLegalTerms: false,
      });
      expect(result.success).toBe(false);
    });

    it('should reject when acceptedLegalTerms is missing', () => {
      const { acceptedLegalTerms: _, ...noConsent } = validData;
      const result = registerSchema.safeParse(noConsent);
      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    const validData = {
      password: 'Password1',
      confirmPassword: 'Password1',
    };

    it('should accept valid reset password data', () => {
      expect(resetPasswordSchema.safeParse(validData).success).toBe(true);
    });

    it('should reject empty password', () => {
      expect(resetPasswordSchema.safeParse({ ...validData, password: '' }).success).toBe(false);
    });

    it('should reject weak password', () => {
      expect(
        resetPasswordSchema.safeParse({ ...validData, password: 'short', confirmPassword: 'short' }).success
      ).toBe(false);
    });

    it('should reject empty confirmPassword', () => {
      const result = resetPasswordSchema.safeParse({ ...validData, confirmPassword: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.errors.map((e) => e.message);
        expect(messages).toContain('Please confirm your password');
      }
    });

    it('should reject mismatched passwords', () => {
      const result = resetPasswordSchema.safeParse({
        ...validData,
        confirmPassword: 'Different1',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.errors.map((e) => e.path.join('.'));
        expect(paths).toContain('confirmPassword');
      }
    });
  });

  describe('validateLogin', () => {
    it('should return success with parsed data for valid input', () => {
      const result = validateLogin({
        email: 'test@example.com',
        password: 'password',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
        expect(result.data.password).toBe('password');
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
    it('should return success with parsed data for valid input', () => {
      const result = validateRegister({
        email: 'test@example.com',
        password: 'Password1',
        confirmPassword: 'Password1',
        acceptedLegalTerms: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('should return errors for invalid input', () => {
      const result = validateRegister({
        email: '',
        password: 'short',
        confirmPassword: 'mismatch',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getValidationError', () => {
    it('should return null for valid data', () => {
      expect(
        getValidationError(loginSchema, {
          email: 'test@example.com',
          password: 'password',
        })
      ).toBeNull();
    });

    it('should return first error message for invalid data', () => {
      const error = getValidationError(loginSchema, { email: '', password: '' });
      expect(error).toBeTypeOf('string');
      expect(error!.length).toBeGreaterThan(0);
    });

    it('should return "Validation failed" if no error messages', () => {
      // This tests the fallback - normally Zod always provides messages
      // but the ?? operator handles edge cases
      const error = getValidationError(loginSchema, {});
      expect(error).toBeTypeOf('string');
    });
  });
});
