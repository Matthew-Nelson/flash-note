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

export async function generateNoteAction(
  formData: FormData
): Promise<ActionResult<GenerateNoteResponse>> {
  // 1. Validate input
  const raw = Object.fromEntries(formData);
  const parsed = generateNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'validation_error', fieldErrors: sanitizeFieldErrors(parsed.error.flatten().fieldErrors) };
  }

  const { noteType, quickNotes, patientContext, modality, duration } = parsed.data;

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

  // 6. Generate note
  logger.info(
    { source: 'action_generate_note', userId: session.userId, noteType },
    'Note generation started'
  );

  try {
    const result = await generateNote(quickNotes, noteType, patientContext);

    // 7. Usage tracking (errors swallowed internally)
    await incrementUsage(
      session.userId,
      result.metadata.inputTokens,
      result.metadata.outputTokens
    );

    logger.info(
      { source: 'action_generate_note', userId: session.userId, noteType, durationMs: result.metadata.generationTimeMs },
      'Note generation completed'
    );

    // 8. Security monitoring — log suspicious patterns synchronously before audit
    if (result.securityMetadata.suspiciousPatternDetected) {
      logger.warn({ source: 'action_generate_note', errorType: 'suspicious_patterns', audit: true, userId: session.userId, noteType, suspiciousPatternCount: result.securityMetadata.suspiciousPatternCount }, 'Suspicious prompt patterns detected');
    }

    // 9. Audit log (errors swallowed internally by auditService.log)
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
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // 9. Return sanitized result — strip model, token counts, securityMetadata
    return {
      success: true,
      data: {
        subjective: result.subjective,
        objective: result.objective,
        assessment: result.assessment,
        plan: result.plan,
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
