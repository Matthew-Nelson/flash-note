import { z } from 'zod';

/**
 * Shared email validation
 */
export const emailSchema = z.string().email('Please enter a valid email address');

/**
 * Authentication Schemas
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

// PASSWORD POLICY - mirrors backend/src/routes/auth.ts (source of truth)
// Keep in sync when updating password requirements
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  acceptedLegalTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the legal terms to create an account' }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
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

/**
 * Billing Schemas
 *
 * Two-tier billing output:
 * - Tier 1 (charges): Only when clinician provides explicit times
 * - Tier 2 (suggestedCodes): When interventions mentioned without times
 */
export const suggestedCodeSchema = z.object({
  cptCode: z.string(),
  description: z.string(),
});

export const billingChargeSchema = z.object({
  cptCode: z.string(),
  description: z.string(),
  minutes: z.number().int().min(1),
  units: z.number().int().min(1),
});

export const billingSummarySchema = z.object({
  // Tier 1: Only when explicit times are provided
  charges: z.array(billingChargeSchema).optional(),
  totalTimedMinutes: z.number().int().min(0).optional(),
  totalUnits: z.number().int().min(0).optional(),

  // Tier 2: When interventions mentioned (even without times)
  suggestedCodes: z.array(suggestedCodeSchema).optional(),

  suggestedModifiers: z.array(z.string()).optional(),
});

/**
 * Goals Tracking Schemas
 *
 * Trust principle: Status can be inferred, but percentComplete
 * is ONLY included if explicitly stated by clinician.
 */
export const goalStatusSchema = z.object({
  description: z.string(),
  // Can be inferred from language ("making progress" → progressing)
  status: z.enum(['not_started', 'progressing', 'met', 'discontinued']),
  // ONLY present if clinician explicitly stated a percentage
  percentComplete: z.number().int().min(0).max(100).optional(),
});

export const goalsTrackingSchema = z.object({
  shortTerm: z.array(goalStatusSchema).optional(),
  longTerm: z.array(goalStatusSchema).optional(),
});

export const generatedNoteSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
  billing: billingSummarySchema.optional(),
  goals: goalsTrackingSchema.optional(),
  alerts: z.array(z.string()).optional(),
  metadata: z.object({
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
export type SuggestedCode = z.infer<typeof suggestedCodeSchema>;
export type BillingCharge = z.infer<typeof billingChargeSchema>;
export type BillingSummary = z.infer<typeof billingSummarySchema>;
export type GoalStatus = z.infer<typeof goalStatusSchema>;
export type GoalsTracking = z.infer<typeof goalsTrackingSchema>;
export type GeneratedNote = z.infer<typeof generatedNoteSchema>;

/**
 * Validation helpers
 */
export function validateEmail(email: unknown): { success: true; data: string } | { success: false; errors: string[]; invalidFields: string[] } {
  const result = emailSchema.safeParse(email);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map((e) => e.message),
    invalidFields: ['email'],
  };
}

export function validateLogin(data: unknown): { success: true; data: LoginInput } | { success: false; errors: string[]; invalidFields: string[] } {
  const result = loginSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const fieldSet = new Set<string>();
  result.error.errors.forEach((e) => {
    if (e.path[0]) fieldSet.add(String(e.path[0]));
  });
  return {
    success: false,
    errors: result.error.errors.map((e) => e.message),
    invalidFields: [...fieldSet],
  };
}

export function validateRegister(data: unknown): { success: true; data: RegisterInput } | { success: false; errors: string[]; invalidFields: string[] } {
  const result = registerSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const fieldSet = new Set<string>();
  result.error.errors.forEach((e) => {
    if (e.path[0]) fieldSet.add(String(e.path[0]));
  });
  return {
    success: false,
    errors: result.error.errors.map((e) => e.message),
    invalidFields: [...fieldSet],
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
