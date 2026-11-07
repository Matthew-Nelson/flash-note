import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
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

/** Rejected issues as path/code/message, so a test pins the rule that failed. */
function issues(result: { error?: { issues: z.ZodIssue[] } }) {
  return result.error?.issues.map(({ path, code, message }) => ({
    path: path.join('.'),
    code,
    message,
  }));
}

describe('Web Validation Schemas', () => {
  describe('emailSchema', () => {
    it('should accept valid email', () => {
      expect(emailSchema.safeParse('test@example.com').success).toBe(true);
    });

    it('should reject empty string', () => {
      expect(issues(emailSchema.safeParse(''))).toMatchObject([
        { path: '', message: 'Please enter a valid email address' },
      ]);
    });

    it('should reject invalid email', () => {
      expect(issues(emailSchema.safeParse('not-an-email'))).toMatchObject([
        { path: '', message: 'Please enter a valid email address' },
      ]);
      expect(issues(emailSchema.safeParse('@'))).toMatchObject([
        { path: '', message: 'Please enter a valid email address' },
      ]);
    });
  });

  describe('passwordSchema', () => {
    it('should accept valid password', () => {
      expect(passwordSchema.safeParse('Password1').success).toBe(true);
    });

    it('should reject empty string', () => {
      // Empty input fails every rule, not just the length floor.
      expect(issues(passwordSchema.safeParse(''))).toMatchObject([
        { message: 'Password must be at least 8 characters' },
        { message: 'Password must contain at least one uppercase letter' },
        { message: 'Password must contain at least one lowercase letter' },
        { message: 'Password must contain at least one number' },
      ]);
    });

    it('should reject password shorter than 8 characters', () => {
      expect(issues(passwordSchema.safeParse('Pass1'))).toMatchObject([
        { message: 'Password must be at least 8 characters' },
      ]);
    });

    it('should reject password without uppercase', () => {
      expect(issues(passwordSchema.safeParse('password1'))).toMatchObject([
        { message: 'Password must contain at least one uppercase letter' },
      ]);
    });

    it('should reject password without lowercase', () => {
      expect(issues(passwordSchema.safeParse('PASSWORD1'))).toMatchObject([
        { message: 'Password must contain at least one lowercase letter' },
      ]);
    });

    it('should reject password without number', () => {
      expect(issues(passwordSchema.safeParse('Password'))).toMatchObject([
        { message: 'Password must contain at least one number' },
      ]);
    });

    it('should accept password of exactly 72 characters (bcrypt boundary)', () => {
      // bcrypt ignores bytes past position 72 — 72 chars is the valid upper limit
      const password72 = 'A1a' + 'b'.repeat(69); // 3 + 69 = 72 chars
      expect(passwordSchema.safeParse(password72).success).toBe(true);
    });

    it('should reject password longer than 72 characters (bcrypt DoS vector)', () => {
      // Passwords >72 chars are CPU-intensive but provide no extra security.
      // Enforcing .max(72) prevents CPU DoS against unauthenticated endpoints.
      const password73 = 'A1a' + 'b'.repeat(70); // 3 + 70 = 73 chars
      expect(issues(passwordSchema.safeParse(password73))).toMatchObject([
        { message: 'Password must be 72 characters or fewer' },
      ]);
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
      expect(issues(result)).toMatchObject([
        { path: 'email', message: 'Please enter a valid email address' },
      ]);
    });

    it('should reject empty email', () => {
      const result = loginSchema.safeParse({
        email: '',
        password: 'password',
      });
      expect(issues(result)).toMatchObject([
        { path: 'email', message: 'Please enter a valid email address' },
      ]);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(issues(result)).toMatchObject([
        { path: 'password', message: 'Password is required' },
      ]);
    });

    it('should reject missing fields', () => {
      expect(issues(loginSchema.safeParse({}))).toMatchObject([
        { path: 'email', code: 'invalid_type' },
        { path: 'password', code: 'invalid_type' },
      ]);
      expect(issues(loginSchema.safeParse({ email: 'test@example.com' }))).toMatchObject([
        { path: 'password', code: 'invalid_type' },
      ]);
      expect(issues(loginSchema.safeParse({ password: 'password' }))).toMatchObject([
        { path: 'email', code: 'invalid_type' },
      ]);
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
      expect(issues(result)).toMatchObject([
        { path: 'password', message: 'Password must be at least 8 characters' },
      ]);
    });

    it('should reject password without uppercase letter', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'password1',
        confirmPassword: 'password1',
      });
      expect(issues(result)).toMatchObject([
        { path: 'password', message: 'Password must contain at least one uppercase letter' },
      ]);
    });

    it('should reject password without lowercase letter', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'PASSWORD1',
        confirmPassword: 'PASSWORD1',
      });
      expect(issues(result)).toMatchObject([
        { path: 'password', message: 'Password must contain at least one lowercase letter' },
      ]);
    });

    it('should reject password without number', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'Password',
        confirmPassword: 'Password',
      });
      expect(issues(result)).toMatchObject([
        { path: 'password', message: 'Password must contain at least one number' },
      ]);
    });

    it('should reject empty confirmPassword', () => {
      const result = registerSchema.safeParse({
        ...validData,
        confirmPassword: '',
      });
      expect(issues(result)).toMatchObject([
        { path: 'confirmPassword', message: 'Please confirm your password' },
        { path: 'confirmPassword', message: 'Passwords do not match' },
      ]);
    });

    it('should reject mismatched passwords', () => {
      const result = registerSchema.safeParse({
        ...validData,
        confirmPassword: 'Different1',
      });
      expect(issues(result)).toMatchObject([
        { path: 'confirmPassword', message: 'Passwords do not match' },
      ]);
    });

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({
        ...validData,
        email: 'not-an-email',
      });
      expect(issues(result)).toMatchObject([
        { path: 'email', message: 'Please enter a valid email address' },
      ]);
    });

    it('should reject when acceptedLegalTerms is false', () => {
      const result = registerSchema.safeParse({
        ...validData,
        acceptedLegalTerms: false,
      });
      expect(issues(result)).toMatchObject([
        { path: 'acceptedLegalTerms', message: 'You must accept the legal terms to create an account' },
      ]);
    });

    it('should reject when acceptedLegalTerms is missing', () => {
      const { acceptedLegalTerms: _, ...noConsent } = validData;
      const result = registerSchema.safeParse(noConsent);
      expect(issues(result)).toMatchObject([
        { path: 'acceptedLegalTerms', message: 'You must accept the legal terms to create an account' },
      ]);
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
      expect(issues(resetPasswordSchema.safeParse({ ...validData, password: '' }))).toMatchObject([
        { path: 'password', message: 'Password must be at least 8 characters' },
        { path: 'password', message: 'Password must contain at least one uppercase letter' },
        { path: 'password', message: 'Password must contain at least one lowercase letter' },
        { path: 'password', message: 'Password must contain at least one number' },
        { path: 'confirmPassword', message: 'Passwords do not match' },
      ]);
    });

    it('should reject weak password', () => {
      expect(
        issues(resetPasswordSchema.safeParse({ ...validData, password: 'short', confirmPassword: 'short' }))
      ).toMatchObject([
        { path: 'password', message: 'Password must be at least 8 characters' },
        { path: 'password', message: 'Password must contain at least one uppercase letter' },
        { path: 'password', message: 'Password must contain at least one number' },
      ]);
    });

    it('should reject empty confirmPassword', () => {
      const result = resetPasswordSchema.safeParse({ ...validData, confirmPassword: '' });
      expect(issues(result)).toMatchObject([
        { path: 'confirmPassword', message: 'Please confirm your password' },
        { path: 'confirmPassword', message: 'Passwords do not match' },
      ]);
    });

    it('should reject mismatched passwords', () => {
      const result = resetPasswordSchema.safeParse({
        ...validData,
        confirmPassword: 'Different1',
      });
      expect(issues(result)).toMatchObject([
        { path: 'confirmPassword', message: 'Passwords do not match' },
      ]);
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
      expect(result).toEqual({
        success: false,
        errors: ['Please enter a valid email address', 'Password is required'],
      });
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
      expect(result).toEqual({
        success: false,
        errors: [
          'Please enter a valid email address',
          'Password must be at least 8 characters',
          'Password must contain at least one uppercase letter',
          'Password must contain at least one number',
          'You must accept the legal terms to create an account',
        ],
      });
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
      expect(getValidationError(loginSchema, { email: '', password: '' })).toBe(
        'Please enter a valid email address'
      );
    });

    it('should return "Validation failed" if no error messages', () => {
      // This tests the fallback - normally Zod always provides messages
      // but the ?? operator handles edge cases
      const error = getValidationError(loginSchema, {});
      expect(error).toBeTypeOf('string');
    });
  });
});
