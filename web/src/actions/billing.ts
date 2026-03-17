'use server';

import { z } from 'zod';

import { getSession } from '@/server/lib/get-session';
import { logger } from '@/server/lib/logger';
import { getBillingService, SubscriptionExistsError } from '@/server/services/billing';
import { checkRateLimit, checkoutRateLimit, portalRateLimit } from '@/server/lib/rate-limit';
import { config } from '@/server/db/config';
import type { ActionResult } from '@/lib/types/actions';

// H-1: Fail-closed price ID validation — computed at module load.
// If no price IDs are configured, ALL checkout attempts are rejected.
const allowedPriceIds: string[] = [
  config.STRIPE_PRICE_MONTHLY,
  config.STRIPE_PRICE_ANNUAL,
].filter((id): id is string => typeof id === 'string' && id.startsWith('price_'));

const checkoutSchema = z.object({
  priceId: z
    .string()
    .min(1)
    .refine(
      (id) => (allowedPriceIds.length === 0 ? false : allowedPriceIds.includes(id)),
      { message: 'Invalid price ID' }
    ),
});

/**
 * Create a Stripe checkout session.
 * Returns the checkout URL for client-side redirect.
 *
 * Security:
 * - Session required (email verified enforced server-side)
 * - Price ID validated against allowlist (H-1)
 * - Duplicate subscription blocked (H-2, in billing service)
 */
export async function createCheckoutAction(
  formData: FormData
): Promise<ActionResult<{ checkoutUrl: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: 'unauthenticated' };
  if (!session.emailVerified) return { success: false, error: 'email_not_verified' };

  const raw = Object.fromEntries(formData);
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: 'invalid_price_id' };

  // Rate limit by userId (authenticated endpoint)
  const rl = await checkRateLimit(checkoutRateLimit, session.userId);
  if (!rl.success) {
    return { success: false, error: 'rate_limit_exceeded' };
  }

  try {
    const checkoutUrl = await getBillingService().createCheckoutSession(
      session.userId,
      session.email,
      parsed.data.priceId
    );
    return { success: true, data: { checkoutUrl } };
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : new Error(String(error)), source: 'action_checkout', errorType: 'checkout_failed', userId: session.userId }, 'createCheckoutAction failed');
    if (error instanceof SubscriptionExistsError) {
      return { success: false, error: 'subscription_exists' };
    }
    return { success: false, error: 'billing_error' };
  }
}

/**
 * Create a Stripe customer portal session.
 * Returns the portal URL for client-side redirect.
 */
export async function createPortalAction(): Promise<ActionResult<{ portalUrl: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: 'unauthenticated' };
  if (!session.emailVerified) return { success: false, error: 'email_not_verified' };

  const rl = await checkRateLimit(portalRateLimit, session.userId);
  if (!rl.success) {
    return { success: false, error: 'rate_limit_exceeded' };
  }

  try {
    const portalUrl = await getBillingService().createPortalSession(session.userId);
    return { success: true, data: { portalUrl } };
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : new Error(String(error)), source: 'action_portal', errorType: 'portal_failed', userId: session.userId }, 'createPortalAction failed');
    return { success: false, error: 'billing_error' };
  }
}
