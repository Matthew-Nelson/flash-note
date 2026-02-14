import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mockAuditLog, resetMocks, TEST_CONFIG_DEFAULTS } from '../test/setup.js';
import { AuditAction } from '../types/index.js';

// Use vi.hoisted to ensure mocks are available before vi.mock factory runs
const {
  mockStripeCheckoutCreate,
  mockStripeBillingPortalCreate,
  mockStripeWebhooksConstructEvent,
  mockStripeSubscriptionsRetrieve,
  mockSentry,
} = vi.hoisted(() => ({
  mockStripeCheckoutCreate: vi.fn(),
  mockStripeBillingPortalCreate: vi.fn(),
  mockStripeWebhooksConstructEvent: vi.fn(),
  mockStripeSubscriptionsRetrieve: vi.fn(),
  mockSentry: {
    captureException: vi.fn(),
  },
}));

// Mock Stripe - use a class to work with 'new Stripe()'
vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      checkout = {
        sessions: {
          create: mockStripeCheckoutCreate,
        },
      };
      billingPortal = {
        sessions: {
          create: mockStripeBillingPortalCreate,
        },
      };
      webhooks = {
        constructEvent: mockStripeWebhooksConstructEvent,
      };
      subscriptions = {
        retrieve: mockStripeSubscriptionsRetrieve,
      };
    },
  };
});

vi.mock('@sentry/node', () => mockSentry);

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

// Mock webhook queries for idempotency
const mockTryMarkWebhookProcessed = vi.fn();
const mockDeleteProcessedWebhookEvent = vi.fn();

vi.mock('../db/queries/webhooks.js', () => ({
  tryMarkWebhookProcessed: (...args: unknown[]) => mockTryMarkWebhookProcessed(...args),
  deleteProcessedWebhookEvent: (...args: unknown[]) => mockDeleteProcessedWebhookEvent(...args),
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
    mockStripeSubscriptionsRetrieve.mockReset();
    mockFindUserById.mockReset();
    mockUpdateUserSubscription.mockReset();
    mockUpdateSubscriptionStatus.mockReset();
    mockTryMarkWebhookProcessed.mockReset();
    mockDeleteProcessedWebhookEvent.mockReset();
    mockSentry.captureException.mockReset();
    // Default: allow all events to be processed (return true = new event)
    mockTryMarkWebhookProcessed.mockResolvedValue(true);
    mockDeleteProcessedWebhookEvent.mockResolvedValue(undefined);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('createCheckoutSession', () => {
    beforeEach(() => {
      // Default: user exists with trialing status (eligible for checkout)
      mockFindUserById.mockResolvedValue({
        id: 'user-123',
        subscriptionStatus: 'trialing',
        stripeCustomerId: null,
      });
    });

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
        allow_promotion_codes: true,
        metadata: { userId: 'user-123' },
        subscription_data: {
          metadata: { userId: 'user-123' },
        },
      });
    });

    it('should include userId in both session and subscription metadata', async () => {
      mockFindUserById.mockResolvedValueOnce({
        id: 'user-abc',
        subscriptionStatus: 'trialing',
        stripeCustomerId: null,
      });
      mockStripeCheckoutCreate.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session123',
      });

      await billingService.createCheckoutSession('user-abc', 'test@example.com', 'price_123');

      const callArgs = mockStripeCheckoutCreate.mock.calls[0]?.[0] as {
        metadata: { userId: string };
        subscription_data: { metadata: { userId: string } };
      };
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

    it('should throw 404 when user not found (H-2)', async () => {
      mockFindUserById.mockResolvedValueOnce(null);

      await expect(
        billingService.createCheckoutSession('nonexistent', 'test@example.com', 'price_123')
      ).rejects.toThrow('User not found');
    });

    it('should throw 409 when user already has active subscription (H-2)', async () => {
      mockFindUserById.mockResolvedValueOnce({
        id: 'user-123',
        subscriptionStatus: 'active',
        stripeCustomerId: 'cus_existing',
      });

      await expect(
        billingService.createCheckoutSession('user-123', 'test@example.com', 'price_123')
      ).rejects.toThrow('User already has an active subscription');
    });

    it.each(['canceled', 'past_due', 'trialing', 'unpaid'])('should allow checkout for %s subscription status (H-2)', async (status) => {
      mockFindUserById.mockResolvedValueOnce({
        id: 'user-123',
        subscriptionStatus: status,
        stripeCustomerId: null,
      });
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

    it('should reuse existing stripeCustomerId instead of customer_email (H-2)', async () => {
      mockFindUserById.mockResolvedValueOnce({
        id: 'user-123',
        subscriptionStatus: 'canceled',
        stripeCustomerId: 'cus_existing_123',
      });
      mockStripeCheckoutCreate.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session123',
      });

      await billingService.createCheckoutSession('user-123', 'test@example.com', 'price_monthly');

      const callArgs = mockStripeCheckoutCreate.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArgs.customer).toBe('cus_existing_123');
      expect(callArgs.customer_email).toBeUndefined();
    });

    it('should use customer_email when no stripeCustomerId exists (H-2)', async () => {
      mockStripeCheckoutCreate.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/session123',
      });

      await billingService.createCheckoutSession('user-123', 'test@example.com', 'price_monthly');

      const callArgs = mockStripeCheckoutCreate.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArgs.customer_email).toBe('test@example.com');
      expect(callArgs.customer).toBeUndefined();
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
        id: 'evt_verify_sig',
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
          id: 'evt_checkout_update',
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
          id: 'evt_checkout_audit',
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
          id: 'evt_checkout_no_user',
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_123',
              metadata: {},
              customer: 'cus_abc',
              subscription: 'sub_xyz',
            },
          },
        });

        // Should not throw, just log structured error and audit
        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateUserSubscription).not.toHaveBeenCalled();
        // Verify structured logging was called
        expect(consoleErrorSpy).toHaveBeenCalled();
        const loggedMessage = consoleErrorSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(loggedMessage) as Record<string, unknown>;
        expect(parsed.event).toBe('webhook_missing_user_id');
        expect(parsed.eventType).toBe('checkout.session.completed');
      });
    });

    describe('customer.subscription.updated', () => {
      it('should update subscription status', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_sub_updated',
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
          id: 'evt_sub_updated_no_user',
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_123',
              metadata: {},
              status: 'active',
            },
          },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
        // Verify structured logging was called
        expect(consoleErrorSpy).toHaveBeenCalled();
        const loggedMessage = consoleErrorSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(loggedMessage) as Record<string, unknown>;
        expect(parsed.event).toBe('webhook_missing_user_id');
        expect(parsed.eventType).toBe('customer.subscription.updated');
      });

      it.each(['trialing', 'active', 'canceled', 'past_due', 'unpaid'])('should accept valid status "%s"', async (status) => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: `evt_sub_updated_${status}`,
          type: 'customer.subscription.updated',
          data: {
            object: {
              metadata: { userId: 'user-123' },
              status,
            },
          },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', status);
      });

      it.each(['incomplete', 'incomplete_expired', 'paused'])('should reject unknown Stripe status "%s" and alert via Sentry', async (status) => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: `evt_sub_updated_${status}`,
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_unknown',
              metadata: { userId: 'user-123' },
              status,
            },
          },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
        expect(mockSentry.captureException).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({
            extra: expect.objectContaining({
              source: 'billing_webhook',
              errorType: 'unknown_subscription_status',
              stripeStatus: status,
            }),
          })
        );
        expect(consoleErrorSpy).toHaveBeenCalled();
        const loggedMessage = consoleErrorSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(loggedMessage) as Record<string, unknown>;
        expect(parsed.event).toBe('unknown_subscription_status');
        expect(parsed.stripeStatus).toBe(status);
      });
    });

    describe('customer.subscription.deleted', () => {
      it('should set subscription status to canceled', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_sub_deleted',
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
          id: 'evt_sub_deleted_audit',
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
          id: 'evt_sub_deleted_no_user',
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
        // Verify structured logging was called
        expect(consoleErrorSpy).toHaveBeenCalled();
        const loggedMessage = consoleErrorSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(loggedMessage) as Record<string, unknown>;
        expect(parsed.event).toBe('webhook_missing_user_id');
        expect(parsed.eventType).toBe('customer.subscription.deleted');
      });
    });

    describe('unknown event types', () => {
      it('should ignore unknown event types without error', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_unknown',
          type: 'unknown.event.type',
          data: { object: {} },
        });

        // Should not throw
        await expect(
          billingService.handleWebhook(Buffer.from(''), 'sig')
        ).resolves.not.toThrow();
      });
    });

    describe('invoice.paid', () => {
      it('should skip non-subscription invoices', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_paid_no_sub',
          type: 'invoice.paid',
          data: {
            object: {
              id: 'inv_123',
              parent: null, // No subscription details
            },
          },
        });

        // Should not throw and should not update subscription
        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
      });

      it('should skip invoices with missing subscription_details', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_paid_empty',
          type: 'invoice.paid',
          data: {
            object: {
              id: 'inv_123',
              parent: {
                subscription_details: null,
              },
            },
          },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
      });

      it('should update subscription status to active when past_due', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_paid',
          type: 'invoice.paid',
          data: {
            object: {
              id: 'inv_123',
              billing_reason: 'subscription_cycle',
              parent: {
                subscription_details: {
                  subscription: 'sub_123',
                },
              },
            },
          },
        });

        mockStripeSubscriptionsRetrieve.mockResolvedValueOnce({
          id: 'sub_123',
          metadata: { userId: 'user-123' },
        });

        // H-3: User must be in reactivatable state
        mockFindUserById.mockResolvedValueOnce({
          id: 'user-123',
          subscriptionStatus: 'past_due',
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-123', 'active');
      });

      it.each(['past_due', 'trialing', 'unpaid'])('should reactivate %s status to active (H-3)', async (status) => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: `evt_invoice_paid_${status}`,
          type: 'invoice.paid',
          data: {
            object: {
              id: 'inv_reactivate',
              billing_reason: 'subscription_cycle',
              parent: {
                subscription_details: {
                  subscription: 'sub_reactivate',
                },
              },
            },
          },
        });

        mockStripeSubscriptionsRetrieve.mockResolvedValueOnce({
          id: 'sub_reactivate',
          metadata: { userId: 'user-reactivate' },
        });

        mockFindUserById.mockResolvedValueOnce({
          id: 'user-reactivate',
          subscriptionStatus: status,
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-reactivate', 'active');
      });

      it('should skip update when subscription is canceled and capture to Sentry (H-3)', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_paid_canceled',
          type: 'invoice.paid',
          data: {
            object: {
              id: 'inv_canceled',
              billing_reason: 'subscription_cycle',
              parent: {
                subscription_details: {
                  subscription: 'sub_canceled',
                },
              },
            },
          },
        });

        mockStripeSubscriptionsRetrieve.mockResolvedValueOnce({
          id: 'sub_canceled',
          metadata: { userId: 'user-canceled' },
        });

        mockFindUserById.mockResolvedValueOnce({
          id: 'user-canceled',
          subscriptionStatus: 'canceled',
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
        // Should capture to Sentry
        expect(mockSentry.captureException).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({
            extra: expect.objectContaining({
              source: 'billing_webhook',
              errorType: 'invoice_paid_canceled_subscription',
            }),
          })
        );
        // Should log structured error
        expect(consoleErrorSpy).toHaveBeenCalled();
        const loggedMessage = consoleErrorSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(loggedMessage) as Record<string, unknown>;
        expect(parsed.event).toBe('invoice_paid_skipped_canceled');
        // Should create audit trail entry for HIPAA compliance
        expect(mockAuditLog).toHaveBeenCalledWith({
          userId: 'user-canceled',
          action: AuditAction.WEBHOOK_PROCESSING_FAILED,
          status: 'FAILURE',
          metadata: {
            reason: 'invoice_paid_canceled_subscription',
            eventType: 'invoice.paid',
            subscriptionId: 'sub_canceled',
            invoiceId: 'inv_canceled',
          },
        });
      });

      it('should return early and capture to Sentry when user not found (H-3)', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_paid_no_user_row',
          type: 'invoice.paid',
          data: {
            object: {
              id: 'inv_no_user_row',
              billing_reason: 'subscription_cycle',
              parent: {
                subscription_details: {
                  subscription: 'sub_no_user_row',
                },
              },
            },
          },
        });

        mockStripeSubscriptionsRetrieve.mockResolvedValueOnce({
          id: 'sub_no_user_row',
          metadata: { userId: 'user-deleted' },
        });

        // User was deleted
        mockFindUserById.mockResolvedValueOnce(null);

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
        // Should capture to Sentry
        expect(mockSentry.captureException).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({
            extra: expect.objectContaining({
              source: 'billing_webhook',
              errorType: 'user_not_found',
              userId: 'user-deleted',
            }),
          })
        );
        // Should log structured error
        expect(consoleErrorSpy).toHaveBeenCalled();
        const loggedMessage = consoleErrorSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(loggedMessage) as Record<string, unknown>;
        expect(parsed.event).toBe('invoice_paid_user_not_found');
        // Should create audit trail entry for HIPAA compliance
        expect(mockAuditLog).toHaveBeenCalledWith({
          userId: 'user-deleted',
          action: AuditAction.WEBHOOK_PROCESSING_FAILED,
          status: 'FAILURE',
          metadata: {
            reason: 'user_not_found',
            eventType: 'invoice.paid',
            subscriptionId: 'sub_no_user_row',
            invoiceId: 'inv_no_user_row',
          },
        });
      });

      it('should skip update when subscription is already active (H-3 idempotent)', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_paid_already_active',
          type: 'invoice.paid',
          data: {
            object: {
              id: 'inv_already_active',
              billing_reason: 'subscription_cycle',
              parent: {
                subscription_details: {
                  subscription: 'sub_already_active',
                },
              },
            },
          },
        });

        mockStripeSubscriptionsRetrieve.mockResolvedValueOnce({
          id: 'sub_already_active',
          metadata: { userId: 'user-already-active' },
        });

        mockFindUserById.mockResolvedValueOnce({
          id: 'user-already-active',
          subscriptionStatus: 'active',
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
        // Should NOT create a false audit trail entry
        expect(mockAuditLog).not.toHaveBeenCalled();
      });

      it('should log audit event for subscription renewal', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_paid_renewal',
          type: 'invoice.paid',
          data: {
            object: {
              id: 'inv_456',
              billing_reason: 'subscription_cycle',
              parent: {
                subscription_details: {
                  subscription: 'sub_456',
                },
              },
            },
          },
        });

        mockStripeSubscriptionsRetrieve.mockResolvedValueOnce({
          id: 'sub_456',
          metadata: { userId: 'user-456' },
        });

        mockFindUserById.mockResolvedValueOnce({
          id: 'user-456',
          subscriptionStatus: 'past_due',
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockAuditLog).toHaveBeenCalledWith({
          userId: 'user-456',
          action: AuditAction.SUBSCRIPTION_CREATED,
          status: 'SUCCESS',
          metadata: {
            subscriptionId: 'sub_456',
            invoiceId: 'inv_456',
            billingReason: 'renewal',
          },
        });
      });

      it('should not log audit event for non-renewal invoices', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_paid_initial',
          type: 'invoice.paid',
          data: {
            object: {
              id: 'inv_789',
              billing_reason: 'subscription_create', // Initial payment, not renewal
              parent: {
                subscription_details: {
                  subscription: 'sub_789',
                },
              },
            },
          },
        });

        mockStripeSubscriptionsRetrieve.mockResolvedValueOnce({
          id: 'sub_789',
          metadata: { userId: 'user-789' },
        });

        mockFindUserById.mockResolvedValueOnce({
          id: 'user-789',
          subscriptionStatus: 'past_due',
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        // Should update status
        expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-789', 'active');
        // Should NOT log audit (billing_reason is not 'subscription_cycle')
        expect(mockAuditLog).not.toHaveBeenCalled();
      });

      it('should handle missing userId in subscription metadata', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_paid_no_user',
          type: 'invoice.paid',
          data: {
            object: {
              id: 'inv_no_user',
              billing_reason: 'subscription_cycle',
              parent: {
                subscription_details: {
                  subscription: 'sub_no_user',
                },
              },
            },
          },
        });

        mockStripeSubscriptionsRetrieve.mockResolvedValueOnce({
          id: 'sub_no_user',
          metadata: {}, // No userId
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
        // Should log error
        expect(consoleErrorSpy).toHaveBeenCalled();
        const loggedMessage = consoleErrorSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(loggedMessage) as Record<string, unknown>;
        expect(parsed.event).toBe('webhook_missing_user_id');
        expect(parsed.eventType).toBe('invoice.paid');
      });

      it('should handle expanded subscription object in invoice', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_paid_expanded',
          type: 'invoice.paid',
          data: {
            object: {
              id: 'inv_expanded',
              billing_reason: 'subscription_update',
              parent: {
                subscription_details: {
                  // Subscription is an expanded object, not a string
                  subscription: {
                    id: 'sub_expanded',
                    status: 'active',
                  },
                },
              },
            },
          },
        });

        mockStripeSubscriptionsRetrieve.mockResolvedValueOnce({
          id: 'sub_expanded',
          metadata: { userId: 'user-expanded' },
        });

        mockFindUserById.mockResolvedValueOnce({
          id: 'user-expanded',
          subscriptionStatus: 'unpaid',
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith('sub_expanded');
        expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-expanded', 'active');
      });
    });

    describe('invoice.payment_failed', () => {
      it('should skip non-subscription invoices', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_failed_no_sub',
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'inv_123',
              parent: {
                subscription_details: null,
              },
            },
          },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
      });

      it('should update subscription status to past_due on payment failure', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_failed',
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'inv_failed',
              parent: {
                subscription_details: {
                  subscription: 'sub_failed',
                },
              },
            },
          },
        });

        mockStripeSubscriptionsRetrieve.mockResolvedValueOnce({
          id: 'sub_failed',
          metadata: { userId: 'user-failed' },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).toHaveBeenCalledWith('user-failed', 'past_due');
      });

      it('should log audit event for payment failure', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_failed_audit',
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'inv_failed_audit',
              parent: {
                subscription_details: {
                  subscription: 'sub_failed_audit',
                },
              },
            },
          },
        });

        mockStripeSubscriptionsRetrieve.mockResolvedValueOnce({
          id: 'sub_failed_audit',
          metadata: { userId: 'user-failed-audit' },
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockAuditLog).toHaveBeenCalledWith({
          userId: 'user-failed-audit',
          action: AuditAction.SUBSCRIPTION_CANCELLED,
          status: 'FAILURE',
          metadata: {
            subscriptionId: 'sub_failed_audit',
            invoiceId: 'inv_failed_audit',
            reason: 'payment_failed',
          },
        });
      });

      it('should handle missing userId in subscription metadata', async () => {
        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_invoice_failed_no_user',
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'inv_failed_no_user',
              parent: {
                subscription_details: {
                  subscription: 'sub_failed_no_user',
                },
              },
            },
          },
        });

        mockStripeSubscriptionsRetrieve.mockResolvedValueOnce({
          id: 'sub_failed_no_user',
          metadata: {}, // No userId
        });

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        expect(mockUpdateSubscriptionStatus).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();
        const loggedMessage = consoleErrorSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(loggedMessage) as Record<string, unknown>;
        expect(parsed.event).toBe('webhook_missing_user_id');
        expect(parsed.eventType).toBe('invoice.payment_failed');
      });
    });

    describe('duplicate event handling (idempotency)', () => {
      it('should skip duplicate events', async () => {
        mockTryMarkWebhookProcessed.mockResolvedValue(false); // Already processed

        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_duplicate',
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: { userId: 'user-123' },
              customer: 'cus_abc',
              subscription: 'sub_xyz',
            },
          },
        });

        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await billingService.handleWebhook(Buffer.from(''), 'sig');

        // Should not process the event
        expect(mockUpdateUserSubscription).not.toHaveBeenCalled();
        // Should log the skip
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Skipping duplicate webhook event')
        );

        consoleLogSpy.mockRestore();
      });
    });

    describe('handler failure idempotency recovery (CR-1)', () => {
      it('should delete idempotency record and re-throw on handler failure', async () => {
        const handlerError = new Error('Database connection lost');
        mockUpdateUserSubscription.mockRejectedValueOnce(handlerError);

        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_handler_fail',
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: { userId: 'user-123' },
              customer: 'cus_abc',
              subscription: 'sub_xyz',
            },
          },
        });

        await expect(
          billingService.handleWebhook(Buffer.from(''), 'sig')
        ).rejects.toThrow('Database connection lost');

        // Should have deleted the idempotency record
        expect(mockDeleteProcessedWebhookEvent).toHaveBeenCalledWith('evt_handler_fail');
        // Should have captured to Sentry
        expect(mockSentry.captureException).toHaveBeenCalledWith(handlerError, {
          extra: {
            source: 'billing_webhook',
            errorType: 'handler_failed',
            eventId: 'evt_handler_fail',
            eventType: 'checkout.session.completed',
          },
        });
      });

      it('should capture cleanup failure to Sentry when idempotency delete fails', async () => {
        const handlerError = new Error('Handler failed');
        const cleanupError = new Error('Cleanup also failed');

        mockUpdateUserSubscription.mockRejectedValueOnce(handlerError);
        mockDeleteProcessedWebhookEvent.mockRejectedValueOnce(cleanupError);

        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_double_fail',
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: { userId: 'user-123' },
              customer: 'cus_abc',
              subscription: 'sub_xyz',
            },
          },
        });

        await expect(
          billingService.handleWebhook(Buffer.from(''), 'sig')
        ).rejects.toThrow('Handler failed');

        // Should capture both errors to Sentry
        expect(mockSentry.captureException).toHaveBeenCalledWith(handlerError, expect.objectContaining({
          extra: expect.objectContaining({ errorType: 'handler_failed' }),
        }));
        expect(mockSentry.captureException).toHaveBeenCalledWith(cleanupError, expect.objectContaining({
          extra: expect.objectContaining({ errorType: 'idempotency_cleanup_failed' }),
        }));
      });

      it('should re-throw the original handler error even when cleanup fails', async () => {
        const handlerError = new Error('Original error');
        mockUpdateUserSubscription.mockRejectedValueOnce(handlerError);
        mockDeleteProcessedWebhookEvent.mockRejectedValueOnce(new Error('Cleanup failed'));

        mockStripeWebhooksConstructEvent.mockReturnValueOnce({
          id: 'evt_rethrow',
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: { userId: 'user-123' },
              customer: 'cus_abc',
              subscription: 'sub_xyz',
            },
          },
        });

        await expect(
          billingService.handleWebhook(Buffer.from(''), 'sig')
        ).rejects.toThrow('Original error');
      });
    });
  });

  describe('security properties', () => {
    it('should use webhook secret for signature verification', async () => {
      mockStripeWebhooksConstructEvent.mockReturnValueOnce({
        id: 'evt_security_test',
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
