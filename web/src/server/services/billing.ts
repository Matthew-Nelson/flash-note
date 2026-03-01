import 'server-only';

import Stripe from 'stripe';

import { config } from '@/server/db/config';
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
    if (user.subscriptionStatus === 'active') throw new SubscriptionExistsError();

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
      // eslint-disable-next-line no-console
      console.log(`Skipping duplicate webhook event: ${event.id}`);
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
      }
    } catch (handlerError) {
      // Handler failed — delete idempotency record so Stripe retry will be processed
      console.error('Webhook handler failed:', {
        source: 'service_billing',
        errorType: 'handler_failed',
        eventId: event.id,
        eventType: event.type,
      });

      try {
        await deleteProcessedWebhookEvent(event.id);
      } catch (cleanupError) {
        // Cleanup also failed — event is permanently stuck.
        console.error('Idempotency cleanup failed:', {
          source: 'service_billing',
          errorType: 'idempotency_cleanup_failed',
          eventId: event.id,
          eventType: event.type,
          cleanupErrorType: cleanupError instanceof Error ? cleanupError.constructor.name : 'unknown',
        });
      }

      // Re-throw so Stripe receives 500 and schedules a retry
      throw handlerError;
    }
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) {
      this.logMissingUserIdError('checkout.session.completed', {
        sessionId: session.id,
        customerId: session.customer,
      });
      return;
    }

    // Rule 3: Validate external data at runtime — session.customer and
    // session.subscription can be null or expanded objects.
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (!customerId || !subscriptionId) {
      // eslint-disable-next-line no-console
      console.error('checkout.session.completed missing customer or subscription ID:', {
        source: 'service_billing',
        errorType: 'missing_checkout_ids',
        userId,
        sessionId: session.id,
        hasCustomer: !!session.customer,
        hasSubscription: !!session.subscription,
      });
      return;
    }

    await updateUserSubscription(
      userId,
      customerId,
      subscriptionId,
      'active'
    );

    // Rule 9: Audit log is not transactional with the update above.
    // Fire-and-forget — audit failures should not trigger CR-1 retry logic.
    // .catch() ensures failures surface in Cloud Error Reporting (Rule 9).
    void auditService.log({
      userId,
      action: AuditAction.SUBSCRIPTION_CREATED,
      status: 'SUCCESS',
      metadata: {
        subscriptionId,
        customerId,
      },
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Audit log failed:', {
        err,
        source: 'service_billing',
        errorType: 'audit_log_failed',
        action: AuditAction.SUBSCRIPTION_CREATED,
        userId,
      });
    });
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    if (!userId) {
      this.logMissingUserIdError('customer.subscription.updated', {
        subscriptionId: subscription.id,
      });
      return;
    }

    // Validate Stripe status against known application statuses.
    // Stripe can send statuses (e.g., 'incomplete', 'incomplete_expired', 'paused')
    // that our schema doesn't support. Skip unknown statuses with error logging.
    const validStatuses = new Set(['trialing', 'active', 'canceled', 'past_due', 'unpaid']);
    if (!validStatuses.has(subscription.status)) {
      console.error('Unknown Stripe subscription status received:', {
        source: 'service_billing',
        errorType: 'unknown_subscription_status',
        userId,
        subscriptionId: subscription.id,
        stripeStatus: subscription.status,
      });
      return;
    }

    await updateSubscriptionStatus(
      userId,
      subscription.status as 'trialing' | 'active' | 'canceled' | 'past_due' | 'unpaid'
    );
  }

  private async handleSubscriptionDelete(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    if (!userId) {
      this.logMissingUserIdError('customer.subscription.deleted', {
        subscriptionId: subscription.id,
      });
      return;
    }

    await updateSubscriptionStatus(userId, 'canceled');

    void auditService.log({
      userId,
      action: AuditAction.SUBSCRIPTION_CANCELLED,
      status: 'SUCCESS',
      metadata: { subscriptionId: subscription.id },
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Audit log failed:', {
        err,
        source: 'service_billing',
        errorType: 'audit_log_failed',
        action: AuditAction.SUBSCRIPTION_CANCELLED,
        userId,
      });
    });
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = this.getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      return;
    }

    // Retrieve subscription metadata to get userId
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata.userId;
    if (!userId) {
      this.logMissingUserIdError('invoice.paid', {
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
      });
      return;
    }

    // H-3: Only reactivate from states where payment resolves the issue.
    // Don't reactivate canceled subscriptions — that requires explicit re-subscribe.
    const user = await findUserById(userId);

    if (!user) {
      console.error('invoice.paid received for non-existent user:', {
        source: 'service_billing',
        errorType: 'user_not_found',
        userId,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
      });
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
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Audit log failed:', {
          err,
          source: 'service_billing',
          errorType: 'audit_log_failed',
          action: AuditAction.WEBHOOK_PROCESSING_FAILED,
          userId,
        });
      });
      return;
    }

    const currentStatus = user.subscriptionStatus;
    const reactivatableStatuses = new Set(['past_due', 'trialing', 'unpaid']);

    if (currentStatus === 'canceled') {
      console.error('invoice.paid received for canceled subscription:', {
        source: 'service_billing',
        errorType: 'invoice_paid_canceled_subscription',
        userId,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
      });
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
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Audit log failed:', {
          err,
          source: 'service_billing',
          errorType: 'audit_log_failed',
          action: AuditAction.WEBHOOK_PROCESSING_FAILED,
          userId,
        });
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
      void auditService.log({
        userId,
        action: AuditAction.SUBSCRIPTION_RENEWED,
        status: 'SUCCESS',
        metadata: {
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          billingReason: 'renewal',
        },
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Audit log failed:', {
          err,
          source: 'service_billing',
          errorType: 'audit_log_failed',
          action: AuditAction.SUBSCRIPTION_RENEWED,
          userId,
        });
      });
    }
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = this.getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      return;
    }

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata.userId;
    if (!userId) {
      this.logMissingUserIdError('invoice.payment_failed', {
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
      });
      return;
    }

    await updateSubscriptionStatus(userId, 'past_due');

    void auditService.log({
      userId,
      action: AuditAction.PAYMENT_FAILED,
      status: 'FAILURE',
      metadata: {
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        reason: 'payment_failed',
      },
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Audit log failed:', {
        err,
        source: 'service_billing',
        errorType: 'audit_log_failed',
        action: AuditAction.PAYMENT_FAILED,
        userId,
      });
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
   * Log missing userId in webhook metadata.
   * This happens when a subscription wasn't created through our checkout flow
   * (e.g., created manually in Stripe Dashboard).
   */
  private logMissingUserIdError(
    eventType: string,
    context: {
      subscriptionId?: string;
      customerId?: unknown;
      sessionId?: string;
      invoiceId?: string;
    }
  ): void {
    console.error('Webhook missing userId in metadata:', {
      source: 'service_billing',
      errorType: 'missing_user_metadata',
      eventType,
      subscriptionId: context.subscriptionId,
      sessionId: context.sessionId,
      invoiceId: context.invoiceId,
      // Note: customerId intentionally omitted — may contain PII
    });

    void auditService.log({
      userId: null,
      action: AuditAction.WEBHOOK_PROCESSING_FAILED,
      status: 'FAILURE',
      metadata: {
        reason: 'missing_user_metadata',
        eventType,
        subscriptionId: context.subscriptionId,
        sessionId: context.sessionId,
        invoiceId: context.invoiceId,
      },
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Audit log failed:', {
        err,
        source: 'service_billing',
        errorType: 'audit_log_failed',
        action: AuditAction.WEBHOOK_PROCESSING_FAILED,
        eventType,
      });
    });
  }
}

export const billingService = new BillingService();
