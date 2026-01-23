import Stripe from 'stripe';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { findUserById, updateUserSubscription, updateSubscriptionStatus } from '../db/queries/users.js';
import { auditService } from './audit-service.js';
import { AuditAction } from '../types/index.js';
import { AppError } from '../middleware/error-handler.js';

const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

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
      success_url: `${config.WEB_URL}/dashboard?success=true`,
      cancel_url: `${config.WEB_URL}/pricing?canceled=true`,
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

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionDelete(subscription);
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
}

export const billingService = new BillingService();
