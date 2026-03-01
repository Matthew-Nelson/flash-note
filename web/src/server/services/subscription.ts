import 'server-only';

import { getOrgSubscription } from '@/server/dal/organizations';
import type { SessionData } from '@/server/types';

export type SubscriptionCheckResult =
  | { allowed: true }
  | { allowed: false; reason: 'trial_expired' | 'subscription_required' | 'clinic_subscription_expired' };

/**
 * Check whether a user has an active subscription (individual or org-level).
 *
 * Logic mirrors backend/src/middleware/subscription.ts:67-164:
 * 1. Individual active → allowed
 * 2. Individual trialing + valid → allowed
 * 3. Individual check failed + has org → check org subscription
 * 4. All checks failed → return denial reason
 */
export async function checkSubscriptionAccess(session: SessionData): Promise<SubscriptionCheckResult> {
  // 1. Individual active subscription
  if (session.subscriptionStatus === 'active') {
    return { allowed: true };
  }

  // 2. Individual trial still valid
  if (session.subscriptionStatus === 'trialing' && new Date() < session.trialEndsAt) {
    return { allowed: true };
  }

  // 3. Individual check failed — try org fallback
  if (session.organizationId) {
    const orgSub = await getOrgSubscription(session.organizationId, session.userId);

    if (orgSub) {
      if (orgSub.subscription_status === 'active') {
        return { allowed: true };
      }
      if (orgSub.subscription_status === 'trialing' && orgSub.trial_ends_at && new Date() < orgSub.trial_ends_at) {
        return { allowed: true };
      }
      // Org exists but subscription lapsed
      return { allowed: false, reason: 'clinic_subscription_expired' };
    }
  }

  // 4. Both individual and org checks failed
  if (session.subscriptionStatus === 'trialing') {
    return { allowed: false, reason: 'trial_expired' };
  }

  return { allowed: false, reason: 'subscription_required' };
}
