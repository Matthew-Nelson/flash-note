import { Router, raw } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { requireEmailVerification } from '../middleware/email-verification.js';
import { billingService } from '../services/billing-service.js';
import { config } from '../config.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const billingRouter: Router = Router();

// SECURITY: Only allow configured Stripe price IDs to prevent arbitrary price attacks
// If price env vars aren't configured, validation is skipped (development mode)
const allowedPriceIds: string[] = [
  config.STRIPE_PRICE_MONTHLY,
  config.STRIPE_PRICE_ANNUAL,
].filter((id): id is string => typeof id === 'string' && id.startsWith('price_'));

// Validation schemas
const checkoutSchema = z.object({
  priceId: z.string().min(1).refine(
    (id) => {
      // If no valid price IDs configured, allow any (development mode)
      if (allowedPriceIds.length === 0) {
        return true;
      }
      return allowedPriceIds.includes(id);
    },
    { message: 'Invalid price ID' }
  ),
});

// POST /billing/checkout - Create Stripe checkout session
// Requires email verification to prevent abuse with unverified accounts
billingRouter.post('/checkout', requireAuth, requireCsrf, requireEmailVerification, async (req, res, next) => {
  try {
    const { priceId } = checkoutSchema.parse(req.body);
    const { userId, email } = (req as AuthenticatedRequest).user;

    const checkoutUrl = await billingService.createCheckoutSession(
      userId,
      email,
      priceId
    );

    res.json({
      success: true,
      data: { checkoutUrl },
    });
  } catch (error) {
    next(error);
  }
});

// POST /billing/portal - Create Stripe customer portal session
// Requires email verification to prevent abuse with unverified accounts
billingRouter.post('/portal', requireAuth, requireCsrf, requireEmailVerification, async (req, res, next) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;

    const portalUrl = await billingService.createPortalSession(userId);

    res.json({
      success: true,
      data: { portalUrl },
    });
  } catch (error) {
    next(error);
  }
});

// POST /billing/webhook - Stripe webhook handler
// Note: Must use raw body for signature verification
billingRouter.post(
  '/webhook',
  raw({ type: 'application/json' }),
  async (req, res, next) => {
    try {
      const signature = req.headers['stripe-signature'] as string;

      await billingService.handleWebhook(req.body as Buffer, signature);

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);
