import { z } from 'zod';

/**
 * Patient Zod schemas — Rule 3 boundary for Server Actions that mutate
 * `patients` and for URL param validation on patient detail pages.
 *
 * Context max length: 2000 chars — the persistent patient context is injected
 * into every future note generation, so the length must balance rich context
 * with prompt-token budgets.
 */

export const pronounSchema = z.enum(['he/him', 'she/her', 'they/them', 'other']);

export const patientIdSchema = z.string().uuid();

export const createPatientSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  dateOfBirth: z.string().date().optional().nullable(), // YYYY-MM-DD
  pronoun: pronounSchema.optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  context: z.string().trim().max(2000).optional().nullable(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const updatePatientContextSchema = z.object({
  context: z.string().trim().max(2000).nullable(),
});

export const patientSearchSchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type UpdatePatientContextInput = z.infer<typeof updatePatientContextSchema>;
export type PatientSearchInput = z.infer<typeof patientSearchSchema>;
