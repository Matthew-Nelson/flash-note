'use server';

import { generateNoteSchema } from '@/lib/schemas/notes';
import type { ActionResult } from '@/lib/types/actions';
import type { BillingSummary, GoalsTracking } from '@/server/services/llm';
import {
  LLMError,
  RateLimitError,
  ContentBlockedError,
  TimeoutError,
  NetworkError,
} from '@/server/services/llm';
import { findBuiltinTemplates, findTemplateById } from '@/server/dal';
import { getSession } from '@/server/lib/get-session';
import { logger } from '@/server/lib/logger';
import { getRequestContext } from '@/server/lib/request-context';
import {
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

  const { noteType, quickNotes, patientContext, modality, duration, templateId } = parsed.data;

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

  // 6. Load template (Plan 04-03: template-driven generation).
  //    Fallback to built-in SOAP template when no templateId provided.
  const effectiveTemplateId = templateId ?? DEFAULT_SOAP_TEMPLATE_ID;
  const template = await findTemplateById(effectiveTemplateId);
  if (!template) {
    // Try built-in list as a last resort so a missing seed row is recoverable
    const builtins = await findBuiltinTemplates();
    const soap = builtins.find((t) => t.id === DEFAULT_SOAP_TEMPLATE_ID);
    if (!soap) {
      logger.error(
        { source: 'action_generate_note', errorType: 'template_unavailable', userId: session.userId },
        'Default SOAP template missing',
      );
      return { success: false, error: 'template_unavailable' };
    }
  }
  const loadedTemplate = template ?? (await findBuiltinTemplates()).find((t) => t.id === DEFAULT_SOAP_TEMPLATE_ID);
  if (!loadedTemplate) {
    return { success: false, error: 'template_unavailable' };
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
      patientContext: patientContext ?? null,
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
