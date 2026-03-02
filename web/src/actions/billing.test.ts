import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SessionData } from '@/server/types';

// --- vi.hoisted mocks ---

const mockGetSession = vi.hoisted(() => vi.fn());
const mockCreateCheckoutSession = vi.hoisted(() => vi.fn());
const mockCreatePortalSession = vi.hoisted(() => vi.fn());

// Hoist the error classes so they're available in both the mock factory and test assertions.
// These are real classes (not mocked) so instanceof checks work correctly.
const { SubscriptionExistsError } = vi.hoisted(() => {
  class SubscriptionExistsError extends Error {
    constructor() {
      super('User already has an active subscription');
      this.name = 'SubscriptionExistsError';
    }
  }
  return { SubscriptionExistsError };
});

vi.mock('@/server/lib/get-session', () => ({
  getSession: mockGetSession,
}));

vi.mock('@/server/services/billing', () => ({
  getBillingService: () => ({
    createCheckoutSession: mockCreateCheckoutSession,
    createPortalSession: mockCreatePortalSession,
  }),
  SubscriptionExistsError,
}));

vi.mock('@/server/db/config', () => ({
  config: {
    STRIPE_PRICE_MONTHLY: 'price_monthly_test',
    STRIPE_PRICE_ANNUAL: 'price_annual_test',
  },
}));

// Import actions after all mocks are set
const { createCheckoutAction, createPortalAction } = await import('./billing');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    email: 'test@example.com',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    emailVerified: true,
    organizationId: null,
    ...overrides,
  };
}

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const defaults: Record<string, string> = {
    priceId: 'price_monthly_test',
    ...overrides,
  };
  for (const [key, value] of Object.entries(defaults)) {
    data.set(key, value);
  }
  return data;
}

// ---------------------------------------------------------------------------
// createCheckoutAction tests
// ---------------------------------------------------------------------------

describe('createCheckoutAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns unauthenticated when no session', async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await createCheckoutAction(makeFormData());

    expect(result).toEqual({ success: false, error: 'unauthenticated' });
  });

  it('returns email_not_verified when email not verified', async () => {
    mockGetSession.mockResolvedValue(createSession({ emailVerified: false }));

    const result = await createCheckoutAction(makeFormData());

    expect(result).toEqual({ success: false, error: 'email_not_verified' });
  });

  it('returns invalid_price_id for empty priceId', async () => {
    mockGetSession.mockResolvedValue(createSession());

    const result = await createCheckoutAction(makeFormData({ priceId: '' }));

    expect(result).toEqual({ success: false, error: 'invalid_price_id' });
  });

  it('returns invalid_price_id for price ID not in allowlist', async () => {
    mockGetSession.mockResolvedValue(createSession());

    const result = await createCheckoutAction(makeFormData({ priceId: 'price_bogus' }));

    expect(result).toEqual({ success: false, error: 'invalid_price_id' });
  });

  it('returns success with checkoutUrl on success', async () => {
    mockGetSession.mockResolvedValue(createSession());
    mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/sess');

    const result = await createCheckoutAction(makeFormData());

    expect(result).toEqual({
      success: true,
      data: { checkoutUrl: 'https://checkout.stripe.com/sess' },
    });
  });

  it('calls billingService with correct args', async () => {
    const session = createSession();
    mockGetSession.mockResolvedValue(session);
    mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/sess');

    await createCheckoutAction(makeFormData({ priceId: 'price_annual_test' }));

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      'user-1',
      'test@example.com',
      'price_annual_test'
    );
  });

  it('returns subscription_exists when SubscriptionExistsError thrown (instanceof check)', async () => {
    mockGetSession.mockResolvedValue(createSession());
    mockCreateCheckoutSession.mockRejectedValue(new SubscriptionExistsError());

    const result = await createCheckoutAction(makeFormData());

    expect(result).toEqual({ success: false, error: 'subscription_exists' });
  });

  it('returns billing_error for generic billing service errors', async () => {
    mockGetSession.mockResolvedValue(createSession());
    mockCreateCheckoutSession.mockRejectedValue(new Error('Stripe API error'));

    const result = await createCheckoutAction(makeFormData());

    expect(result).toEqual({ success: false, error: 'billing_error' });
  });
});

// ---------------------------------------------------------------------------
// createPortalAction tests
// ---------------------------------------------------------------------------

describe('createPortalAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns unauthenticated when no session', async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await createPortalAction();

    expect(result).toEqual({ success: false, error: 'unauthenticated' });
  });

  it('returns success with portalUrl on success', async () => {
    mockGetSession.mockResolvedValue(createSession());
    mockCreatePortalSession.mockResolvedValue('https://billing.stripe.com/portal');

    const result = await createPortalAction();

    expect(result).toEqual({
      success: true,
      data: { portalUrl: 'https://billing.stripe.com/portal' },
    });
  });

  it('calls billingService.createPortalSession with userId', async () => {
    const session = createSession();
    mockGetSession.mockResolvedValue(session);
    mockCreatePortalSession.mockResolvedValue('https://billing.stripe.com/portal');

    await createPortalAction();

    expect(mockCreatePortalSession).toHaveBeenCalledWith('user-1');
  });

  it('returns billing_error when service throws', async () => {
    mockGetSession.mockResolvedValue(createSession());
    mockCreatePortalSession.mockRejectedValue(new Error('Portal error'));

    const result = await createPortalAction();

    expect(result).toEqual({ success: false, error: 'billing_error' });
  });
});

// ---------------------------------------------------------------------------
// H-1: price ID allowlist behavior
// ---------------------------------------------------------------------------

describe('H-1: price ID allowlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('accepts STRIPE_PRICE_MONTHLY from config', async () => {
    mockGetSession.mockResolvedValue(createSession());
    mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/sess');

    const result = await createCheckoutAction(makeFormData({ priceId: 'price_monthly_test' }));

    expect(result.success).toBe(true);
  });

  it('accepts STRIPE_PRICE_ANNUAL from config', async () => {
    mockGetSession.mockResolvedValue(createSession());
    mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/sess');

    const result = await createCheckoutAction(makeFormData({ priceId: 'price_annual_test' }));

    expect(result.success).toBe(true);
  });

  it('rejects price IDs not in allowlist', async () => {
    mockGetSession.mockResolvedValue(createSession());

    const result = await createCheckoutAction(makeFormData({ priceId: 'price_unknown' }));

    expect(result).toEqual({ success: false, error: 'invalid_price_id' });
  });
});
