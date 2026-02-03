# Sentry Logging Gaps - Coverage Audit

**Created:** February 3, 2026
**Status:** Documented - Fix Before Launch
**Priority:** P1
**Affected Components:** Backend, Web App, Extension

---

## Executive Summary

An audit of all `catch` blocks and error handling paths across the codebase identified 18 locations where errors are handled. Of these, **8 are critical or important gaps** where errors are swallowed with only `console.error` (or mapped to `AppError` which skips Sentry), **4 are nice-to-have improvements**, and **6 are appropriately silent**.

The most significant blind spot is the backend AI service — if Gemini goes down, Sentry shows zero backend errors because LLM errors are mapped to `AppError` before reaching the global handler. The client-side retry exhaustion captures the symptom (API returned 500), but the root cause (e.g., "Gemini auth expired" vs "rate limited") is invisible.

---

## Critical Gaps

These represent blind spots in core product functionality or compliance requirements.

### 1. LLM/AI Service Errors Invisible to Sentry

- [ ] **Fix applied**
- **File:** `backend/src/services/ai-service.ts:142`
- **Current behavior:** `console.error('LLM error:', error.toSafeLogObject())` then maps to `AppError`. Since `AppError` is treated as an expected error, the global handler skips Sentry.
- **Impact:** Core product feature. If Gemini has an outage, rate-limits, or auth failure, the backend produces zero Sentry events. The client captures the 500 response, but the root cause is lost.
- **Fix:** Add `Sentry.captureException(error)` before mapping to `AppError`. Capture with extras like `{ errorType, provider, model }`. Consider excluding `rate_limited` if it happens frequently during normal operation.

### 2. Stripe Webhook Proxy Errors Silent

- [ ] **Fix applied**
- **File:** `web/src/app/api/webhooks/stripe/route.ts:41,50`
- **Current behavior:** `console.error('Backend webhook error:', errorBody)` and `console.error('Webhook error:', error)` — no Sentry capture.
- **Impact:** If the backend is unreachable, all Stripe payment events (subscriptions, cancellations, renewals) are silently lost. This is critical payment infrastructure.
- **Fix:** Add `Sentry.captureException()` in both catch paths with extras like `{ source: 'stripe_webhook_proxy', statusCode }`.

### 3. Missing userId in Billing Webhook Events

- [ ] **Fix applied**
- **File:** `backend/src/services/billing-service.ts:266-290` (called from lines 116-121, 144-148, 156-160, 184-189, 219-224)
- **Current behavior:** `console.error(JSON.stringify({...}))` + audit log — no Sentry capture.
- **Impact:** Webhook events without userId in metadata can't be linked to a user. Payment failures, subscription cancellations, and renewals are silently unprocessable. Revenue-impacting data integrity issue.
- **Fix:** Add `Sentry.captureException()` with extras like `{ source: 'billing_webhook', eventType, subscriptionId }`.

### 4. HIPAA Audit Log Write Failures

- [ ] **Fix applied**
- **File:** `backend/src/services/audit-service.ts:20-23`
- **Current behavior:** `console.error('Audit log failed:', error)` — no Sentry capture.
- **Impact:** HIPAA requires reliable audit logging. If the database has transient issues causing audit writes to fail, there is no visibility. This is a compliance gap.
- **Fix:** Add `Sentry.captureException(error, { extra: { source: 'audit_service', action, userId } })`.

---

## Important Gaps

These affect user experience or security visibility but are not immediately revenue/compliance critical.

### 5. Verification Email Failure During Registration

- [ ] **Fix applied**
- **File:** `backend/src/services/auth-service.ts:49-54`
- **Current behavior:** `console.error('Failed to send verification email:', error)` — swallowed, no Sentry.
- **Impact:** New users silently don't receive verification emails, blocking their entire workflow (email verification is required for note generation and billing).
- **Fix:** Add `Sentry.captureException(error, { extra: { source: 'registration', errorType: 'verification_email_failed' } })`.

### 6. Account Lockout Service Failures

- [ ] **Fix applied**
- **File:** `backend/src/services/auth-service.ts:89-92, 104-107, 122-124`
- **Current behavior:** Three separate `console.error(...)` blocks — no Sentry capture.
- **Impact:** The brute-force protection mechanism is silently degraded. The fail-secure behavior is correct (login is rejected or proceeds safely), but operational visibility into security control failures is lost.
- **Fix:** Add `Sentry.captureException()` in each block with `{ source: 'lockout_service' }`.

### 7. Email Service Send Failures

- [ ] **Fix applied**
- **File:** `backend/src/services/email-service.ts:202-205`
- **Current behavior:** `console.error('Email send error:', error)` then throws a new Error. The thrown error reaches the global handler in most paths, but verification email failures during registration (Gap #5) are caught and swallowed upstream.
- **Impact:** Email delivery failures affect password resets and verification.
- **Fix:** Add `Sentry.captureException(error, { extra: { source: 'email_service', template } })` before re-throwing.

### 8. Webhook Signature Verification Failures

- [ ] **Fix applied**
- **File:** `backend/src/services/billing-service.ts:66-69`
- **Current behavior:** `console.error(...)` then throws `AppError(400, ...)`. Because it's an `AppError`, the global handler skips Sentry.
- **Impact:** Repeated signature failures could indicate webhook secret misconfiguration or a security probe. Individual occurrences are expected (Stripe retries), but a pattern indicates a real problem.
- **Fix:** Add `Sentry.captureException()` before throwing, or consider capturing as a warning-level message.

---

## Nice-to-Have

Lower priority improvements that would add diagnostic value.

### 9. 5xx AppErrors Skip Sentry

- [ ] **Fix applied**
- **File:** `backend/src/middleware/error-handler.ts:44-52`
- **Current behavior:** All `AppError` instances are logged to console only. Only unknown errors go to Sentry.
- **Impact:** Server-side failures (5xx) thrown as `AppError` are invisible to Sentry.
- **Fix:** Selectively capture `AppError` instances with `status >= 500` to Sentry while leaving 4xx (client errors) as expected.

### 10. Checkout/Billing UI Errors (Web)

- [ ] **Fix applied**
- **Files:** `web/src/app/pricing/page.tsx:67`, `web/src/app/dashboard/page.tsx:92`
- **Current behavior:** Checkout and billing API failures caught in page components, displayed to user — no Sentry capture.
- **Impact:** Revenue-impacting failures visible only if the user reports them.
- **Fix:** Add `Sentry.captureException()` in billing/checkout catch blocks only (not auth form errors).

### 11. SessionStorage Write Failures (Web)

- [ ] **Fix applied**
- **File:** `web/src/lib/storage.ts:51-53`
- **Current behavior:** `console.error('Failed to store auth:', error)` — no Sentry.
- **Impact:** Rare edge case (storage quota exceeded). Could help diagnose "users getting logged out" complaints.
- **Fix:** Add `Sentry.captureException()` with `{ source: 'session_storage' }`.

### 12. Chrome Storage Read Failure (Extension)

- [ ] **Fix applied**
- **File:** `extension/src/sidepanel/hooks/useAuth.ts:45-46`
- **Current behavior:** `console.error('Failed to load auth:', error)` — no Sentry.
- **Impact:** Could help diagnose extension storage corruption issues.
- **Fix:** Add `captureException(error, { source: 'chrome_storage_read' })`.

---

## Appropriate Silence (No Action Needed)

These catch blocks are correctly silent or console-only. Documenting here to confirm they were reviewed.

| Location | What it catches | Why silence is correct |
|----------|----------------|----------------------|
| `web/src/lib/api.ts` — `refreshUser()` | Network errors during background user refresh | Transient polling operation; user can refresh manually |
| `extension/src/sidepanel/hooks/useAuth.ts` — logout | API logout call failure | Expected when token already expired; local state cleared regardless |
| `extension/src/sidepanel/hooks/useAuth.ts` — `refreshUser()` | User refresh failure | Background polling, same as web |
| `extension/src/sidepanel/hooks/useApi.ts` — generic hook | All API errors | UI-level handler; `api.ts` already captures retryable failures |
| `extension/src/shared/api.ts` — storage clear | Storage clear during auth invalidation | Non-critical fallback; auth event already dispatched |
| `extension/src/shared/api.ts` — `refreshUser()` | Network errors during refresh | Background polling, transient |
| Web page form catches (login, signup, forgot-password, etc.) | API validation/auth errors | Expected user input errors displayed in UI; backend captures server errors |

---

## Implementation Notes

### Common Pattern

Most gaps follow the same fix pattern — add a Sentry capture before or alongside the existing `console.error`:

**Backend:**
```typescript
import * as Sentry from '@sentry/node';

// Before:
console.error('Something failed:', error);

// After:
Sentry.captureException(error, {
  extra: { source: 'service_name', errorType: 'descriptive_type' },
});
console.error('Something failed:', error);
```

**Web (server-side route):**
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.captureException(error, {
  extra: { source: 'stripe_webhook_proxy' },
});
```

### PHI Safety

All Sentry integrations already have `beforeSend` PHI sanitization. The extras added in these fixes use only safe metadata (source identifiers, error types, status codes) — never patient data. No additional sanitization is needed for these changes.
