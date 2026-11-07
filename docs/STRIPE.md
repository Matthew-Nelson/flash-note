# Stripe Integration Reference

**Last Updated:** 2026-11-07

Reference documentation for the Stripe payment integration — architecture, dashboard config, test cards, and security notes.

> **For task status**, see [ROADMAP.md](./ROADMAP.md).

---

## What's Implemented

- Checkout session creation with subscription mode
- Customer billing portal sessions
- Webhook signature verification + handlers (`checkout.session.completed`, `subscription.updated`, `subscription.deleted`, `invoice.paid`, `invoice.payment_failed`)
- User metadata propagation (userId in subscription metadata)
- Audit logging for subscription events
- Promotion codes support (`allow_promotion_codes: true`)
- Webhook idempotency (database-backed, atomic INSERT); the idempotency row is deleted and the error rethrown when a handler fails, so Stripe's retry is processed (`web/src/server/services/billing.ts:194-243`)
- Raw body parsing for webhook signature verification (`web/src/app/api/webhooks/stripe/route.ts:5-7`)
- Price validation (Zod schema in `web/src/actions/billing.ts:12-27` validates against `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL`)
- Structured logging for webhook processing failures
- Subscription gate for note generation: `checkSubscriptionAccess` (`web/src/server/services/subscription.ts`), called from `web/src/actions/notes.ts:99`. Allows an active subscription or an unexpired trial, falls back to the organization's subscription, and otherwise denies with `trial_expired`, `subscription_required`, or `clinic_subscription_expired`
- `invoice.payment_failed` sets the user's subscription status to `past_due` and writes a `PAYMENT_FAILED` audit entry (`billing.ts:404-432`). It does not send an email

---

## Operations

### Webhook Event Cleanup Job

**Status:** Endpoint exists; nothing schedules it.

The `processed_webhook_events` table stores event IDs to prevent duplicate processing and grows without cleanup.

- Route Handler: `POST /api/cleanup/webhook-events` (`web/src/app/api/cleanup/webhook-events/route.ts`). Requires `Authorization: Bearer <CLEANUP_SECRET>` and deletes events older than 7 days.
- DAL: `cleanupOldWebhookEvents(daysToKeep = 7)` in `web/src/server/dal/webhooks.ts:43`.
- Scheduling: the route's comment says it is called by Cloud Scheduler, but no scheduler is defined. A search of `infra/` and `.github/` finds only the `CLEANUP_SECRET` secret wiring (`infra/secrets.tf:14`, `infra/cloudrun-service.tf:188`). A scheduled caller still has to be created.

**Retention:** 7 days is safe (Stripe retries for up to 72 hours).

---

## Environment Variables

### Required for Production

```bash
# Stripe API Keys (get from Stripe Dashboard → Developers → API keys)
STRIPE_SECRET_KEY=sk_live_xxx  # Live secret key
STRIPE_WEBHOOK_SECRET=whsec_xxx  # From production webhook endpoint

# Allowed checkout price IDs (checkout is rejected if neither is set)
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_ANNUAL=price_xxx

# Pricing page (client-visible price IDs passed to checkout)
NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_ANNUAL=price_xxx

# Webhook event cleanup endpoint auth
CLEANUP_SECRET=xxx
```

---

## Local Webhook Testing

Use the Stripe CLI to forward test-mode events to the dev server:

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

`stripe listen` prints a signing secret (`whsec_...`). Set it as `STRIPE_WEBHOOK_SECRET` in your local env file (see `web/.env.example`) and keep the listener running while you test.

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

3. **Idempotency** - ✅ Implemented
   - Database-backed with `processed_webhook_events` table
   - Atomic `INSERT ... ON CONFLICT DO NOTHING` prevents race conditions
   - Survives server restarts and works across multiple instances
   - See Operations section for cleanup job status

4. **HTTPS Only** - ✅ Required by Stripe
   - Production webhook must use HTTPS

5. **Price Validation** - ✅ Implemented
   - Zod schema validates priceId against `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL`
   - Fail-closed: if neither env var is set, all checkout attempts are rejected (`web/src/actions/billing.ts:12-15`)
   - Prevents arbitrary price ID attacks

6. **Error Handling** - ✅ Implemented
   - Signature failures throw `WebhookSignatureError` without the underlying error (`billing.ts:177-185`)
   - Handler failures are logged with structured context (`webhook_handler_failed`)
   - Audit trail via `WEBHOOK_PROCESSING_FAILED` action

---

## Architecture Notes

### Webhook Flow
```
Stripe → webhook endpoint → signature verification → event routing → database update → audit log
```

### Current Limitations

1. **Retries rely on Stripe** - If a handler fails, `billing.ts` deletes the idempotency row and rethrows so Stripe receives a 500 and redelivers. If that row deletion also fails, the event stays marked processed and will not be reprocessed (logged as `idempotency_cleanup_failed`, `billing.ts:238`)
2. **No dead letter queue** - Failed events are logged but not queued for manual review
3. **Single price per checkout** - UI would need update for quantity or multiple products

### Future Considerations

1. **Metered billing** - If adding usage-based pricing later
2. **Multiple subscriptions** - Current schema assumes one subscription per user
3. **Coupons/discounts** - Promotion codes enabled but no UI for applying
4. **Invoices** - No invoice download UI (available in Stripe portal)

---

## Related Documentation

- [ROADMAP.md](./ROADMAP.md) - Task status (failed-payment email is under Retention features)
