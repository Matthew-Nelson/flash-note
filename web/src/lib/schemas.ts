/**
 * Zod Validation Schemas
 *
 * Input validation for authentication forms.
 * Synced with backend validation (source of truth: backend/src/routes/auth.ts)
 */

import { z } from 'zod';

/**
 * Login form validation
 */
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Registration form validation
 *
 * Password policy (synced with backend):
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * Type exports
 */
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Validation helper - returns first error message or null
 */
export function getValidationError<T>(schema: z.ZodSchema<T>, data: unknown): string | null {
  const result = schema.safeParse(data);
  if (result.success) return null;
  /* v8 ignore next -- Zod always provides error messages; defensive fallback only */
  return result.error.errors[0]?.message ?? 'Validation failed';
}

/**
 * Validate login input
 */
export function validateLogin(
  data: unknown
): { success: true; data: LoginInput } | { success: false; errors: string[] } {
  const result = loginSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map((e: z.ZodIssue) => e.message),
  };
}

/**
 * Validate registration input
 */
export function validateRegister(
  data: unknown
): { success: true; data: RegisterInput } | { success: false; errors: string[] } {
  const result = registerSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map((e: z.ZodIssue) => e.message),
  };
}
