# Stripe Integration Reference

**Last Updated:** February 14, 2026

Reference documentation for the Stripe payment integration — architecture, dashboard config, test cards, and security notes.

> **For task status**, see the [Stripe section in ROADMAP.md](./ROADMAP.md#stripe). For Stripe dashboard config tasks, see [PRE_LAUNCH_CHECKLIST.md §3](./PRE_LAUNCH_CHECKLIST.md).

---

## What's Implemented

- Checkout session creation with subscription mode
- Customer billing portal sessions
- Webhook signature verification + handlers (`checkout.session.completed`, `subscription.updated`, `subscription.deleted`, `invoice.paid`, `invoice.payment_failed`)
- User metadata propagation (userId in subscription metadata)
- Audit logging for subscription events
- Promotion codes support (`allow_promotion_codes: true`)
- Webhook idempotency (database-backed, atomic INSERT)
- Raw body parsing for webhook signature verification
- Price validation (Zod schema validates against allowed price IDs)
- Structured logging for webhook processing failures
- Subscription enforcement middleware (`requireActiveSubscription`) with trial support

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
0 3 * * * curl -X POST https://api.flashnote.co/admin/cleanup-webhook-events
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

**Query available:** `cleanupOldWebhookEvents(daysToKeep)` in `web/src/server/dal/webhooks.ts`

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

## Test Cards
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

- [ROADMAP.md — Stripe section](./ROADMAP.md#stripe) - Remaining task status
- [PRE_LAUNCH_CHECKLIST.md §3](./PRE_LAUNCH_CHECKLIST.md) - Stripe Dashboard config tasks
- [BUSINESS_COST_ANALYSIS.md](./reference/BUSINESS_COST_ANALYSIS.md) - Stripe fee analysis
