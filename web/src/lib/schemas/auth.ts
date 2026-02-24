/**
 * Zod Validation Schemas
 *
 * Input validation for authentication forms.
 * Source of truth for password policy (per CLAUDE.md: server-side Zod schema in the DAL/auth module)
 */

import { z } from 'zod';

/**
 * Shared email validation
 */
export const emailSchema = z.string().email('Please enter a valid email address');

/**
 * Login form validation
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Password policy:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Registration form validation
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  acceptedLegalTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the legal terms to create an account' }),
  }),
  inviteCode: z.string().max(20).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * Reset password form validation
 */
export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * Type exports
 */
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

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
