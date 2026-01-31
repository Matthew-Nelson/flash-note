# Stripe Integration TODOs

**Last Updated:** January 2026

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
- [x] Webhook idempotency (in-memory, see TODO below)
- [x] Raw body parsing for webhook signature verification

### Not Implemented
- [ ] Subscription enforcement middleware (block expired trials)
- [ ] Failed payment email notifications
- [ ] Trial ending soon notifications
- [ ] Subscription reactivation flow
- [ ] Price validation (verify priceId is allowed)
- [ ] Customer portal configuration in Stripe Dashboard

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
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

---

## Code TODOs

### HIGH Priority (Before Launch)

#### 1. Subscription Enforcement Middleware
**Location:** Need to create `backend/src/middleware/subscription.ts`

```typescript
// Middleware to check if user has active subscription or valid trial
// Should block access to /notes endpoints when:
// - subscription_status is 'canceled' or 'unpaid'
// - subscription_status is 'trialing' AND trial_ends_at < NOW()
// - subscription_status is 'past_due' (grace period TBD)
```

**Acceptance Criteria:**
- Trial users can access notes during trial period
- Expired trial users get 402 `trial_expired` error
- Active subscribers can access notes
- Canceled users get 402 `subscription_required` error
- Past due users get grace period (configurable)

#### 2. Price Validation
**Location:** `backend/src/routes/billing.ts`

Currently any priceId is accepted. Should validate against allowed prices:

```typescript
const ALLOWED_PRICE_IDS = [
  config.STRIPE_PRICE_MONTHLY,
  config.STRIPE_PRICE_ANNUAL,
];

if (!ALLOWED_PRICE_IDS.includes(priceId)) {
  throw new AppError(400, 'invalid_price', 'Invalid price ID');
}
```

### MEDIUM Priority (Before Launch)

#### 3. Failed Payment Email Notification
**Location:** `backend/src/services/billing-service.ts:238`

```typescript
// TODO: Send email notification to user about failed payment
// This would integrate with your email service (Resend)
```

**Implementation:**
- Use existing email service to send payment failed email
- Include link to update payment method (billing portal)
- Consider retry schedule information

#### 4. Database-Backed Webhook Idempotency
**Location:** `backend/src/services/billing-service.ts:11`

```typescript
// TODO: For production, replace with database-backed storage (see MEDIUM-013 in security audit)
// This prevents duplicate event processing but is lost on server restart
```

**Current State:** In-memory Map that's lost on server restart
**Recommended:** Add `processed_webhook_events` table or use Redis

### LOW Priority (Post-Launch)

#### 5. Trial Ending Soon Notification
Send email 3 days before trial expires to encourage conversion.

#### 6. Subscription Reactivation Flow
Allow users to resubscribe after cancellation without creating new checkout session.

#### 7. Add SUBSCRIPTION_RENEWED Audit Action
**Location:** `backend/src/types/index.ts`

Currently reusing `SUBSCRIPTION_CREATED` for renewals. Consider adding distinct action.

#### 8. Add PAYMENT_FAILED Audit Action
**Location:** `backend/src/types/index.ts`

Currently reusing `SUBSCRIPTION_CANCELLED` with FAILURE status. Consider adding distinct action.

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

3. **Idempotency** - ⚠️ Partial
   - In-memory cache implemented
   - Should upgrade to database-backed for production

4. **HTTPS Only** - ✅ Required by Stripe
   - Production webhook must use HTTPS

5. **Price Validation** - ❌ Not Implemented
   - Should validate priceId against allowed values

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
- [API.md](./API.md) - Billing endpoints documentation
- [BUSINESS_COST_ANALYSIS.md](./BUSINESS_COST_ANALYSIS.md) - Stripe fee analysis
- Security Audit: MEDIUM-013 (webhook idempotency)
