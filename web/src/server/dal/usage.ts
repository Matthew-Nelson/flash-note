import 'server-only';

import { db } from '@/server/db';
import { findActiveMembership } from './organization-members';
import { findOrganizationById } from './organizations';

export interface UsageData {
  currentMonth: string;
  notesGenerated: number;
  organization: { name: string; role: string } | null;
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
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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
