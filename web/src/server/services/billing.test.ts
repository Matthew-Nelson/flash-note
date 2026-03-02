import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';

// --- vi.hoisted mocks (must be before vi.mock factories) ---

const {
  mockStripeCheckoutCreate,
  mockStripeBillingPortalCreate,
  mockStripeWebhooksConstructEvent,
  mockStripeSubscriptionsRetrieve,
} = vi.hoisted(() => ({
  mockStripeCheckoutCreate: vi.fn(),
  mockStripeBillingPortalCreate: vi.fn(),
  mockStripeWebhooksConstructEvent: vi.fn(),
  mockStripeSubscriptionsRetrieve: vi.fn(),
}));

const {
  mockFindUserById,
  mockUpdateUserSubscription,
  mockUpdateSubscriptionStatus,
} = vi.hoisted(() => ({
  mockFindUserById: vi.fn(),
  mockUpdateUserSubscription: vi.fn(),
  mockUpdateSubscriptionStatus: vi.fn(),
}));

const {
  mockTryMarkWebhookProcessed,
  mockDeleteProcessedWebhookEvent,
} = vi.hoisted(() => ({
  mockTryMarkWebhookProcessed: vi.fn(),
  mockDeleteProcessedWebhookEvent: vi.fn(),
}));

const { mockAuditLog } = vi.hoisted(() => ({
  mockAuditLog: vi.fn(),
}));

// Mock Stripe — must use a class to work with `new Stripe()`
vi.mock('stripe', () => ({
  default: class MockStripe {
    checkout = { sessions: { create: mockStripeCheckoutCreate } };
    billingPortal = { sessions: { create: mockStripeBillingPortalCreate } };
    webhooks = { constructEvent: mockStripeWebhooksConstructEvent };
    subscriptions = { retrieve: mockStripeSubscriptionsRetrieve };
  },
}));

vi.mock('@/server/db/config', () => ({
  config: {
    STRIPE_SECRET_KEY: 'sk_test_mock',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_mock',
    WEB_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/server/dal/users', () => ({
  findUserById: mockFindUserById,
  updateUserSubscription: mockUpdateUserSubscription,
  updateSubscriptionStatus: mockUpdateSubscriptionStatus,
}));

vi.mock('@/server/dal/webhooks', () => ({
  tryMarkWebhookProcessed: mockTryMarkWebhookProcessed,
  deleteProcessedWebhookEvent: mockDeleteProcessedWebhookEvent,
}));

vi.mock('@/server/services/audit', () => ({
  auditService: { log: mockAuditLog },
}));

vi.mock('@/server/types', () => ({
  AuditAction: {
    SUBSCRIPTION_CREATED: 'SUBSCRIPTION_CREATED',
    SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
    SUBSCRIPTION_RENEWED: 'SUBSCRIPTION_RENEWED',
    PAYMENT_FAILED: 'PAYMENT_FAILED',
    WEBHOOK_PROCESSING_FAILED: 'WEBHOOK_PROCESSING_FAILED',
  },
}));

// Import after mocking
const { getBillingService, WebhookSignatureError, SubscriptionExistsError, BillingError } =
  await import('./billing');
const billingService = getBillingService();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-123',
    subscriptionStatus: 'trialing',
    stripeCustomerId: null,
    subscriptionId: null,
    ...overrides,
  };
}

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-123',
    billing_reason: null,
    parent: {
      subscription_details: {
        subscription: 'sub-123',
      },
    },
    ...overrides,
  };
}

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-123',
    status: 'active',
    metadata: { userId: 'user-123' },
    ...overrides,
  };
}

function makeEvent(type: string, dataObject: unknown): unknown {
  return {
    id: 'evt-123',
    type,
    data: { object: dataObject },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BillingService', () => {
  let consoleErrorSpy: MockInstance;
  let consoleLogSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTryMarkWebhookProcessed.mockResolvedValue(true);
    mockDeleteProcessedWebhookEvent.mockResolvedValue(undefined);
    mockAuditLog.mockResolvedValue(undefined);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // createCheckoutSession
  // -------------------------------------------------------------------------

  describe('createCheckoutSession', () => {
    beforeEach(() => {
      mockFindUserById.mockResolvedValue(makeUser());
    });

    it('creates a checkout session and returns the URL', async () => {
      mockStripeCheckoutCreate.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session123',
      });

      const url = await billingService.createCheckoutSession(
        'user-123',
        'test@example.com',
        'price_monthly'
      );

      expect(url).toBe('https://checkout.stripe.com/session123');
    });

    it('passes correct parameters when no existing customer', async () => {
      mockStripeCheckoutCreate.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session123',
      });

      await billingService.createCheckoutSession(
        'user-123',
        'test@example.com',
        'price_monthly'
      );

      expect(mockStripeCheckoutCreate).toHaveBeenCalledWith({
        customer_email: 'test@example.com',
        mode: 'subscription',
        line_items: [{ price: 'price_monthly', quantity: 1 }],
        success_url: expect.stringContaining('/dashboard?success=true'),
        cancel_url: expect.stringContaining('/pricing?canceled=true'),
        allow_promotion_codes: true,
        metadata: { userId: 'user-123' },
        subscription_data: { metadata: { userId: 'user-123' } },
      });
    });

    it('uses existing Stripe customer when stripeCustomerId present', async () => {
      mockFindUserById.mockResolvedValue(
        makeUser({ stripeCustomerId: 'cus_existing' })
      );
      mockStripeCheckoutCreate.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session123',
      });

      await billingService.createCheckoutSession(
        'user-123',
        'test@example.com',
        'price_monthly'
      );

      expect(mockStripeCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_existing' })
      );
      expect(mockStripeCheckoutCreate).not.toHaveBeenCalledWith(
        expect.objectContaining({ customer_email: expect.anything() })
      );
    });

    it('throws BillingError when user not found', async () => {
      mockFindUserById.mockResolvedValue(null);

      await expect(
        billingService.createCheckoutSession('user-123', 'test@example.com', 'price_monthly')
      ).rejects.toThrow(BillingError);
    });

    it('throws BillingError with user_not_found code when user not found', async () => {
      mockFindUserById.mockResolvedValue(null);

      await expect(
        billingService.createCheckoutSession('user-123', 'test@example.com', 'price_monthly')
      ).rejects.toMatchObject({ code: 'user_not_found' });
    });

    it('throws SubscriptionExistsError when user has existing subscription (H-2)', async () => {
      mockFindUserById.mockResolvedValue(makeUser({ subscriptionId: 'sub_existing' }));

      await expect(
        billingService.createCheckoutSession('user-123', 'test@example.com', 'price_monthly')
      ).rejects.toThrow(SubscriptionExistsError);
    });

    it('throws SubscriptionExistsError for past_due user with existing subscription (H-2)', async () => {
      mockFindUserById.mockResolvedValue(makeUser({
        subscriptionStatus: 'past_due',
        subscriptionId: 'sub_existing',
      }));

      await expect(
        billingService.createCheckoutSession('user-123', 'test@example.com', 'price_monthly')
      ).rejects.toThrow(SubscriptionExistsError);
    });

    it('throws BillingError when Stripe returns no URL', async () => {
      mockStripeCheckoutCreate.mockResolvedValueOnce({ url: null });

      await expect(
        billingService.createCheckoutSession('user-123', 'test@example.com', 'price_monthly')
      ).rejects.toThrow(BillingError);
    });

    it('propagates Stripe API errors', async () => {
      mockStripeCheckoutCreate.mockRejectedValueOnce(new Error('Stripe error'));

      await expect(
        billingService.createCheckoutSession('user-123', 'test@example.com', 'price_monthly')
      ).rejects.toThrow('Stripe error');
    });
  });

  // -------------------------------------------------------------------------
  // createPortalSession
  // -------------------------------------------------------------------------

  describe('createPortalSession', () => {
    it('creates portal session and returns URL', async () => {
      mockFindUserById.mockResolvedValue(makeUser({ stripeCustomerId: 'cus_123' }));
      mockStripeBillingPortalCreate.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/portal123',
      });

      const url = await billingService.createPortalSession('user-123');

      expect(url).toBe('https://billing.stripe.com/portal123');
      expect(mockStripeBillingPortalCreate).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: 'http://localhost:3000/dashboard',
      });
    });

    it('throws BillingError when no stripeCustomerId', async () => {
      mockFindUserById.mockResolvedValue(makeUser({ stripeCustomerId: null }));

      await expect(
        billingService.createPortalSession('user-123')
      ).rejects.toThrow(BillingError);
    });

    it('throws BillingError when user not found', async () => {
      mockFindUserById.mockResolvedValue(null);

      await expect(
        billingService.createPortalSession('user-123')
      ).rejects.toThrow(BillingError);
    });
  });

  // -------------------------------------------------------------------------
  // handleWebhook — signature verification
  // -------------------------------------------------------------------------

  describe('handleWebhook — signature verification', () => {
    it('throws BillingError with missing_webhook_secret when STRIPE_WEBHOOK_SECRET not configured', async () => {
      const { config } = await import('@/server/db/config');
      const original = config.STRIPE_WEBHOOK_SECRET;
      config.STRIPE_WEBHOOK_SECRET = undefined;

      try {
        await expect(
          billingService.handleWebhook(Buffer.from('{}'), 'sig')
        ).rejects.toMatchObject({ code: 'missing_webhook_secret' });
      } finally {
        config.STRIPE_WEBHOOK_SECRET = original;
      }
    });

    it('throws WebhookSignatureError when signature invalid (Rule 6)', async () => {
      mockStripeWebhooksConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const body = Buffer.from('{"type":"test"}');
      await expect(
        billingService.handleWebhook(body, 'bad-signature')
      ).rejects.toBeInstanceOf(WebhookSignatureError);
    });

    it('WebhookSignatureError is discriminated with instanceof (Rule 6)', async () => {
      mockStripeWebhooksConstructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature');
      });

      try {
        await billingService.handleWebhook(Buffer.from('{}'), 'bad-sig');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(WebhookSignatureError);
      }
    });
  });

  // -------------------------------------------------------------------------
  // handleWebhook — idempotency
  // -------------------------------------------------------------------------

  describe('handleWebhook — idempotency', () => {
    it('skips duplicate events (tryMarkWebhookProcessed returns false)', async () => {
      const event = makeEvent('checkout.session.completed', {});
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockTryMarkWebhookProcessed.mockResolvedValue(false);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateUserSubscription).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('duplicate'));
    });
  });

  // -------------------------------------------------------------------------
  // handleWebhook — event routing
  // -------------------------------------------------------------------------

  describe('handleWebhook — event routing', () => {
    it('routes checkout.session.completed to handleCheckoutComplete', async () => {
      const session = {
        id: 'cs_123',
        customer: 'cus_123',
        subscription: 'sub_123',
        metadata: { userId: 'user-123' },
      };
      const event = makeEvent('checkout.session.completed', session);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockUpdateUserSubscription.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateUserSubscription).toHaveBeenCalledWith(
        'user-123', 'cus_123', 'sub_123', 'active'
      );
    });

    it('routes customer.subscription.updated to handleSubscriptionUpdate', async () => {
      const subscription = makeSubscription({ status: 'past_due' });
      const event = makeEvent('customer.subscription.updated', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockUpdateSubscriptionStatus.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', 'past_due');
    });

    it('routes customer.subscription.deleted to handleSubscriptionDelete', async () => {
      const subscription = makeSubscription({ status: 'canceled' });
      const event = makeEvent('customer.subscription.deleted', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockUpdateSubscriptionStatus.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', 'canceled');
    });

    it('routes invoice.paid to handleInvoicePaid', async () => {
      const invoice = makeInvoice({ billing_reason: 'subscription_cycle' });
      const event = makeEvent('invoice.paid', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(
        makeSubscription({ status: 'past_due' })
      );
      mockFindUserById.mockResolvedValue(makeUser({ subscriptionStatus: 'past_due' }));
      mockUpdateSubscriptionStatus.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', 'active');
    });

    it('routes invoice.payment_failed to handleInvoicePaymentFailed', async () => {
      const invoice = makeInvoice();
      const event = makeEvent('invoice.payment_failed', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(makeSubscription());
      mockUpdateSubscriptionStatus.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', 'past_due');
    });

    it('on handler failure: deletes idempotency record and re-throws (CR-1)', async () => {
      const subscription = makeSubscription({ status: 'past_due' });
      const event = makeEvent('customer.subscription.updated', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockUpdateSubscriptionStatus.mockRejectedValue(new Error('DB error'));

      await expect(
        billingService.handleWebhook(Buffer.from('{}'), 'sig')
      ).rejects.toThrow('DB error');

      expect(mockDeleteProcessedWebhookEvent).toHaveBeenCalledWith('evt-123');
    });

    it('on handler failure + cleanup failure: still re-throws', async () => {
      const subscription = makeSubscription({ status: 'past_due' });
      const event = makeEvent('customer.subscription.updated', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockUpdateSubscriptionStatus.mockRejectedValue(new Error('DB error'));
      mockDeleteProcessedWebhookEvent.mockRejectedValue(new Error('Cleanup failed'));

      await expect(
        billingService.handleWebhook(Buffer.from('{}'), 'sig')
      ).rejects.toThrow('DB error');
    });
  });

  // -------------------------------------------------------------------------
  // handleCheckoutComplete
  // -------------------------------------------------------------------------

  describe('handleCheckoutComplete', () => {
    it('updates subscription and calls auditService.log with SUBSCRIPTION_CREATED', async () => {
      const session = {
        id: 'cs_123',
        customer: 'cus_123',
        subscription: 'sub_123',
        metadata: { userId: 'user-123' },
      };
      const event = makeEvent('checkout.session.completed', session);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockUpdateUserSubscription.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateUserSubscription).toHaveBeenCalledWith(
        'user-123', 'cus_123', 'sub_123', 'active'
      );
      // Fire-and-forget — called (not awaited), verify it was scheduled
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBSCRIPTION_CREATED', status: 'SUCCESS' })
      );
    });

    it('skips when userId missing from metadata', async () => {
      const session = { id: 'cs_123', customer: 'cus_123', metadata: {} };
      const event = makeEvent('checkout.session.completed', session);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateUserSubscription).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('userId'),
        expect.anything()
      );
    });

    it('skips when userId in metadata is not a valid UUID (Rule 3 — validateMetadataUserId)', async () => {
      const session = {
        id: 'cs_123',
        customer: 'cus_123',
        subscription: 'sub_123',
        metadata: { userId: 'invalid-not-a-uuid' },
      };
      const event = makeEvent('checkout.session.completed', session);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateUserSubscription).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('userId'),
        expect.anything()
      );
    });

    it('skips when customer is null (Rule 3 — runtime validation)', async () => {
      const session = {
        id: 'cs_123',
        customer: null,
        subscription: 'sub_123',
        metadata: { userId: 'user-123' },
      };
      const event = makeEvent('checkout.session.completed', session);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateUserSubscription).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing customer or subscription'),
        expect.anything()
      );
    });

    it('skips when subscription is null (Rule 3 — runtime validation)', async () => {
      const session = {
        id: 'cs_123',
        customer: 'cus_123',
        subscription: null,
        metadata: { userId: 'user-123' },
      };
      const event = makeEvent('checkout.session.completed', session);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateUserSubscription).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing customer or subscription'),
        expect.anything()
      );
    });

    it('extracts ID from expanded customer object (Rule 3)', async () => {
      const session = {
        id: 'cs_123',
        customer: { id: 'cus_expanded' },
        subscription: 'sub_123',
        metadata: { userId: 'user-123' },
      };
      const event = makeEvent('checkout.session.completed', session);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockUpdateUserSubscription.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateUserSubscription).toHaveBeenCalledWith(
        'user-123', 'cus_expanded', 'sub_123', 'active'
      );
    });

    it('extracts ID from expanded subscription object (Rule 3)', async () => {
      const session = {
        id: 'cs_123',
        customer: 'cus_123',
        subscription: { id: 'sub_expanded' },
        metadata: { userId: 'user-123' },
      };
      const event = makeEvent('checkout.session.completed', session);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockUpdateUserSubscription.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateUserSubscription).toHaveBeenCalledWith(
        'user-123', 'cus_123', 'sub_expanded', 'active'
      );
    });
  });

  // -------------------------------------------------------------------------
  // handleSubscriptionUpdate
  // -------------------------------------------------------------------------

  describe('handleSubscriptionUpdate', () => {
    it('updates status for valid statuses', async () => {
      for (const status of ['trialing', 'active', 'canceled', 'past_due', 'unpaid']) {
        vi.clearAllMocks();
        mockTryMarkWebhookProcessed.mockResolvedValue(true);
        mockUpdateSubscriptionStatus.mockResolvedValue(undefined);

        const subscription = makeSubscription({ status });
        const event = makeEvent('customer.subscription.updated', subscription);
        mockStripeWebhooksConstructEvent.mockReturnValue(event);

        await billingService.handleWebhook(Buffer.from('{}'), 'sig');

        expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', status);
      }
    });

    it('skips unknown Stripe statuses and logs error', async () => {
      const subscription = makeSubscription({ status: 'paused' });
      const event = makeEvent('customer.subscription.updated', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown Stripe subscription status'),
        expect.anything()
      );
    });

    it('skips when userId missing', async () => {
      const subscription = makeSubscription({ metadata: {} });
      const event = makeEvent('customer.subscription.updated', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('skips when userId in metadata is not a valid UUID (Rule 3 — validateMetadataUserId)', async () => {
      // Non-UUID userId in metadata should be rejected
      const subscription = makeSubscription({ metadata: { userId: 'not-a-valid-uuid' } });
      const event = makeEvent('customer.subscription.updated', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('userId'),
        expect.anything()
      );
    });

    it('proceeds when userId is a valid UUID (validateMetadataUserId passes)', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const subscription = makeSubscription({ status: 'active', metadata: { userId: validUuid } });
      const event = makeEvent('customer.subscription.updated', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockUpdateSubscriptionStatus.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith(validUuid, 'active');
    });
  });

  // -------------------------------------------------------------------------
  // handleSubscriptionDelete
  // -------------------------------------------------------------------------

  describe('handleSubscriptionDelete', () => {
    it('sets status to canceled and calls auditService.log with SUBSCRIPTION_CANCELLED', async () => {
      const subscription = makeSubscription();
      const event = makeEvent('customer.subscription.deleted', subscription);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockUpdateSubscriptionStatus.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', 'canceled');
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBSCRIPTION_CANCELLED', status: 'SUCCESS' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // handleInvoicePaid
  // -------------------------------------------------------------------------

  describe('handleInvoicePaid', () => {
    it('reactivates from past_due to active', async () => {
      const invoice = makeInvoice({ billing_reason: null });
      const event = makeEvent('invoice.paid', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(makeSubscription());
      mockFindUserById.mockResolvedValue(makeUser({ subscriptionStatus: 'past_due' }));
      mockUpdateSubscriptionStatus.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', 'active');
    });

    it('reactivates from trialing to active', async () => {
      const invoice = makeInvoice({ billing_reason: null });
      const event = makeEvent('invoice.paid', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(makeSubscription());
      mockFindUserById.mockResolvedValue(makeUser({ subscriptionStatus: 'trialing' }));
      mockUpdateSubscriptionStatus.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', 'active');
    });

    it('reactivates from unpaid to active', async () => {
      const invoice = makeInvoice({ billing_reason: null });
      const event = makeEvent('invoice.paid', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(makeSubscription());
      mockFindUserById.mockResolvedValue(makeUser({ subscriptionStatus: 'unpaid' }));
      mockUpdateSubscriptionStatus.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', 'active');
    });

    it('does NOT reactivate canceled subscriptions (H-3)', async () => {
      const invoice = makeInvoice({ billing_reason: null });
      const event = makeEvent('invoice.paid', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(makeSubscription());
      mockFindUserById.mockResolvedValue(makeUser({ subscriptionStatus: 'canceled' }));

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('canceled subscription'),
        expect.anything()
      );
    });

    it('calls auditService.log with SUBSCRIPTION_RENEWED for subscription_cycle billing', async () => {
      const invoice = makeInvoice({ billing_reason: 'subscription_cycle' });
      const event = makeEvent('invoice.paid', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(makeSubscription());
      mockFindUserById.mockResolvedValue(makeUser({ subscriptionStatus: 'past_due' }));
      mockUpdateSubscriptionStatus.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBSCRIPTION_RENEWED', status: 'SUCCESS' })
      );
    });

    it('skips when no subscription ID in invoice', async () => {
      const invoice = { id: 'inv-123', billing_reason: null, parent: null };
      const event = makeEvent('invoice.paid', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockStripeSubscriptionsRetrieve).not.toHaveBeenCalled();
      expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('skips and logs when userId missing from subscription metadata', async () => {
      const invoice = makeInvoice();
      const event = makeEvent('invoice.paid', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(makeSubscription({ metadata: {} }));

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('skips when userId in subscription metadata is not a valid UUID (validateMetadataUserId)', async () => {
      const invoice = makeInvoice();
      const event = makeEvent('invoice.paid', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(
        makeSubscription({ metadata: { userId: 'not-a-uuid-string' } })
      );

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('userId'),
        expect.anything()
      );
    });

    it('skips and logs when user not found', async () => {
      const invoice = makeInvoice();
      const event = makeEvent('invoice.paid', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(makeSubscription());
      mockFindUserById.mockResolvedValue(null);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('non-existent user'),
        expect.anything()
      );
    });

    it('does not call auditService.log with SUBSCRIPTION_RENEWED for non-cycle billing', async () => {
      const invoice = makeInvoice({ billing_reason: 'subscription_create' });
      const event = makeEvent('invoice.paid', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(makeSubscription());
      mockFindUserById.mockResolvedValue(makeUser({ subscriptionStatus: 'past_due' }));
      mockUpdateSubscriptionStatus.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockAuditLog).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBSCRIPTION_RENEWED' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // handleInvoicePaymentFailed
  // -------------------------------------------------------------------------

  describe('handleInvoicePaymentFailed', () => {
    it('sets status to past_due and calls auditService.log with PAYMENT_FAILED (L-11)', async () => {
      const invoice = makeInvoice();
      const event = makeEvent('invoice.payment_failed', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(makeSubscription());
      mockUpdateSubscriptionStatus.mockResolvedValue(undefined);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', 'past_due');
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYMENT_FAILED', status: 'FAILURE' })
      );
    });

    it('skips when no subscription ID in invoice', async () => {
      const invoice = { id: 'inv-123', billing_reason: null, parent: null };
      const event = makeEvent('invoice.payment_failed', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockStripeSubscriptionsRetrieve).not.toHaveBeenCalled();
      expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('skips when userId missing from subscription metadata', async () => {
      const invoice = makeInvoice();
      const event = makeEvent('invoice.payment_failed', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(makeSubscription({ metadata: {} }));

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('skips when userId in subscription metadata is not a valid UUID (validateMetadataUserId)', async () => {
      const invoice = makeInvoice();
      const event = makeEvent('invoice.payment_failed', invoice);
      mockStripeWebhooksConstructEvent.mockReturnValue(event);
      mockStripeSubscriptionsRetrieve.mockResolvedValue(
        makeSubscription({ metadata: { userId: 'not-a-uuid-string' } })
      );

      await billingService.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('userId'),
        expect.anything()
      );
    });
  });
});
