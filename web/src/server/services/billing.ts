import 'server-only';

import Stripe from 'stripe';
import { z } from 'zod';

import { config } from '@/server/db/config';
import { logger } from '@/server/lib/logger';
import {
  findUserById,
  updateUserSubscription,
  updateSubscriptionStatus,
} from '@/server/dal/users';
import {
  tryMarkWebhookProcessed,
  deleteProcessedWebhookEvent,
} from '@/server/dal/webhooks';
import { auditService } from '@/server/services/audit';
import { AuditAction } from '@/server/types';

// ---------------------------------------------------------------------------
// Typed billing errors — use instanceof in callers, never string matching
// ---------------------------------------------------------------------------

/**
 * Thrown when Stripe webhook signature verification fails.
 * Route handler catches this and returns 400 (tells Stripe not to retry).
 */
export class WebhookSignatureError extends Error {
  constructor() {
    super('Webhook signature verification failed');
    this.name = 'WebhookSignatureError';
  }
}

/**
 * Thrown when a user attempts to create a checkout session but already has
 * an active subscription. Action catches this and returns 'subscription_exists'.
 */
export class SubscriptionExistsError extends Error {
  constructor() {
    super('User already has an active subscription');
    this.name = 'SubscriptionExistsError';
  }
}

/**
 * General billing error for unexpected failures.
 * Carries a machine-readable code for structured logging.
 */
export class BillingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'BillingError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Billing service
// ---------------------------------------------------------------------------

class BillingService {
  private stripe: Stripe;

  constructor() {
    const key = config.STRIPE_SECRET_KEY;
    if (!key) throw new BillingError('missing_stripe_key', 'STRIPE_SECRET_KEY not configured');
    this.stripe = new Stripe(key, {
      // IMPORTANT: Pin API version to match Dashboard webhook endpoint (cannot be changed after creation)
      // SDK types expect a newer version but our webhook is locked to 2025-12-15.clover
      // @ts-expect-error stripe-version-2025-12-15 — webhook locked to this version
      apiVersion: '2025-12-15.clover',
    });
  }

  /**
   * Validate that metadata.userId is a valid UUID string.
   * Rule 3: validate external data (webhook metadata) at runtime after signature verification.
   * Returns the validated userId string, or null if invalid/missing.
   */
  private validateMetadataUserId(
    userId: unknown,
    eventType: string,
    context: Record<string, unknown>
  ): string | null {
    if (typeof userId !== 'string') {
      this.logMissingUserIdError(eventType, context);
      return null;
    }
    const parsed = z.string().uuid().safeParse(userId);
    if (!parsed.success) {
      this.logMissingUserIdError(eventType, { ...context, invalidUserId: '[REDACTED]' });
      return null;
    }
    return parsed.data;
  }

  /**
   * Create a Stripe checkout session.
   * Returns the checkout URL for client-side redirect.
   *
   * H-2 guard: blocks checkout if user already has an active subscription.
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    priceId: string
  ): Promise<string> {
    const user = await findUserById(userId);
    if (!user) throw new BillingError('user_not_found', 'User not found');

    // H-2 guard: Block checkout if user already has a Stripe subscription.
    // Checking subscriptionId (not just 'active' status) prevents duplicate
    // subscriptions for users in 'past_due' or 'unpaid' states who already
    // have a billing relationship with Stripe.
    if (user.subscriptionId) throw new SubscriptionExistsError();

    // Reuse existing Stripe customer to avoid orphaned Customer records
    const customerParam: { customer: string } | { customer_email: string } =
      user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: email };

    const session = await this.stripe.checkout.sessions.create({
      ...customerParam,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.WEB_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.WEB_URL}/pricing?canceled=true`,
      allow_promotion_codes: true,
      metadata: { userId },
      subscription_data: {
        metadata: { userId },
      },
    });

    if (!session.url) {
      throw new BillingError('billing_error', 'Failed to create checkout session');
    }

    return session.url;
  }

  /**
   * Create a Stripe customer portal session.
   * Returns the portal URL for client-side redirect.
   */
  async createPortalSession(userId: string): Promise<string> {
    const user = await findUserById(userId);
    if (!user?.stripeCustomerId) {
      throw new BillingError('billing_error', 'No billing account found');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${config.WEB_URL}/dashboard`,
    });

    return session.url;
  }

  /**
   * Handle an incoming Stripe webhook event.
   *
   * CRITICAL: body must be the raw request bytes (not parsed/modified).
   * Stripe signs the raw bytes — any transformation breaks verification.
   */
  async handleWebhook(body: Buffer, signature: string): Promise<void> {
    const webhookSecret = config.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BillingError('missing_webhook_secret', 'STRIPE_WEBHOOK_SECRET not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch {
      throw new WebhookSignatureError();
    }

    // Database-backed idempotency check (atomic INSERT prevents race conditions)
    const isNewEvent = await tryMarkWebhookProcessed(event.id, event.type);
    if (!isNewEvent) {
      logger.info({ source: 'billing_webhook', eventId: event.id }, 'Skipping duplicate webhook event');
      return;
    }

    // CR-1: Wrap handler dispatch in try/catch for idempotency recovery.
    // If a handler fails after the idempotency mark, delete the record so Stripe
    // can retry. There's a narrow race window between deletion and retry arrival,
    // but Stripe does not send concurrent deliveries of the same event.
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          await this.handleCheckoutComplete(event.data.object);
          break;
        }

        case 'customer.subscription.updated': {
          await this.handleSubscriptionUpdate(event.data.object);
          break;
        }

        case 'customer.subscription.deleted': {
          await this.handleSubscriptionDelete(event.data.object);
          break;
        }

        case 'invoice.paid': {
          await this.handleInvoicePaid(event.data.object);
          break;
        }

        case 'invoice.payment_failed': {
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        }

        default: {
          logger.warn({ source: 'billing_webhook', eventType: event.type, eventId: event.id }, 'Unhandled Stripe webhook event type');
          break;
        }
      }
    } catch (handlerError) {
      // Handler failed — delete idempotency record so Stripe retry will be processed
      logger.error({ err: handlerError instanceof Error ? handlerError : new Error(String(handlerError)), source: 'billing_webhook', errorType: 'webhook_handler_failed', eventType: event.type, eventId: event.id }, 'Webhook handler failed');

      try {
        await deleteProcessedWebhookEvent(event.id);
      } catch (cleanupError) {
        // Cleanup also failed — event is permanently stuck.
        logger.error({ err: cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError)), source: 'billing_webhook', errorType: 'idempotency_cleanup_failed', eventId: event.id, eventType: event.type }, 'Idempotency cleanup failed');
      }

      // Re-throw so Stripe receives 500 and schedules a retry
      throw handlerError;
    }
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const userId = this.validateMetadataUserId(
      session.metadata?.userId,
      'checkout.session.completed',
      { sessionId: session.id }
    );
    if (!userId) return;

    // Rule 3: Validate external data at runtime — session.customer and
    // session.subscription can be null or expanded objects.
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (!customerId || !subscriptionId) {
      logger.error({ source: 'billing_webhook', errorType: 'missing_checkout_ids', sessionId: session.id, hasCustomer: !!session.customer, hasSubscription: !!session.subscription }, 'checkout.session.completed missing customer or subscription ID');
      return;
    }

    await updateUserSubscription(
      userId,
      customerId,
      subscriptionId,
      'active'
    );

    // Rule 9: Audit log is not transactional with the update above.
    // Fire-and-forget — auditService.log swallows errors internally (never rejects).
    void auditService.log({
      userId,
      action: AuditAction.SUBSCRIPTION_CREATED,
      status: 'SUCCESS',
      metadata: {
        subscriptionId,
        customerId,
      },
    });
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const userId = this.validateMetadataUserId(
      subscription.metadata.userId,
      'customer.subscription.updated',
      { subscriptionId: subscription.id }
    );
    if (!userId) return;

    // Validate Stripe status against known application statuses.
    // Stripe can send statuses (e.g., 'incomplete', 'incomplete_expired', 'paused')
    // that our schema doesn't support. Skip unknown statuses with error logging.
    const validStatuses = new Set(['trialing', 'active', 'canceled', 'past_due', 'unpaid']);
    if (!validStatuses.has(subscription.status)) {
      logger.error({ source: 'billing_webhook', errorType: 'unknown_subscription_status', subscriptionId: subscription.id, status: subscription.status }, 'Unknown Stripe subscription status received');
      return;
    }

    await updateSubscriptionStatus(
      userId,
      subscription.status as 'trialing' | 'active' | 'canceled' | 'past_due' | 'unpaid'
    );
  }

  private async handleSubscriptionDelete(subscription: Stripe.Subscription): Promise<void> {
    const userId = this.validateMetadataUserId(
      subscription.metadata.userId,
      'customer.subscription.deleted',
      { subscriptionId: subscription.id }
    );
    if (!userId) return;

    await updateSubscriptionStatus(userId, 'canceled');

    // Fire-and-forget — auditService.log swallows errors internally (never rejects).
    void auditService.log({
      userId,
      action: AuditAction.SUBSCRIPTION_CANCELLED,
      status: 'SUCCESS',
      metadata: { subscriptionId: subscription.id },
    });
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = this.getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      return;
    }

    // Retrieve subscription metadata to get userId
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const userId = this.validateMetadataUserId(
      subscription.metadata.userId,
      'invoice.paid',
      { subscriptionId: subscription.id, invoiceId: invoice.id }
    );
    if (!userId) return;

    // H-3: Only reactivate from states where payment resolves the issue.
    // Don't reactivate canceled subscriptions — that requires explicit re-subscribe.
    const user = await findUserById(userId);

    if (!user) {
      logger.error({ source: 'billing_webhook', errorType: 'invoice_user_not_found', customerId: subscription.customer, subscriptionId: subscription.id, invoiceId: invoice.id }, 'invoice.paid received for non-existent user');
      // Fire-and-forget — auditService.log swallows errors internally (never rejects).
      void auditService.log({
        userId,
        action: AuditAction.WEBHOOK_PROCESSING_FAILED,
        status: 'FAILURE',
        metadata: {
          reason: 'user_not_found',
          eventType: 'invoice.paid',
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
        },
      });
      return;
    }

    const currentStatus = user.subscriptionStatus;
    const reactivatableStatuses = new Set(['past_due', 'trialing', 'unpaid']);

    if (currentStatus === 'canceled') {
      logger.error({ source: 'billing_webhook', errorType: 'invoice_canceled_subscription', subscriptionId: subscription.id, invoiceId: invoice.id }, 'invoice.paid received for canceled subscription');
      // Fire-and-forget — auditService.log swallows errors internally (never rejects).
      void auditService.log({
        userId,
        action: AuditAction.WEBHOOK_PROCESSING_FAILED,
        status: 'FAILURE',
        metadata: {
          reason: 'invoice_paid_canceled_subscription',
          eventType: 'invoice.paid',
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
        },
      });
      return;
    }

    if (!reactivatableStatuses.has(currentStatus)) {
      // Already 'active' or unknown status — skip (idempotent, no update needed)
      return;
    }

    await updateSubscriptionStatus(userId, 'active');

    // Log successful renewal (not initial payment, which is handled by checkout.session.completed)
    if (invoice.billing_reason === 'subscription_cycle') {
      // Fire-and-forget — auditService.log swallows errors internally (never rejects).
      void auditService.log({
        userId,
        action: AuditAction.SUBSCRIPTION_RENEWED,
        status: 'SUCCESS',
        metadata: {
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          billingReason: 'renewal',
        },
      });
    }
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = this.getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      return;
    }

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const userId = this.validateMetadataUserId(
      subscription.metadata.userId,
      'invoice.payment_failed',
      { subscriptionId: subscription.id, invoiceId: invoice.id }
    );
    if (!userId) return;

    await updateSubscriptionStatus(userId, 'past_due');

    // Fire-and-forget — auditService.log swallows errors internally (never rejects).
    void auditService.log({
      userId,
      action: AuditAction.PAYMENT_FAILED,
      status: 'FAILURE',
      metadata: {
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        reason: 'payment_failed',
      },
    });
  }

  /**
   * Extract subscription ID from invoice.
   * In API version 2025-12-15.clover, subscription is nested in parent.subscription_details.
   */
  private getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
    // In API version 2025-12-15.clover, subscription is nested in parent.subscription_details.
    // The Stripe SDK types (pinned to the newer API) don't expose parent.subscription_details
    // on the Invoice type yet — use a typed intermediary to avoid unsafe `any` access.
    interface InvoiceWithParent {
      parent?: {
        subscription_details?: {
          subscription?: string | { id: string } | null;
        } | null;
      } | null;
    }
    const invoiceWithParent = invoice as unknown as InvoiceWithParent;
    const sub = invoiceWithParent.parent?.subscription_details?.subscription;
    if (!sub) return null;
    if (typeof sub === 'string') return sub;
    return sub.id;
  }

  /**
   * Log missing or invalid userId in webhook metadata.
   * This happens when a subscription wasn't created through our checkout flow
   * (e.g., created manually in Stripe Dashboard) or when metadata.userId is malformed.
   */
  private logMissingUserIdError(
    eventType: string,
    context: Record<string, unknown>
  ): void {
    logger.error({ source: 'billing_webhook', errorType: 'missing_user_metadata', eventType, eventId: context['eventId'] }, 'Webhook missing or invalid userId in metadata');

    // Fire-and-forget — auditService.log swallows errors internally (never rejects).
    void auditService.log({
      userId: null,
      action: AuditAction.WEBHOOK_PROCESSING_FAILED,
      status: 'FAILURE',
      metadata: {
        reason: 'missing_user_metadata',
        eventType,
        subscriptionId: context['subscriptionId'],
        sessionId: context['sessionId'],
        invoiceId: context['invoiceId'],
      },
    });
  }
}

// Lazy singleton — deferred to first use so the module can be imported in
// dev/test environments where STRIPE_SECRET_KEY is absent (config makes it
// optional outside production). Eager `new BillingService()` would throw at
// import time and crash the process.
let _billingService: BillingService | null = null;

export function getBillingService(): BillingService {
  if (!_billingService) {
    _billingService = new BillingService();
  }
  return _billingService;
}
