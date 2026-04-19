'use server';

import {
  generateNoteSchema,
  saveNoteSchema,
  updateNoteSectionsSchema,
  noteIdSchema,
} from '@/lib/schemas/notes';
import type { ActionResult } from '@/lib/types/actions';
import type { BillingSummary, GoalsTracking } from '@/server/services/llm';
import {
  LLMError,
  RateLimitError,
  ContentBlockedError,
  TimeoutError,
  NetworkError,
} from '@/server/services/llm';
import {
  findBuiltinTemplates,
  findTemplateById,
  findTemplateWithUserStyle,
  findPatientById,
  createClinicalNote,
  findClinicalNoteById,
  updateClinicalNoteContent,
  archiveClinicalNote,
  createInitialVersions,
  createVersionForSection,
} from '@/server/dal';
import { getPoolClient } from '@/server/db';
import { getSession } from '@/server/lib/get-session';
import { logger } from '@/server/lib/logger';
import { getRequestContext } from '@/server/lib/request-context';
import {
  apiRateLimit,
  checkRateLimit,
  rateLimitKey,
  generateRateLimit,
} from '@/server/lib/rate-limit';
import { checkSubscriptionAccess } from '@/server/services/subscription';
import { generateNote } from '@/server/services/note-generation';
import { incrementUsage } from '@/server/dal/usage';
import { auditService } from '@/server/services/audit';
import { AuditAction } from '@/server/types';
import { sanitizeFieldErrors } from '@/server/lib/validation';
import type { ClinicalNote, NoteSection, QueryScope } from '@/lib/types';

export interface GenerateNoteResponse {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  billing?: BillingSummary;
  goals?: GoalsTracking;
  alerts?: string[];
  uncertainAreas?: string[];
  metadata: {
    generationTimeMs: number;
    modality?: 'in_person' | 'telehealth';
    duration?: number;
  };
}

/**
 * Default SOAP template UUID (seeded in migration 002). Used when an older
 * caller doesn't explicitly pass `templateId`. Plan 04-03 Task 4a's rewrite of
 * NoteGenerationForm will always pass an explicit templateId; this fallback
 * maintains backward compatibility with the transitional UI.
 */
const DEFAULT_SOAP_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001';

export async function generateNoteAction(
  formData: FormData
): Promise<ActionResult<GenerateNoteResponse>> {
  // 1. Validate input
  const raw = Object.fromEntries(formData);
  const parsed = generateNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'validation_error', fieldErrors: sanitizeFieldErrors(parsed.error.flatten().fieldErrors) };
  }

  const { noteType, quickNotes, patientContext, modality, duration, templateId, patientId } = parsed.data;

  // 2. Auth check
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'unauthenticated' };
  }

  // 3. Email verification
  if (!session.emailVerified) {
    return { success: false, error: 'email_not_verified' };
  }

  // Get request context early — needed for audit logging and rate limiting
  const context = await getRequestContext();

  // 4. Subscription check
  const subscriptionResult = await checkSubscriptionAccess(session);
  if (!subscriptionResult.allowed) {
    // HIPAA: log ACCESS_DENIED for subscription gate failures
    await auditService.log({
      userId: session.userId,
      action: AuditAction.ACCESS_DENIED,
      status: 'FAILURE',
      metadata: { reason: subscriptionResult.reason, resource: 'note_generation' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return { success: false, error: subscriptionResult.reason };
  }

  // 5. Rate limit (context already obtained above)
  const rl = await checkRateLimit(
    generateRateLimit,
    rateLimitKey(context.ipAddress ?? 'unknown', session.userId)
  );
  if (!rl.success) {
    return { success: false, error: 'rate_limit_exceeded' };
  }

  // 6. Load template with per-user style overrides (Plan 04-03 / PROMPT-03).
  //    Fallback to built-in SOAP template when no templateId provided so the
  //    transitional UI (pre-Task 4a rewrite) keeps working.
  const effectiveTemplateId = templateId ?? DEFAULT_SOAP_TEMPLATE_ID;
  let loadedTemplate = await findTemplateWithUserStyle(effectiveTemplateId, session.userId);
  if (!loadedTemplate) {
    // Defense-in-depth: findTemplateById (no style overlay) in case the user
    // has no preferences but the template exists.
    loadedTemplate = await findTemplateById(effectiveTemplateId);
  }
  if (!loadedTemplate) {
    // Last resort: the seeded builtin SOAP template by ID lookup.
    const builtins = await findBuiltinTemplates();
    loadedTemplate =
      builtins.find((t) => t.id === DEFAULT_SOAP_TEMPLATE_ID) ?? null;
  }
  if (!loadedTemplate) {
    logger.error(
      {
        source: 'action_generate_note',
        errorType: 'template_unavailable',
        userId: session.userId,
      },
      'Template not found',
    );
    return { success: false, error: 'template_unavailable' };
  }

  // 6b. Load patient (if linked) for server-authoritative context snapshot
  //     at generation time. saveNoteAction will re-load the patient INSIDE
  //     its transaction and use the authoritative value for persistence
  //     (M-5) — this load is for the generation call only.
  let contextSnapshot: string | null = patientContext ?? null;
  if (patientId) {
    const patient = await findPatientById(
      { type: 'user', userId: session.userId },
      patientId,
    );
    if (!patient) {
      return { success: false, error: 'patient_not_found' };
    }
    contextSnapshot = patient.context ?? contextSnapshot;
  }

  // 7. Generate note
  logger.info(
    { source: 'action_generate_note', userId: session.userId, noteType },
    'Note generation started'
  );

  try {
    const result = await generateNote({
      quickNotes,
      noteType,
      template: loadedTemplate,
      patientContext: contextSnapshot,
    });

    // 8. Usage tracking (errors swallowed internally)
    await incrementUsage(
      session.userId,
      result.metadata.inputTokens,
      result.metadata.outputTokens
    );

    logger.info(
      { source: 'action_generate_note', userId: session.userId, noteType, durationMs: result.metadata.generationTimeMs },
      'Note generation completed'
    );

    // 9. Security monitoring — log suspicious patterns synchronously before audit
    if (result.securityMetadata.suspiciousPatternDetected) {
      logger.warn({ source: 'action_generate_note', errorType: 'suspicious_patterns', audit: true, userId: session.userId, noteType, suspiciousPatternCount: result.securityMetadata.suspiciousPatternCount }, 'Suspicious prompt patterns detected');
    }

    // 10. Audit log (errors swallowed internally by auditService.log)
    await auditService.log({
      userId: session.userId,
      action: AuditAction.NOTE_GENERATED,
      status: 'SUCCESS',
      metadata: {
        noteType,
        modality,
        duration,
        templateId: loadedTemplate.id,
        patientId: patientId ?? null,
        inputTokens: result.metadata.inputTokens,
        outputTokens: result.metadata.outputTokens,
        generationTimeMs: result.metadata.generationTimeMs,
        suspiciousPatternDetected: result.securityMetadata.suspiciousPatternDetected,
        sectionCount: result.content.length,
        hallucinationCount: result.hallucinationIssues.length,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // 11. Map NoteSection[] back to flat S/O/A/P keys for the transitional UI
    //     (Task 4a rewrites the UI to consume result.content directly).
    const byTitle = new Map(result.content.map((s) => [s.title.toLowerCase(), s.content]));

    return {
      success: true,
      data: {
        subjective: byTitle.get('subjective') ?? '',
        objective: byTitle.get('objective') ?? '',
        assessment: byTitle.get('assessment') ?? '',
        plan: byTitle.get('plan') ?? '',
        billing: result.billing,
        goals: result.goals,
        alerts: result.alerts,
        uncertainAreas: result.uncertainAreas,
        metadata: {
          generationTimeMs: result.metadata.generationTimeMs,
          modality,
          duration,
        },
      },
    };
  } catch (error) {
    // Map LLM errors to error codes
    const errorCode = mapLLMErrorCode(error);

    // Log with structured context (no PHI — never log quickNotes, patientContext, or raw error messages)
    logger.error({ err: error instanceof Error ? error : new Error(String(error)), source: 'action_generate_note', errorType: errorCode, userId: session.userId, noteType, isLLMError: error instanceof LLMError }, 'Note generation failed');

    // Audit failure (errors swallowed internally by auditService.log)
    await auditService.log({
      userId: session.userId,
      action: AuditAction.NOTE_GENERATED,
      status: 'FAILURE',
      metadata: { noteType, errorCode },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return { success: false, error: errorCode };
  }
}

/**
 * Map error to a client-safe error code.
 * SECURITY: Never expose raw error messages (Rule 7).
 */
function mapLLMErrorCode(error: unknown): string {
  if (error instanceof RateLimitError) return 'ai_rate_limited';
  if (error instanceof ContentBlockedError) return 'ai_content_blocked';
  if (error instanceof TimeoutError) return 'ai_timeout';
  if (error instanceof NetworkError) return 'ai_unavailable';
  if (error instanceof LLMError) return 'ai_error';
  return 'internal_error';
}

// ---------------------------------------------------------------------------
// Plan 04-03 Task 3 — save / update / archive note Server Actions.
// Rule 1 transactions with Rule 9 in-transaction audit.
// ---------------------------------------------------------------------------

/**
 * Allowed field names for saveNoteAction fieldErrors (Rule 2 — preserve field
 * mapping, strip Zod messages). Content is validated as a JSON array; its
 * inner section errors are collapsed under the `content` key.
 */
const SAVE_NOTE_FORM_FIELDS = [
  'templateId',
  'patientId',
  'noteType',
  'content',
  'quickNotes',
  'patientContextSnapshot',
  'modality',
  'durationMinutes',
  'generationTimeMs',
] as const;

const UPDATE_NOTE_SECTIONS_FORM_FIELDS = [
  'noteId',
  'expectedUpdatedAt',
  'sections',
] as const;

/**
 * Release a PoolClient defensively so a double-release never masks the primary
 * error. Mirrors the pattern in actions/patients.ts.
 */
function safeRelease(client: Awaited<ReturnType<typeof getPoolClient>>): void {
  try {
    client.release();
  } catch {
    // Primary error takes precedence.
  }
}

/**
 * Parse FormData entries, JSON-decoding `content` / `sections` payloads that
 * arrive as strings from the client. Returns the decoded record or throws a
 * `SyntaxError` which the caller maps to `validation_error`.
 */
function parseJsonField(
  raw: Record<string, unknown>,
  field: 'content' | 'sections',
): Record<string, unknown> {
  const value = raw[field];
  if (typeof value === 'string') {
    raw[field] = JSON.parse(value) as unknown;
  }
  return raw;
}

/**
 * saveNoteAction (Plan 04-03 Task 3 / PHI-03 / PHI-07).
 *
 * Rule 1 + Rule 9: persists a clinical_notes row, initial note_versions rows,
 * and a NOTE_SAVED audit row inside a single PoolClient transaction.
 *
 * M-5 (server-authoritative patientContext snapshot): when a patientId is
 * supplied, we RE-LOAD the patient INSIDE the transaction via
 * `findPatientById(scope, patientId, client)` and use `patient.context` as the
 * persisted snapshot. Any client-supplied `patientContextSnapshot` on the
 * FormData is accepted by the schema (for generation-time display) but is
 * OVERWRITTEN here — a malicious client cannot lie about what context was in
 * play at save time.
 *
 * M-2 (PHI-in-logs guard): catch-block logs ONLY err + userId + source. Never
 * logs quickNotes, content, patientContext, patient fields, or FormData values.
 */
export async function saveNoteAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: 'unauthenticated' };
  if (!session.emailVerified) return { success: false, error: 'unauthenticated' };

  const rate = await checkRateLimit(apiRateLimit, `save-note:${session.userId}`);
  if (!rate.success) return { success: false, error: 'rate_limit_exceeded' };

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  try {
    parseJsonField(raw, 'content');
  } catch {
    return { success: false, error: 'validation_error' };
  }

  const parsed = saveNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'validation_error',
      fieldErrors: sanitizeFieldErrors(
        parsed.error.flatten().fieldErrors,
        [...SAVE_NOTE_FORM_FIELDS],
      ),
    };
  }

  const scope: QueryScope = { type: 'user', userId: session.userId };
  const ctx = await getRequestContext();
  const client = await getPoolClient();
  try {
    await client.query('BEGIN');

    // M-5: Server-authoritative patientContext snapshot.
    // Re-load the patient INSIDE the transaction and ignore any client-supplied
    // parsed.data.patientContextSnapshot for persistence — defense-in-depth
    // against a malicious client. The Zod schema still accepts the field (for
    // generation-time display) but we overwrite it before DAL persistence.
    let authoritativePatientContext: string | null = null;
    if (parsed.data.patientId) {
      const patient = await findPatientById(scope, parsed.data.patientId, client);
      if (!patient) {
        await client.query('ROLLBACK');
        return { success: false, error: 'patient_not_found' };
      }
      authoritativePatientContext = patient.context;
    }

    const note = await createClinicalNote(
      client,
      { userId: session.userId, organizationId: session.organizationId },
      {
        patientId: parsed.data.patientId ?? null,
        templateId: parsed.data.templateId,
        noteType: parsed.data.noteType,
        content: parsed.data.content,
        quickNotes: parsed.data.quickNotes,
        patientContext: authoritativePatientContext,
        modality: parsed.data.modality ?? null,
        durationMinutes: parsed.data.durationMinutes ?? null,
        generationTimeMs: parsed.data.generationTimeMs ?? null,
      },
    );

    await createInitialVersions(
      client,
      note.id,
      parsed.data.content,
      session.userId,
    );

    await auditService.logWithClient(client, {
      userId: session.userId,
      action: AuditAction.NOTE_SAVED,
      status: 'SUCCESS',
      metadata: {
        noteId: note.id,
        templateId: parsed.data.templateId,
        patientId: parsed.data.patientId ?? null,
        noteType: parsed.data.noteType,
        sectionCount: parsed.data.content.length,
      },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    await client.query('COMMIT');
    return { success: true, data: { id: note.id } };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Best-effort rollback — primary error takes precedence.
    }
    // M-2: NEVER log PHI — only err + userId + source + errorType.
    logger.error(
      {
        err: err instanceof Error ? err : new Error(String(err)),
        source: 'action_save_note',
        errorType: 'save_note_failed',
        userId: session.userId,
      },
      'Save note failed',
    );
    return { success: false, error: 'internal_error' };
  } finally {
    safeRelease(client);
  }
}

/**
 * updateNoteSectionsAction (Plan 04-03 Task 3 / PHI-04 versioning).
 *
 * Rule 1 + Rule 9 transaction: optimistic-lock update + per-section new
 * version INSERT + NOTE_UPDATED audit — all-or-nothing.
 *
 * M-1 UNIQUE-violation handling: if a concurrent edit wins the updated_at
 * race but the note_versions INSERT collides on (note_id, section_id,
 * version) UNIQUE index (pg error code 23505), we ROLLBACK and surface
 * `conflict` — same error code as the optimistic-lock path so clients have
 * one recovery UX.
 *
 * M-2: no PHI in logs.
 */
export async function updateNoteSectionsAction(
  formData: FormData,
): Promise<ActionResult<{ note: ClinicalNote }>> {
  const session = await getSession();
  if (!session) return { success: false, error: 'unauthenticated' };
  if (!session.emailVerified) return { success: false, error: 'unauthenticated' };

  const rate = await checkRateLimit(apiRateLimit, `update-note:${session.userId}`);
  if (!rate.success) return { success: false, error: 'rate_limit_exceeded' };

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  try {
    parseJsonField(raw, 'sections');
  } catch {
    return { success: false, error: 'validation_error' };
  }

  const parsed = updateNoteSectionsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'validation_error',
      fieldErrors: sanitizeFieldErrors(
        parsed.error.flatten().fieldErrors,
        [...UPDATE_NOTE_SECTIONS_FORM_FIELDS],
      ),
    };
  }

  const scope: QueryScope = { type: 'user', userId: session.userId };
  const ctx = await getRequestContext();
  const client = await getPoolClient();
  try {
    await client.query('BEGIN');

    const existing = await findClinicalNoteById(scope, parsed.data.noteId);
    if (!existing) {
      await client.query('ROLLBACK');
      return { success: false, error: 'note_not_found' };
    }

    const existingIds = new Set(existing.content.map((s) => s.sectionId));
    for (const sid of Object.keys(parsed.data.sections)) {
      if (!existingIds.has(sid)) {
        await client.query('ROLLBACK');
        return { success: false, error: 'invalid_section_id' };
      }
    }

    const merged: NoteSection[] = existing.content.map((s) =>
      parsed.data.sections[s.sectionId] !== undefined
        ? { ...s, content: parsed.data.sections[s.sectionId] }
        : s,
    );

    const updated = await updateClinicalNoteContent(
      client,
      scope,
      parsed.data.noteId,
      merged,
      parsed.data.expectedUpdatedAt,
    );
    if (!updated) {
      await client.query('ROLLBACK');
      return { success: false, error: 'conflict' };
    }

    for (const [sectionId, content] of Object.entries(parsed.data.sections)) {
      await createVersionForSection(
        client,
        parsed.data.noteId,
        sectionId,
        content,
        'manual',
        session.userId,
      );
    }

    await auditService.logWithClient(client, {
      userId: session.userId,
      action: AuditAction.NOTE_UPDATED,
      status: 'SUCCESS',
      metadata: {
        noteId: parsed.data.noteId,
        editedSectionCount: Object.keys(parsed.data.sections).length,
      },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    await client.query('COMMIT');
    return { success: true, data: { note: updated } };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Best-effort rollback.
    }
    // M-1: UNIQUE violation on (note_id, section_id, version) → treat as conflict.
    const pgCode = (err as { code?: string } | null | undefined)?.code;
    if (pgCode === '23505') {
      return { success: false, error: 'conflict' };
    }
    // M-2: no PHI in logs.
    logger.error(
      {
        err: err instanceof Error ? err : new Error(String(err)),
        source: 'action_update_note_sections',
        errorType: 'update_note_sections_failed',
        userId: session.userId,
        noteId: parsed.data.noteId,
      },
      'Update note sections failed',
    );
    return { success: false, error: 'internal_error' };
  } finally {
    safeRelease(client);
  }
}

/**
 * archiveNoteAction (Plan 04-03 Task 3).
 *
 * Non-transactional single UPDATE + fire-and-forget audit. The archive flag
 * is a soft-delete — PHI is retained for HIPAA audit but the note disappears
 * from list views (Rule 5 DAL filters `archived_at IS NULL`).
 *
 * M-2: no PHI in logs; metadata contains only noteId.
 */
export async function archiveNoteAction(
  noteId: string,
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { success: false, error: 'unauthenticated' };
  if (!session.emailVerified) return { success: false, error: 'unauthenticated' };

  const parsedId = noteIdSchema.safeParse(noteId);
  if (!parsedId.success) return { success: false, error: 'validation_error' };

  const rate = await checkRateLimit(apiRateLimit, `archive-note:${session.userId}`);
  if (!rate.success) return { success: false, error: 'rate_limit_exceeded' };

  const ctx = await getRequestContext();
  try {
    const archived = await archiveClinicalNote(
      { type: 'user', userId: session.userId },
      parsedId.data,
    );
    if (!archived) return { success: false, error: 'archive_failed' };

    await auditService.log({
      userId: session.userId,
      action: AuditAction.NOTE_ARCHIVED,
      status: 'SUCCESS',
      metadata: { noteId: parsedId.data },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return { success: true };
  } catch (err) {
    // M-2: no PHI in logs.
    logger.error(
      {
        err: err instanceof Error ? err : new Error(String(err)),
        source: 'action_archive_note',
        errorType: 'archive_note_failed',
        userId: session.userId,
        noteId: parsedId.data,
      },
      'Archive note failed',
    );
    return { success: false, error: 'internal_error' };
  }
}
