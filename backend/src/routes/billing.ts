import { Router, raw } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { billingService } from '../services/billing-service.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const billingRouter = Router();

// Validation schemas
const checkoutSchema = z.object({
  priceId: z.string().min(1),
});

// POST /billing/checkout - Create Stripe checkout session
billingRouter.post('/checkout', requireAuth, requireCsrf, async (req, res, next) => {
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
billingRouter.post('/portal', requireAuth, requireCsrf, async (req, res, next) => {
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

      await billingService.handleWebhook(req.body, signature);

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);
