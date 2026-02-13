import Stripe from 'stripe';
import * as Sentry from '@sentry/node';
import { config } from '../config.js';
import { findUserById, updateUserSubscription, updateSubscriptionStatus } from '../db/queries/users.js';
import { tryMarkWebhookProcessed, deleteProcessedWebhookEvent } from '../db/queries/webhooks.js';
import { auditService } from './audit-service.js';
import { AuditAction } from '../types/index.js';
import { AppError } from '../middleware/error-handler.js';

const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  // IMPORTANT: Pin API version to match Dashboard webhook endpoint (cannot be changed after creation)
  // SDK types expect 2026-01-28.clover but our webhook is locked to 2025-12-15.clover
  // See: https://stripe.com/docs/api/versioning
  // @ts-expect-error stripe-version-2025-12-15 - webhook locked to older version
  apiVersion: '2025-12-15.clover',
});

class BillingService {
  async createCheckoutSession(
    userId: string,
    email: string,
    priceId: string
  ): Promise<string> {
    // H-2: Prevent duplicate subscriptions and reuse existing Stripe customer
    const user = await findUserById(userId);
    if (!user) {
      throw new AppError(404, 'user_not_found', 'User not found');
    }
    if (user.subscriptionStatus === 'active') {
      throw new AppError(409, 'subscription_exists', 'User already has an active subscription');
    }

    // Reuse existing Stripe customer to avoid orphaned Customer records
    const customerParam: { customer: string } | { customer_email: string } = user.stripeCustomerId
      ? { customer: user.stripeCustomerId }
      : { customer_email: email };

    const session = await stripe.checkout.sessions.create({
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
      throw new AppError(500, 'billing_error', 'Failed to create checkout session');
    }

    return session.url;
  }

  async createPortalSession(userId: string): Promise<string> {
    const user = await findUserById(userId);
    if (!user?.stripeCustomerId) {
      throw new AppError(400, 'billing_error', 'No billing account found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${config.WEB_URL}/dashboard`,
    });

    return session.url;
  }

  async handleWebhook(body: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        config.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      // Capture to Sentry - could indicate webhook secret misconfiguration or security probe
      Sentry.captureException(err, {
        extra: {
          source: 'billing_webhook',
          errorType: 'signature_verification_failed',
        },
      });
      // SECURITY: Only log error message, not full error object which may contain sensitive Stripe SDK details
      console.error('Webhook signature verification failed:', err instanceof Error ? err.message : 'Unknown error');
      throw new AppError(400, 'webhook_error', 'Invalid signature');
    }

    // Database-backed idempotency check (MEDIUM-013)
    // Atomic INSERT prevents race conditions and survives server restarts
    const isNewEvent = await tryMarkWebhookProcessed(event.id, event.type);
    if (!isNewEvent) {
      // eslint-disable-next-line no-console -- Intentional logging for webhook debugging
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
          const session = event.data.object;
          await this.handleCheckoutComplete(session);
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          await this.handleSubscriptionUpdate(subscription);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          await this.handleSubscriptionDelete(subscription);
          break;
        }

        case 'invoice.paid': {
          const invoice = event.data.object;
          await this.handleInvoicePaid(invoice);
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          await this.handleInvoicePaymentFailed(invoice);
          break;
        }
      }
    } catch (handlerError) {
      // Handler failed — delete idempotency record so Stripe retry will be processed
      Sentry.captureException(handlerError, {
        extra: {
          source: 'billing_webhook',
          errorType: 'handler_failed',
          eventId: event.id,
          eventType: event.type,
        },
      });

      try {
        await deleteProcessedWebhookEvent(event.id);
      } catch (cleanupError) {
        // Cleanup also failed — event is permanently stuck. Capture separately.
        Sentry.captureException(cleanupError, {
          extra: {
            source: 'billing_webhook',
            errorType: 'idempotency_cleanup_failed',
            eventId: event.id,
            eventType: event.type,
          },
        });
      }

      // Re-throw so Stripe receives 500 and schedules a retry
      throw handlerError;
    }
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) {
      await this.logMissingUserIdError('checkout.session.completed', {
        sessionId: session.id,
        customerId: session.customer,
      });
      return;
    }

    await updateUserSubscription(
      userId,
      session.customer as string,
      session.subscription as string,
      'active'
    );

    await auditService.log({
      userId,
      action: AuditAction.SUBSCRIPTION_CREATED,
      status: 'SUCCESS',
      metadata: {
        subscriptionId: session.subscription,
        customerId: session.customer,
      },
    });
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    if (!userId) {
      await this.logMissingUserIdError('customer.subscription.updated', {
        subscriptionId: subscription.id,
      });
      return;
    }

    await updateSubscriptionStatus(userId, subscription.status);
  }

  private async handleSubscriptionDelete(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    if (!userId) {
      await this.logMissingUserIdError('customer.subscription.deleted', {
        subscriptionId: subscription.id,
      });
      return;
    }

    await updateSubscriptionStatus(userId, 'canceled');

    await auditService.log({
      userId,
      action: AuditAction.SUBSCRIPTION_CANCELLED,
      status: 'SUCCESS',
      metadata: { subscriptionId: subscription.id },
    });
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    // Only process subscription invoices (not one-time payments)
    // In API 2026+, subscription is accessed via parent.subscription_details
    const subscriptionId = this.getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      return;
    }

    // Get userId from subscription metadata
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata.userId;
    if (!userId) {
      await this.logMissingUserIdError('invoice.paid', {
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
      });
      return;
    }

    // H-3: Only reactivate from states where payment resolves the issue.
    // Don't reactivate canceled subscriptions — that requires explicit re-subscribe.
    const user = await findUserById(userId);

    if (!user) {
      // User was deleted between subscription creation and invoice payment
      Sentry.captureException(new Error('invoice.paid received for non-existent user'), {
        extra: {
          source: 'billing_webhook',
          errorType: 'user_not_found',
          userId,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
        },
      });
      console.error(JSON.stringify({
        level: 'error',
        event: 'invoice_paid_user_not_found',
        userId,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    const currentStatus = user.subscriptionStatus;
    const reactivatableStatuses = new Set(['past_due', 'trialing', 'unpaid']);

    if (currentStatus === 'canceled') {
      // Could indicate Stripe misconfiguration — alert via Sentry
      Sentry.captureException(new Error('invoice.paid received for canceled subscription'), {
        extra: {
          source: 'billing_webhook',
          errorType: 'invoice_paid_canceled_subscription',
          userId,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
        },
      });
      console.error(JSON.stringify({
        level: 'error',
        event: 'invoice_paid_skipped_canceled',
        userId,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        reason: 'Subscription is canceled — invoice.paid does not reactivate',
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    if (!reactivatableStatuses.has(currentStatus)) {
      // Already 'active' or unknown status — skip (idempotent, no update needed)
      return;
    }

    await updateSubscriptionStatus(userId, 'active');

    // Log successful renewal (not initial payment, which is handled by checkout.session.completed)
    if (invoice.billing_reason === 'subscription_cycle') {
      await auditService.log({
        userId,
        action: AuditAction.SUBSCRIPTION_CREATED, // Reusing for renewal - consider adding SUBSCRIPTION_RENEWED
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
    // Only process subscription invoices
    const subscriptionId = this.getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata.userId;
    if (!userId) {
      await this.logMissingUserIdError('invoice.payment_failed', {
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
      });
      return;
    }

    // Update status to past_due - Stripe handles retries automatically
    await updateSubscriptionStatus(userId, 'past_due');

    await auditService.log({
      userId,
      action: AuditAction.SUBSCRIPTION_CANCELLED, // Reusing - consider adding PAYMENT_FAILED
      status: 'FAILURE',
      metadata: {
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        reason: 'payment_failed',
      },
    });

    // TODO: Send email notification to user about failed payment
    // This would integrate with your email service (Resend)
  }

  /**
   * Extract subscription ID from invoice.
   * In API version 2025-12-15.clover, subscription is nested in parent.subscription_details
   */
  private getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
    const subDetails = invoice.parent?.subscription_details;
    if (!subDetails?.subscription) {
      return null;
    }
    // subscription can be string ID or expanded Subscription object
    if (typeof subDetails.subscription === 'string') {
      return subDetails.subscription;
    }
    return subDetails.subscription.id;
  }

  /**
   * Log missing userId in webhook metadata with structured logging and audit trail.
   * This happens when a subscription wasn't created through our checkout flow
   * (e.g., created manually in Stripe Dashboard).
   */
  private async logMissingUserIdError(
    eventType: string,
    context: { subscriptionId?: string; customerId?: unknown; sessionId?: string; invoiceId?: string }
  ): Promise<void> {
    // Capture to Sentry - revenue-impacting data integrity issue
    // Explicitly pick safe fields to avoid accidentally leaking sensitive data
    Sentry.captureException(new Error('Webhook missing userId in metadata'), {
      extra: {
        source: 'billing_webhook',
        eventType,
        subscriptionId: context.subscriptionId,
        customerId: context.customerId,
        sessionId: context.sessionId,
        invoiceId: context.invoiceId,
      },
    });

    // Structured logging for alerting systems (can be parsed by log aggregators)
    console.error(JSON.stringify({
      level: 'error',
      event: 'webhook_missing_user_id',
      eventType,
      ...context,
      timestamp: new Date().toISOString(),
    }));

    // Audit trail for HIPAA compliance (userId null for system-level events)
    await auditService.log({
      userId: null,
      action: AuditAction.WEBHOOK_PROCESSING_FAILED,
      status: 'FAILURE',
      metadata: {
        reason: 'missing_user_metadata',
        eventType,
        ...context,
      },
    });
  }
}

export const billingService = new BillingService();
