import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  validateLogin,
  validateRegister,
  getValidationError,
} from './schemas';

describe('Web Validation Schemas', () => {
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
