import 'server-only';

import { db } from '@/server/db';
import { logger } from '@/server/lib/logger';
import { findActiveMembership } from './organization-members';
import { findOrganizationById } from './organizations';

export interface UsageData {
  currentMonth: string;
  notesGenerated: number;
  organization: { name: string; role: string } | null;
}

/**
 * Returns the current month as YYYY-MM (e.g., "2026-02").
 * Shared between getUsageForUser and incrementUsage.
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get usage data for a user in the current month.
 *
 * Includes organization context when the user has an active membership.
 * The organizationId parameter gates the org lookup — when null, the
 * (potentially expensive) membership + org queries are skipped entirely.
 */
export async function getUsageForUser(
  userId: string,
  /** Used as a boolean gate: when non-null, triggers the active membership + org lookup.
   *  The actual org ID for the lookup comes from the membership record (defense-in-depth
   *  against stale users.organization_id). */
  organizationId: string | null
): Promise<UsageData> {
  const currentMonth = getCurrentMonth();

  const result = await db.query<{ notes_generated: number }>(
    'SELECT notes_generated FROM usage WHERE user_id = $1 AND month = $2',
    [userId, currentMonth]
  );

  const notesGenerated = result.rows.length > 0 ? result.rows[0].notes_generated : 0;

  // Skip org lookup entirely when user has no org (efficient path).
  // When organizationId is set, verify active membership as defense-in-depth
  // (organizationId on user table could be stale if membership was soft-deleted).
  let organization: { name: string; role: string } | null = null;
  if (organizationId) {
    const membership = await findActiveMembership(userId);
    if (membership) {
      const org = await findOrganizationById(membership.organizationId);
      if (org) {
        organization = { name: org.name, role: membership.role };
      }
    }
  }

  return { currentMonth, notesGenerated, organization };
}

/**
 * Increment usage counters for a note generation.
 *
 * Uses UPSERT to atomically create or update the usage row for the current month.
 * Failures are swallowed and logged — usage tracking must never break note generation.
 */
export async function incrementUsage(
  userId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const month = getCurrentMonth();

  try {
    await db.query(
      `INSERT INTO usage (user_id, month, notes_generated, input_tokens, output_tokens)
       VALUES ($1, $2, 1, $3, $4)
       ON CONFLICT (user_id, month)
       DO UPDATE SET
         notes_generated = usage.notes_generated + 1,
         input_tokens = usage.input_tokens + EXCLUDED.input_tokens,
         output_tokens = usage.output_tokens + EXCLUDED.output_tokens,
         updated_at = NOW()`,
      [userId, month, inputTokens, outputTokens]
    );
  } catch (error) {
    // Don't throw — usage tracking failures must not break note generation
    logger.error({ err: error instanceof Error ? error : new Error(String(error)), source: 'dal_usage', errorType: 'usage_tracking_failed', userId }, 'Usage tracking failed');
  }
}
