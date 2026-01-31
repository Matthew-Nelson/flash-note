import Stripe from 'stripe';
import { config } from '../config.js';
import { findUserById, updateUserSubscription, updateSubscriptionStatus } from '../db/queries/users.js';
import { auditService } from './audit-service.js';
import { AuditAction } from '../types/index.js';
import { AppError } from '../middleware/error-handler.js';

const stripe = new Stripe(config.STRIPE_SECRET_KEY);

// In-memory idempotency cache for webhook events
// TODO: For production, replace with database-backed storage (see MEDIUM-013 in security audit)
// This prevents duplicate event processing but is lost on server restart
const processedEvents = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cleanupOldEvents(): void {
  const now = Date.now();
  for (const [eventId, timestamp] of processedEvents) {
    if (now - timestamp > IDEMPOTENCY_TTL_MS) {
      processedEvents.delete(eventId);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupOldEvents, 60 * 60 * 1000);

class BillingService {
  async createCheckoutSession(
    userId: string,
    email: string,
    priceId: string
  ): Promise<string> {
    const session = await stripe.checkout.sessions.create({
      customer_email: email,
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
      console.error('Webhook signature verification failed:', err);
      throw new AppError(400, 'webhook_error', 'Invalid signature');
    }

    // Idempotency check - skip if already processed
    if (processedEvents.has(event.id)) {
      // eslint-disable-next-line no-console -- Intentional logging for webhook debugging
      console.log(`Skipping duplicate webhook event: ${event.id}`);
      return;
    }

    // Mark as processed before handling (prevents concurrent duplicates)
    processedEvents.set(event.id, Date.now());

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
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) {
      console.error('Checkout session missing userId in metadata');
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
      console.error('Subscription missing userId in metadata');
      return;
    }

    await updateSubscriptionStatus(userId, subscription.status);
  }

  private async handleSubscriptionDelete(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    if (!userId) {
      console.error('Subscription missing userId in metadata');
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
      console.error('Subscription missing userId in metadata for invoice');
      return;
    }

    // Ensure subscription status is active after successful payment
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
      console.error('Subscription missing userId in metadata for failed invoice');
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
   * In Stripe API 2026+, subscription is nested in parent.subscription_details
   */
  private getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
    const subDetails = invoice.parent?.subscription_details;
    if (!subDetails?.subscription) {
      return null;
    }
    // subscription can be string or expanded Subscription object
    if (typeof subDetails.subscription === 'string') {
      return subDetails.subscription;
    }
    return subDetails.subscription.id;
  }
}

export const billingService = new BillingService();
