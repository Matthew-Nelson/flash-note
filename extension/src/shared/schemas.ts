import { z } from 'zod';

/**
 * Authentication Schemas
 */
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

/**
 * Note Generation Schemas
 */
export const noteTypeSchema = z.enum([
  'daily_note',
  'initial_eval',
  'progress_note',
  'discharge',
]);

export const generateNoteSchema = z.object({
  noteType: noteTypeSchema,
  patientContext: z.string().max(500, 'Patient context must be under 500 characters').optional(),
  quickNotes: z
    .string()
    .min(10, 'Please provide at least 10 characters of notes')
    .max(5000, 'Notes must be under 5000 characters'),
});

/**
 * Storage Schemas - for validating data from chrome.storage
 */
export const storedUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  subscriptionStatus: z.string(),
  trialEndsAt: z.string().nullable().optional(),
  emailVerified: z.boolean().optional(),
});

export const storedAuthSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  csrfToken: z.string(),
  user: storedUserSchema,
  expiresAt: z.number(),
});

export const storedPreferencesSchema = z.object({
  defaultNoteType: noteTypeSchema.optional(),
});

/**
 * API Response Schemas
 */
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export const authResponseSchema = z.object({
  user: storedUserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  csrfToken: z.string(),
  emailVerificationRequired: z.boolean().optional(),
});

export const generatedNoteSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
  metadata: z.object({
    model: z.string(),
    tokensUsed: z.number(),
    generationTimeMs: z.number(),
  }).optional(),
});

/**
 * Type exports
 */
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type NoteType = z.infer<typeof noteTypeSchema>;
export type GenerateNoteInput = z.infer<typeof generateNoteSchema>;
export type StoredAuth = z.infer<typeof storedAuthSchema>;
export type StoredPreferences = z.infer<typeof storedPreferencesSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type GeneratedNote = z.infer<typeof generatedNoteSchema>;

/**
 * Validation helpers
 */
export function validateLogin(data: unknown): { success: true; data: LoginInput } | { success: false; errors: string[] } {
  const result = loginSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map((e) => e.message),
  };
}

export function validateRegister(data: unknown): { success: true; data: RegisterInput } | { success: false; errors: string[] } {
  const result = registerSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map((e) => e.message),
  };
}

export function validateGenerateNote(data: unknown): { success: true; data: GenerateNoteInput } | { success: false; errors: string[] } {
  const result = generateNoteSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map((e) => e.message),
  };
}
