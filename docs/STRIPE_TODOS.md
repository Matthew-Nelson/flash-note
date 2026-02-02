# Stripe Integration TODOs

**Last Updated:** February 1, 2026

This document tracks all outstanding work for the Stripe payment integration before go-live.

---

## Current Status

### Implemented
- [x] Checkout session creation with subscription mode
- [x] Customer billing portal sessions
- [x] Webhook signature verification
- [x] Webhook handlers for:
  - `checkout.session.completed` - Creates subscription
  - `customer.subscription.updated` - Updates status
  - `customer.subscription.deleted` - Marks as canceled
  - `invoice.paid` - Marks as active after renewal
  - `invoice.payment_failed` - Marks as past_due
- [x] User metadata propagation (userId in subscription metadata)
- [x] Audit logging for subscription events
- [x] Promotion codes support (`allow_promotion_codes: true`)
- [x] Webhook idempotency (database-backed, atomic INSERT)
- [x] Raw body parsing for webhook signature verification
- [x] Price validation (Zod schema validates against allowed price IDs)
- [x] Structured logging for webhook processing failures
- [x] Audit trail for missing userId in webhook metadata
- [x] Subscription enforcement middleware (`requireActiveSubscription`)
  - Trial users can access notes during trial period
  - Expired trial users get 402 `trial_expired` error
  - Active subscribers can access notes
  - Canceled/past_due/unpaid users get 402 `subscription_required` error

### Not Implemented
- [ ] Failed payment email notifications
- [ ] Trial ending soon notifications
- [ ] Subscription reactivation flow
- [ ] Customer portal configuration in Stripe Dashboard
- [ ] Webhook event cleanup job (see Operations section below)
- [ ] Post-checkout subscription sync for extension
  - Issue: Users completing checkout cannot immediately use /notes/generate
  - The webhook updates the database, but the extension's cached user state is stale
  - Potential solutions: poll for status after checkout, WebSocket notification, or force token refresh

---

## Pre-Launch Checklist

### Stripe Dashboard Configuration

| Task | Status | Notes |
|------|--------|-------|
| Create Stripe account | Done | Flash Note Sandbox |
| Complete identity verification | TODO | Required for live mode |
| Create products and prices | Done | Monthly $29, Annual $290 |
| Configure Customer Portal | TODO | Enable cancel, update payment, view invoices |
| Add production webhook endpoint | TODO | `https://api.flashnote.app/billing/webhook` |
| Configure webhook events | TODO | See events list below |
| Switch to live mode | TODO | After all testing complete |

### Webhook Events to Subscribe

In Stripe Dashboard → Developers → Webhooks, subscribe to:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

> **Note:** `customer.subscription.created` is not needed - `checkout.session.completed` handles new subscriptions created through our checkout flow.

---

## Code TODOs

### MEDIUM Priority (Before Launch)

#### 1. Failed Payment Email Notification
**Location:** `backend/src/services/billing-service.ts` (see TODO comment)

```typescript
// TODO: Send email notification to user about failed payment
// This would integrate with your email service (Resend)
```

**Implementation:**
- Use existing email service to send payment failed email
- Include link to update payment method (billing portal)
- Consider retry schedule information

### LOW Priority (Post-Launch)

#### 2. Trial Ending Soon Notification
Send email 3 days before trial expires to encourage conversion.

#### 3. Subscription Reactivation Flow
Allow users to resubscribe after cancellation without creating new checkout session.

#### 4. Add SUBSCRIPTION_RENEWED Audit Action
**Location:** `backend/src/types/index.ts`

Currently reusing `SUBSCRIPTION_CREATED` for renewals. Consider adding distinct action.

#### 5. Add PAYMENT_FAILED Audit Action
**Location:** `backend/src/types/index.ts`

Currently reusing `SUBSCRIPTION_CANCELLED` with FAILURE status. Consider adding distinct action.

---

## Operations

### Webhook Event Cleanup Job

**Status:** NOT CONFIGURED - Required before production

The `processed_webhook_events` table stores event IDs to prevent duplicate processing. This table will grow indefinitely without cleanup.

**Required:** Set up a scheduled job to clean up old events. Options:

**Option A: pg_cron (PostgreSQL extension)**
```sql
-- Run daily at 3 AM UTC
SELECT cron.schedule('cleanup-webhook-events', '0 3 * * *', $$
  DELETE FROM processed_webhook_events
  WHERE processed_at < NOW() - INTERVAL '7 days'
$$);
```

**Option B: External cron job**
```bash
# Add to crontab or use a scheduler like AWS EventBridge
0 3 * * * curl -X POST https://api.flashnote.app/admin/cleanup-webhook-events
```

**Option C: Application-level scheduled task**
```typescript
// Using node-cron or similar
import { cleanupOldWebhookEvents } from './db/queries/webhooks.js';

cron.schedule('0 3 * * *', async () => {
  const deleted = await cleanupOldWebhookEvents(7);
  console.log(`Cleaned up ${deleted} old webhook events`);
});
```

**Retention:** 7 days is safe (Stripe retries for up to 72 hours).

**Query available:** `cleanupOldWebhookEvents(daysToKeep)` in `backend/src/db/queries/webhooks.ts`

---

## Environment Variables

### Required for Production

```bash
# Stripe API Keys (get from Stripe Dashboard → Developers → API keys)
STRIPE_SECRET_KEY=sk_live_xxx  # Live secret key
STRIPE_WEBHOOK_SECRET=whsec_xxx  # From production webhook endpoint

# Optional - for price validation
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_ANNUAL=price_xxx
```

### Web App (if using Stripe.js for future features)

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

---

## Testing Checklist

### Local Development
- [x] Webhook receives events via Stripe CLI
- [x] Signature verification works
- [x] checkout.session.completed updates database
- [x] customer.subscription.deleted updates database
- [ ] invoice.payment_failed updates database (test with real subscription)
- [ ] invoice.paid updates database (test with real subscription)

### Staging/Production
- [ ] Webhook endpoint accessible from internet
- [ ] Webhook signature verification with production secret
- [ ] Full checkout flow with test card
- [ ] Subscription cancellation via portal
- [ ] Payment failure handling (use card `4000000000000341`)

### Test Cards
| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0341 | Attaches but fails on first charge attempt |
| 4000 0000 0000 9995 | Decline (insufficient funds) |
| 4000 0000 0000 0002 | Decline (generic) |

---

## Security Considerations

1. **Webhook Signature Verification** - ✅ Implemented
   - Always verify `stripe-signature` header
   - Use raw body (not parsed JSON)

2. **Metadata Integrity** - ✅ Implemented
   - userId stored in subscription metadata, not just session
   - Prevents metadata loss on subscription lifecycle events

3. **Idempotency** - ✅ Implemented (MEDIUM-013 resolved)
   - Database-backed with `processed_webhook_events` table
   - Atomic `INSERT ... ON CONFLICT DO NOTHING` prevents race conditions
   - Survives server restarts and works across multiple instances
   - See Operations section for cleanup job requirement

4. **HTTPS Only** - ✅ Required by Stripe
   - Production webhook must use HTTPS

5. **Price Validation** - ✅ Implemented
   - Zod schema validates priceId against `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL`
   - Development mode fallback when env vars not configured
   - Prevents arbitrary price ID attacks

6. **Error Handling** - ✅ Implemented
   - Webhook signature errors log only message, not full error object
   - Missing userId logged with structured JSON for alerting
   - Audit trail via `WEBHOOK_PROCESSING_FAILED` action

---

## Architecture Notes

### Webhook Flow
```
Stripe → webhook endpoint → signature verification → event routing → database update → audit log
```

### Current Limitations

1. **No retry mechanism** - If webhook handler fails after marking event as processed, it won't retry
2. **No dead letter queue** - Failed events are logged but not queued for manual review
3. **Single price per checkout** - UI would need update for quantity or multiple products

### Future Considerations

1. **Metered billing** - If adding usage-based pricing later
2. **Multiple subscriptions** - Current schema assumes one subscription per user
3. **Coupons/discounts** - Promotion codes enabled but no UI for applying
4. **Invoices** - No invoice download UI (available in Stripe portal)

---

## Related Documentation

- [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) - Section 3: Financial & Payment Setup
- [API.md](./guides/API.md) - Billing endpoints documentation
- [BUSINESS_COST_ANALYSIS.md](./reference/BUSINESS_COST_ANALYSIS.md) - Stripe fee analysis
- [SECURITY_AUDIT.md](./compliance/SECURITY_AUDIT.md) - MEDIUM-013 (webhook idempotency) - ✅ RESOLVED
