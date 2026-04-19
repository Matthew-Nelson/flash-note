'use server';

import { updateSectionStyleSchema } from '@/lib/schemas/notes';
import { upsertUserSectionStyle } from '@/server/dal';
import { getSession } from '@/server/lib/get-session';
import { apiRateLimit, checkRateLimit } from '@/server/lib/rate-limit';
import { getRequestContext } from '@/server/lib/request-context';
import { auditService } from '@/server/services/audit';
import { AuditAction } from '@/server/types';
import { logger } from '@/server/lib/logger';
import { sanitizeFieldErrors } from '@/server/lib/validation';
import type { ActionResult } from '@/lib/types/actions';
import type { UserStylePreference } from '@/lib/types';

const UPDATE_SECTION_STYLE_FORM_FIELDS = [
  'sectionId',
  'verbosity',
  'styling',
] as const;

/**
 * updateSectionStyleAction (Plan 04-03 Task 3 / PROMPT-03 per-user style
 * preferences overlay).
 *
 * Writes an overlay row to user_style_preferences that shadows the builtin
 * SOAP template defaults for the current user. The overlay applies to the
 * NEXT generation via findTemplateWithUserStyle.
 *
 * Fire-and-forget audit — USER_PREFERENCES_UPDATED with metadata `{ sectionId,
 * fields }` (field names only, never values — Rule 7 + M-2).
 */
export async function updateSectionStyleAction(
  formData: FormData,
): Promise<ActionResult<{ preference: UserStylePreference }>> {
  const session = await getSession();
  if (!session) return { success: false, error: 'unauthenticated' };
  if (!session.emailVerified) return { success: false, error: 'unauthenticated' };

  const rate = await checkRateLimit(
    apiRateLimit,
    `style-prefs:${session.userId}`,
  );
  if (!rate.success) return { success: false, error: 'rate_limit_exceeded' };

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  const parsed = updateSectionStyleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'validation_error',
      fieldErrors: sanitizeFieldErrors(
        parsed.error.flatten().fieldErrors,
        [...UPDATE_SECTION_STYLE_FORM_FIELDS],
      ),
    };
  }

  const ctx = await getRequestContext();
  try {
    const preference = await upsertUserSectionStyle(
      session.userId,
      parsed.data.sectionId,
      {
        verbosity: parsed.data.verbosity,
        styling: parsed.data.styling,
      },
    );

    // Audit field names only — never values (Rule 7, PHI protection, M-2).
    const fields: string[] = [];
    if (parsed.data.verbosity !== undefined) fields.push('verbosity');
    if (parsed.data.styling !== undefined) fields.push('styling');

    await auditService.log({
      userId: session.userId,
      action: AuditAction.USER_PREFERENCES_UPDATED,
      status: 'SUCCESS',
      metadata: { sectionId: parsed.data.sectionId, fields },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return { success: true, data: { preference } };
  } catch (err) {
    // M-2: no PHI in logs (metadata contains only sectionId).
    logger.error(
      {
        err: err instanceof Error ? err : new Error(String(err)),
        source: 'action_update_section_style',
        errorType: 'style_prefs_save_failed',
        userId: session.userId,
        sectionId: parsed.data.sectionId,
      },
      'Update section style failed',
    );
    return { success: false, error: 'style_prefs_save_failed' };
  }
}
