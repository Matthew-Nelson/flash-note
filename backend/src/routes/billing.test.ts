import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';

// Mock middleware to pass through
vi.mock('../middleware/auth.js', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: NextFunction) => next(),
}));

vi.mock('../middleware/csrf.js', () => ({
  requireCsrf: (_req: unknown, _res: unknown, next: NextFunction) => next(),
}));

vi.mock('../middleware/email-verification.js', () => ({
  requireEmailVerification: (_req: unknown, _res: unknown, next: NextFunction) => next(),
}));

// Mock billing service
const mockCreateCheckoutSession = vi.fn();

vi.mock('../services/billing-service.js', () => ({
  billingService: {
    createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args),
    createPortalSession: vi.fn(),
    handleWebhook: vi.fn(),
  },
}));

// Mock config with valid price IDs
vi.mock('../config.js', () => ({
  config: {
    STRIPE_SECRET_KEY: 'sk_test_mock',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_mock',
    WEB_URL: 'http://localhost:3000',
    STRIPE_PRICE_MONTHLY: 'price_monthly_123',
    STRIPE_PRICE_ANNUAL: 'price_annual_456',
  },
}));

import express from 'express';
import request from 'supertest';
import { ZodError } from 'zod';
import { billingRouter } from './billing.js';

function createApp(router: typeof billingRouter) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as AuthenticatedRequest).user = {
      userId: 'test-user-id',
      email: 'test@example.com',
      tokenVersion: 1,
    };
    next();
  });
  app.use('/billing', router);
  // Error handler that matches real app behavior for ZodError
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'validation_error', message: 'Invalid request data' },
      });
      return;
    }
    const status = (err as Error & { statusCode?: number }).statusCode || 500;
    res.status(status).json({
      success: false,
      error: { code: 'internal_error', message: err.message },
    });
  });
  return app;
}

describe('POST /billing/checkout - price validation', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp(billingRouter);
    mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/session');
  });

  it('should accept valid monthly price ID', async () => {
    const res = await request(app)
      .post('/billing/checkout')
      .send({ priceId: 'price_monthly_123' });

    expect(res.status).toBe(200);
    expect(mockCreateCheckoutSession).toHaveBeenCalled();
  });

  it('should accept valid annual price ID', async () => {
    const res = await request(app)
      .post('/billing/checkout')
      .send({ priceId: 'price_annual_456' });

    expect(res.status).toBe(200);
    expect(mockCreateCheckoutSession).toHaveBeenCalled();
  });

  it('should reject invalid price ID', async () => {
    const res = await request(app)
      .post('/billing/checkout')
      .send({ priceId: 'price_attacker_789' });

    expect(res.status).toBe(400);
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it('should reject empty priceId', async () => {
    const res = await request(app)
      .post('/billing/checkout')
      .send({ priceId: '' });

    expect(res.status).toBe(400);
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it('should reject missing priceId', async () => {
    const res = await request(app)
      .post('/billing/checkout')
      .send({});

    expect(res.status).toBe(400);
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });
});

describe('H-1: fail-closed when no price IDs configured', () => {
  it('should reject all price IDs when env vars are missing', async () => {
    // Reset modules to force re-evaluation of module-level allowedPriceIds
    vi.resetModules();

    vi.doMock('../config.js', () => ({
      config: {
        STRIPE_SECRET_KEY: 'sk_test_mock',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_mock',
        WEB_URL: 'http://localhost:3000',
        // Both price IDs undefined — should fail closed (H-1)
      },
    }));

    vi.doMock('../middleware/auth.js', () => ({
      requireAuth: (_req: unknown, _res: unknown, next: NextFunction) => next(),
    }));
    vi.doMock('../middleware/csrf.js', () => ({
      requireCsrf: (_req: unknown, _res: unknown, next: NextFunction) => next(),
    }));
    vi.doMock('../middleware/email-verification.js', () => ({
      requireEmailVerification: (_req: unknown, _res: unknown, next: NextFunction) => next(),
    }));
    vi.doMock('../services/billing-service.js', () => ({
      billingService: {
        createCheckoutSession: vi.fn(),
        createPortalSession: vi.fn(),
        handleWebhook: vi.fn(),
      },
    }));

    const { billingRouter: freshRouter } = await import('./billing.js');

    const app = createApp(freshRouter);

    const res = await request(app)
      .post('/billing/checkout')
      .send({ priceId: 'price_monthly_123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });
});
