'use server';

import { z } from 'zod';

import {
  createPatient,
  updatePatient,
  archivePatient,
} from '@/server/dal';
import {
  createPatientSchema,
  updatePatientSchema,
  updatePatientContextSchema,
  patientIdSchema,
} from '@/lib/schemas/patients';
import { getSession } from '@/server/lib/get-session';
import { apiRateLimit, checkRateLimit } from '@/server/lib/rate-limit';
import { getRequestContext } from '@/server/lib/request-context';
import { auditService } from '@/server/services/audit';
import { AuditAction } from '@/server/types';
import { logger } from '@/server/lib/logger';
import { sanitizeFieldErrors } from '@/server/lib/validation';
import { getPoolClient } from '@/server/db';
import type { ActionResult } from '@/lib/types/actions';
import type { Patient, Pronoun } from '@/lib/types';

/**
 * Allowed field names that may appear in Server Action field-error payloads.
 * Rule 2 + Rule 7: we strip Zod error messages (never leaked) while preserving
 * field->error mapping so forms can highlight the right input. These keys
 * mirror the Zod schema keys in `web/src/lib/schemas/patients.ts`.
 */
const PATIENT_FORM_FIELDS = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'pronoun',
  'phone',
  'email',
  'context',
] as const;

/**
 * Normalize FormData values for Zod. Optional fields sent as empty strings
 * should parse to `null`/absent so the DAL stores NULL rather than `""`.
 */
function normalizeFormData(formData: FormData): Record<string, unknown> {
  const raw = Object.fromEntries(formData);
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim() === '') {
      // Drop blank-string optional fields; Zod `.optional().nullable()` tolerates
      // the absence and the DAL stores NULL.
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

/**
 * Release a pool client defensively — swallow the (rare) double-release error
 * so callers' primary errors still surface.
 */
function safeRelease(client: Awaited<ReturnType<typeof getPoolClient>>): void {
  try {
    client.release();
  } catch {
    // Ignore release errors — the primary error path takes precedence.
  }
}

/**
 * M-6: Create a patient inside a PoolClient transaction. The DAL insert and the
 * `PATIENT_CREATED` audit insert commit together (Rule 9) so audit trail is
 * never out-of-sync with patient state.
 */
export async function createPatientAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: 'unauthenticated' };
  if (!session.emailVerified) return { success: false, error: 'unauthenticated' };

  const rate = await checkRateLimit(apiRateLimit, `patient:${session.userId}`);
  if (!rate.success) return { success: false, error: 'rate_limit_exceeded' };

  const parsed = createPatientSchema.safeParse(normalizeFormData(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: 'validation_error',
      fieldErrors: sanitizeFieldErrors(
        parsed.error.flatten().fieldErrors,
        [...PATIENT_FORM_FIELDS],
      ),
    };
  }

  const ctx = await getRequestContext();
  const client = await getPoolClient();
  try {
    await client.query('BEGIN');
    const patient = await createPatient(
      { userId: session.userId, organizationId: session.organizationId },
      {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        dateOfBirth: parsed.data.dateOfBirth ?? null,
        pronoun: (parsed.data.pronoun ?? null) as Pronoun | null,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        context: parsed.data.context ?? null,
      },
      client,
    );
    await auditService.logWithClient(client, {
      userId: session.userId,
      action: AuditAction.PATIENT_CREATED,
      status: 'SUCCESS',
      metadata: { patientId: patient.id },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    await client.query('COMMIT');
    return { success: true, data: { id: patient.id } };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Connection may be unusable after the primary error — best-effort rollback.
    }
    logger.error(
      {
        err: err instanceof Error ? err : new Error(String(err)),
        source: 'action_create_patient',
        errorType: 'create_patient_failed',
        userId: session.userId,
      },
      'Create patient failed',
    );
    return { success: false, error: 'internal_error' };
  } finally {
    safeRelease(client);
  }
}

/**
 * M-6: Update a patient inside a PoolClient transaction. If the DAL returns
 * null (not found / archived / out-of-scope) we ROLLBACK and return a curated
 * 'patient_not_found' code so the audit entry isn't written on a no-op.
 */
export async function updatePatientAction(
  patientId: string,
  formData: FormData,
): Promise<ActionResult<{ patient: Patient }>> {
  const session = await getSession();
  if (!session) return { success: false, error: 'unauthenticated' };
  if (!session.emailVerified) return { success: false, error: 'unauthenticated' };

  const rate = await checkRateLimit(apiRateLimit, `patient:${session.userId}`);
  if (!rate.success) return { success: false, error: 'rate_limit_exceeded' };

  const idParsed = patientIdSchema.safeParse(patientId);
  if (!idParsed.success) return { success: false, error: 'patient_not_found' };

  const parsed = updatePatientSchema.safeParse(normalizeFormData(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: 'validation_error',
      fieldErrors: sanitizeFieldErrors(
        parsed.error.flatten().fieldErrors,
        [...PATIENT_FORM_FIELDS],
      ),
    };
  }

  const ctx = await getRequestContext();
  const client = await getPoolClient();
  try {
    await client.query('BEGIN');
    const updated = await updatePatient(
      { type: 'user', userId: session.userId },
      idParsed.data,
      parsed.data,
      client,
    );
    if (!updated) {
      await client.query('ROLLBACK');
      return { success: false, error: 'patient_not_found' };
    }
    // Field names only — never values (Rule 7, PHI protection).
    const fields = Object.keys(parsed.data);
    await auditService.logWithClient(client, {
      userId: session.userId,
      action: AuditAction.PATIENT_UPDATED,
      status: 'SUCCESS',
      metadata: { patientId: updated.id, fields },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    await client.query('COMMIT');
    return { success: true, data: { patient: updated } };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Best-effort rollback.
    }
    logger.error(
      {
        err: err instanceof Error ? err : new Error(String(err)),
        source: 'action_update_patient',
        errorType: 'update_patient_failed',
        userId: session.userId,
      },
      'Update patient failed',
    );
    return { success: false, error: 'internal_error' };
  } finally {
    safeRelease(client);
  }
}

/**
 * M-6: Archive a patient inside a PoolClient transaction. ROLLBACK when the
 * DAL returns false (row was already archived, or out-of-scope) so we don't
 * emit a PATIENT_ARCHIVED audit for a no-op.
 */
export async function archivePatientAction(
  patientId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: 'unauthenticated' };
  if (!session.emailVerified) return { success: false, error: 'unauthenticated' };

  const rate = await checkRateLimit(apiRateLimit, `patient:${session.userId}`);
  if (!rate.success) return { success: false, error: 'rate_limit_exceeded' };

  const idParsed = patientIdSchema.safeParse(patientId);
  if (!idParsed.success) return { success: false, error: 'patient_not_found' };

  const ctx = await getRequestContext();
  const client = await getPoolClient();
  try {
    await client.query('BEGIN');
    const archived = await archivePatient(
      { type: 'user', userId: session.userId },
      idParsed.data,
      client,
    );
    if (!archived) {
      await client.query('ROLLBACK');
      return { success: false, error: 'archive_failed' };
    }
    await auditService.logWithClient(client, {
      userId: session.userId,
      action: AuditAction.PATIENT_ARCHIVED,
      status: 'SUCCESS',
      metadata: { patientId: idParsed.data },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Best-effort rollback.
    }
    logger.error(
      {
        err: err instanceof Error ? err : new Error(String(err)),
        source: 'action_archive_patient',
        errorType: 'archive_patient_failed',
        userId: session.userId,
      },
      'Archive patient failed',
    );
    return { success: false, error: 'internal_error' };
  } finally {
    safeRelease(client);
  }
}

/**
 * M-6: Save the per-patient persistent context. Transaction wraps the DAL
 * update and the PATIENT_UPDATED audit entry (metadata.fields = ['context'])
 * so audit trail always matches column state.
 */
export async function updatePatientContextAction(
  patientId: string,
  context: string | null,
): Promise<ActionResult<{ patient: Patient }>> {
  const session = await getSession();
  if (!session) return { success: false, error: 'unauthenticated' };
  if (!session.emailVerified) return { success: false, error: 'unauthenticated' };

  const rate = await checkRateLimit(apiRateLimit, `patient:${session.userId}`);
  if (!rate.success) return { success: false, error: 'rate_limit_exceeded' };

  const idParsed = patientIdSchema.safeParse(patientId);
  if (!idParsed.success) return { success: false, error: 'patient_not_found' };

  const parsed = updatePatientContextSchema.safeParse({ context });
  if (!parsed.success) {
    return {
      success: false,
      error: 'validation_error',
      fieldErrors: sanitizeFieldErrors(
        parsed.error.flatten().fieldErrors,
        [...PATIENT_FORM_FIELDS],
      ),
    };
  }

  const ctx = await getRequestContext();
  const client = await getPoolClient();
  try {
    await client.query('BEGIN');
    const updated = await updatePatient(
      { type: 'user', userId: session.userId },
      idParsed.data,
      { context: parsed.data.context },
      client,
    );
    if (!updated) {
      await client.query('ROLLBACK');
      return { success: false, error: 'context_save_failed' };
    }
    await auditService.logWithClient(client, {
      userId: session.userId,
      action: AuditAction.PATIENT_UPDATED,
      status: 'SUCCESS',
      metadata: { patientId: updated.id, fields: ['context'] },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    await client.query('COMMIT');
    return { success: true, data: { patient: updated } };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Best-effort rollback.
    }
    logger.error(
      {
        err: err instanceof Error ? err : new Error(String(err)),
        source: 'action_update_patient_context',
        errorType: 'context_save_failed',
        userId: session.userId,
      },
      'Update patient context failed',
    );
    return { success: false, error: 'context_save_failed' };
  } finally {
    safeRelease(client);
  }
}

// Explicit type export for consumer imports (forms, detail pages).
export type UpdatePatientContextInput = z.infer<
  typeof updatePatientContextSchema
>;
