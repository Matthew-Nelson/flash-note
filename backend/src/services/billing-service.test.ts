import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mockAuditLog, resetMocks, TEST_CONFIG_DEFAULTS } from '../test/setup.js';
import { AuditAction } from '../types/index.js';

// Mock Stripe
const mockStripeCheckoutCreate = vi.fn();
const mockStripeBillingPortalCreate = vi.fn();
const mockStripeWebhooksConstructEvent = vi.fn();

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: mockStripeCheckoutCreate,
        },
      },
      billingPortal: {
        sessions: {
          create: mockStripeBillingPortalCreate,
        },
      },
      webhooks: {
        constructEvent: mockStripeWebhooksConstructEvent,
      },
    })),
  };
});

// Mock config
vi.mock('../config.js', () => ({
  config: {
    STRIPE_SECRET_KEY: 'sk_test_mock',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_mock',
    WEB_URL: TEST_CONFIG_DEFAULTS.WEB_URL,
  },
}));

// Mock user queries
const mockFindUserById = vi.fn();
const mockUpdateUserSubscription = vi.fn();
const mockUpdateSubscriptionStatus = vi.fn();

vi.mock('../db/queries/users.js', () => ({
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
  updateUserSubscription: (...args: unknown[]) => mockUpdateUserSubscription(...args),
  updateSubscriptionStatus: (...args: unknown[]) => mockUpdateSubscriptionStatus(...args),
}));

// Import after mocking
const { billingService } = await import('./billing-service.js');

describe('BillingService', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetMocks();
    mockStripeCheckoutCreate.mockReset();
    mockStripeBillingPortalCreate.mockReset();
    mockStripeWebhooksConstructEvent.mockReset();
    mockFindUserById.mockReset();
    mockUpdateUserSubscription.mockReset();
    mockUpdateSubscriptionStatus.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('createCheckoutSession', () => {
    it('should create a Stripe checkout session', async () => {
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

    it('should pass correct parameters to Stripe', async () => {
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
        metadata: { userId: 'user-123' },
        subscription_data: {
          metadata: { userId: 'user-123' },
        },
      });
    });

    it('should include userId in both session and subscription metadata', async () => {
      mockStripeCheckoutCreate.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session123',
      });

      await billingService.createCheckoutSession('user-abc', 'test@example.com', 'price_123');

      const callArgs = mockStripeCheckoutCreate.mock.calls[0][0];
      expect(callArgs.metadata.userId).toBe('user-abc');
      expect(callArgs.subscription_data.metadata.userId).toBe('user-abc');
    });

    it('should throw AppError when Stripe returns no URL', async () => {
      mockStripeCheckoutCreate.mockResolvedValueOnce({ url: null });

      await expect(
        billingService.createCheckoutSession('user-123', 'test@example.com', 'price_123')
      ).rejects.toThrow('Failed to create checkout session');
    });

    it('should propagate Stripe API errors', async () => {
      mockStripeCheckoutCreate.mockRejectedValueOnce(new Error('Stripe API error'));

      await expect(
        billingService.createCheckoutSession('user-123', 'test@example.com', 'price_123')
      ).rejects.toThrow('Stripe API error');
    });
  });

  describe('createPortalSession', () => {
    it('should create billing portal session for existing customer', async () => {
      mockFindUserById.mockResolvedValueOnce({ stripeCustomerId: 'cus_123' });
      mockStripeBillingPortalCreate.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/portal123',
      });

      const url = await billingService.createPortalSession('user-123');

      expect(url).toBe('https://billing.stripe.com/portal123');
    });

    it('should pass correct customer ID to Stripe', async () => {
      mockFindUserById.mockResolvedValueOnce({ stripeCustomerId: 'cus_abc123' });
      mockStripeBillingPortalCreate.mockResolvedValueOnce({ url: 'https://portal.stripe.com' });

      await billingService.createPortalSession('user-123');

      expect(mockStripeBillingPortalCreate).toHaveBeenCalledWith({
        customer: 'cus_abc123',
        return_url: expect.stringContaining('/dashboard'),
      });
    });

    it('should throw AppError when user has no Stripe customer ID', async () => {
      mockFindUserById.mockResolvedValueOnce({ stripeCustomerId: null });

      await expect(billingService.createPortalSession('user-123')).rejects.toThrow(
        'No billing account found'
      );
    });

    it('should throw AppError when user is not found', async () => {
      mockFindUserById.mockResolvedValueOnce(null);

      await expect(billingService.createPortalSession('user-123')).rejects.toThrow(
        'No billing account found'
      );
    });
  });

  describe('handleWebhook', () => {
    it('should verify webhook signature', async () => {
      const body = Buffer.from('test');
      const signature = 'sig_123';

      mockStripeWebhooksConstructEvent.mockReturnValueOnce({
        type: 'checkout.session.completed',
        data: { object: { metadata: {}, customer: 'cus_123', subscription: 'sub_123' } },
      });

      await billingService.handleWebhook(body, signature);

      expect(mockStripeWebhooksConstructEvent).toHaveBeenCalledWith(
        body,
        signature,
        'whsec_test_mock'
      );
    });

    it('should throw AppError for invalid signature', async () => {
      mockStripeWebhooksConstructEvent.mockImplementationOnce(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        billingService.handleWebhook(Buffer.from('test'), 'bad_sig')
      ).rejects.toThrow('Invalid signature');
    });

    describe('checkout.session.completed', () => {
      it('should update user subscription on checkout complete', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: { userId: 'user-123' },
              customer: 'cus_abc',
              subscription: 'sub_xyz',
            },
          },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateUserSubscription).toHaveBeenCalledWith(
          'user-123',
          'cus_abc',
          'sub_xyz',
          'active'
        );
      });

      it('should log subscription created audit event', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: { userId: 'user-123' },
              customer: 'cus_abc',
              subscription: 'sub_xyz',
            },
          },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockAuditLog).toHaveBeenCalledWith({
          userId: 'user-123',
          action: AuditAction.SUBSCRIPTION_CREATED,
          status: 'SUCCESS',
          metadata: {
            subscriptionId: 'sub_xyz',
            customerId: 'cus_abc',
          },
        });
      });

      it('should handle missing userId in metadata gracefully', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: {},
              customer: 'cus_abc',
              subscription: 'sub_xyz',
            },
          },
        });

        // Should not throw, just log error
        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateUserSubscription).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Checkout session missing userId in metadata'
        );
      });
    });

    describe('customer.subscription.updated', () => {
      it('should update subscription status', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          type: 'customer.subscription.updated',
          data: {
            object: {
              metadata: { userId: 'user-123' },
              status: 'past_due',
            },
          },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', 'past_due');
      });

      it('should handle missing userId gracefully', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          type: 'customer.subscription.updated',
          data: {
            object: {
              metadata: {},
              status: 'active',
            },
          },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Subscription missing userId in metadata'
        );
      });
    });

    describe('customer.subscription.deleted', () => {
      it('should set subscription status to canceled', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_123',
              metadata: { userId: 'user-123' },
            },
          },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', 'canceled');
      });

      it('should log subscription cancelled audit event', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_xyz',
              metadata: { userId: 'user-123' },
            },
          },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockAuditLog).toHaveBeenCalledWith({
          userId: 'user-123',
          action: AuditAction.SUBSCRIPTION_CANCELLED,
          status: 'SUCCESS',
          metadata: { subscriptionId: 'sub_xyz' },
        });
      });

      it('should handle missing userId gracefully', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_123',
              metadata: {},
            },
          },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Subscription missing userId in metadata'
        );
      });
    });

    describe('unknown event types', () => {
      it('should ignore unknown event types without error', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          type: 'unknown.event.type',
          data: { object: {} },
        });

        // Should not throw
        await expect(
          billingService.handleWebhook(Buffer.from(''), 'sig')
        ).resolves.not.toThrow();
      });
    });
  });

  describe('security properties', () => {
    it('should use webhook secret for signature verification', async () => {
      mockStripeWebhooksConstructEvent.mockReturnValueOnce({
        type: 'ping',
        data: { object: {} },
      });

      await billingService.handleWebhook(Buffer.from('body'), 'signature');

      expect(mockStripeWebhooksConstructEvent).toHaveBeenCalledWith(
        expect.any(Buffer),
        'signature',
        'whsec_test_mock'
      );
    });

    it('should reject webhook with invalid signature', async () => {
      mockStripeWebhooksConstructEvent.mockImplementationOnce(() => {
        const error = new Error('Webhook signature verification failed');
        throw error;
      });

      await expect(
        billingService.handleWebhook(Buffer.from('tampered'), 'bad_sig')
      ).rejects.toThrow('Invalid signature');
    });
  });
});
