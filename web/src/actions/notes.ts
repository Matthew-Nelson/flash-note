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

export interface GenerateNoteResponse {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  billing?: BillingSummary;
  goals?: GoalsTracking;
  alerts?: string[];
  uncertainAreas?: string[];
  metadata: { generationTimeMs: number };
}

export async function generateNoteAction(
  formData: FormData
): Promise<ActionResult<GenerateNoteResponse>> {
  // 1. Validate input
  const raw = Object.fromEntries(formData);
  const parsed = generateNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'validation_error' };
  }

  const { noteType, quickNotes, patientContext } = parsed.data;

  // 2. Auth check
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'unauthenticated' };
  }

  // 3. Email verification
  if (!session.emailVerified) {
    return { success: false, error: 'email_not_verified' };
  }

  // 4. Subscription check
  const subscriptionResult = await checkSubscriptionAccess(session);
  if (!subscriptionResult.allowed) {
    return { success: false, error: subscriptionResult.reason };
  }

  // 5. Rate limit
  const context = await getRequestContext();
  const rl = await checkRateLimit(
    generateRateLimit,
    rateLimitKey(context.ipAddress ?? 'unknown', session.userId)
  );
  if (!rl.success) {
    return { success: false, error: 'rate_limit_exceeded' };
  }

  // 6. Generate note
  try {
    const result = await generateNote(quickNotes, noteType, patientContext);

    // 7. Usage tracking (fire-and-forget — swallowed internally)
    void incrementUsage(
      session.userId,
      result.metadata.inputTokens,
      result.metadata.outputTokens
    );

    // 8. Audit log (fire-and-forget)
    void auditService.log({
      userId: session.userId,
      action: AuditAction.NOTE_GENERATED,
      status: 'SUCCESS',
      metadata: {
        noteType,
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
        metadata: { generationTimeMs: result.metadata.generationTimeMs },
      },
    };
  } catch (error) {
    // Map LLM errors to error codes
    const errorCode = mapLLMErrorCode(error);

    // Log with structured context (no PHI — never log quickNotes, patientContext, or raw error messages)
    console.error('Note generation failed:', {
      source: 'action_generate_note',
      errorType: errorCode,
      userId: session.userId,
      noteType,
      isLLMError: error instanceof LLMError,
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
