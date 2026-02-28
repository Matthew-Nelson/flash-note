# FlashNote Consolidated Security & Production Readiness Audit

**Date:** 2026-02-12 (consolidated 2026-02-13)
**Scope:** Full codebase audit — backend, extension, web app, database, CI/CD, dependencies
**Source:** Consolidated from two independent automated audits with line-by-line verification against actual codebase
**Status:** Findings documented, no fixes applied yet

---

## Methodology

Two independent AI-driven audits were performed on 2026-02-12:
1. **Code Quality & Security Audit** — Line-by-line security and code quality review with second-pass deep dive
2. **Production Readiness Audit** — Production engineering checklist covering performance, error handling, auth, payments, and scale

This document consolidates both audits, de-duplicates overlapping findings, and independently verifies each claim against the actual codebase. Claims found to be incorrect or mis-categorized are noted.

---

## Findings Summary

| Severity | Count |
|----------|-------|
| **CRITICAL** | 5 |
| **HIGH** | 18 |
| **MEDIUM** | 28 |
| **LOW** | 18 |
| **Total Findings** | **69** |
| **Invalidated Claims** | **4** |

---

## Table of Contents

1. [CRITICAL Findings](#1-critical-findings)
2. [HIGH Findings](#2-high-findings)
3. [MEDIUM Findings](#3-medium-findings)
4. [LOW Findings](#4-low-findings)
5. [Invalidated Claims](#5-invalidated-claims)
6. [Positive Security Controls](#6-positive-security-controls)
7. [Remediation Priority Matrix](#7-remediation-priority-matrix)
8. [Remediation PR Plan](#8-remediation-pr-plan)

---

## 1. CRITICAL Findings

### CR-1. Webhook Idempotency Marks Before Processing — Failed Events Permanently Lost

**File:** `backend/src/services/billing-service.ts:80-87`
**Category:** Payment / Data Integrity
**CLAUDE.md Rules:** Rule 1 (transactions)

`tryMarkWebhookProcessed(event.id, event.type)` runs *before* the event handler. If the handler throws (e.g., DB error in `updateUserSubscription`), the event is permanently marked as processed. Stripe retries are silently skipped. **A user can pay and never receive access.**

Additionally, individual event handlers (`handleCheckoutComplete`, `handleSubscriptionUpdate`, etc.) at lines 89-119 are called without per-handler try/catch. A handler failure returns 500 to Stripe *and* the idempotency record already exists — blocking both retry and reprocessing.

**Verified:** Lines 80-87 confirm mark-before-process pattern. Lines 89-119 confirm no per-handler error boundaries.

**Recommendation:** Wrap event processing in try/catch. On failure, delete the idempotency record so Stripe retries succeed. Add Sentry capture for the rollback failure case.

---

### CR-2. Refresh Token Rotation Race Condition — Token Replay

**File:** `backend/src/services/auth-service.ts:279-312`
**Category:** Authentication / Token Security
**CLAUDE.md Rules:** Rule 1 (transactions)

`refreshTokens()` performs validate → revoke → issue in separate non-transactional steps. Two concurrent requests with the same refresh token can both pass validation before either reaches revocation, producing two valid sessions from one token.

**Verified:** Lines 279-312 confirm sequential pool queries with no transaction. The `revokeRefreshToken` call at line 299 is a separate `DELETE` query.

**Recommendation:** Use an atomic `DELETE ... RETURNING` pattern that validates and revokes in a single SQL statement. The first request succeeds; the second finds no matching row and fails.

---

### CR-3. Missing `trust proxy` — All IP-Based Security Broken in Production

**File:** `backend/src/index.ts`
**Category:** Infrastructure / Security

Express does not call `app.set('trust proxy', ...)`. Behind any reverse proxy or load balancer (standard for production on Cloud Run, GCP, etc.):
- `req.ip` returns the proxy IP, not the client's
- **All rate limit counters are shared across ALL users** (effectively no rate limiting)
- **All audit log entries record the wrong IP** (HIPAA audit trail integrity compromised)

**Verified:** Full read of `backend/src/index.ts` confirms no `trust proxy` configuration anywhere.

**Recommendation:** Add `app.set('trust proxy', 1)` before any middleware that reads `req.ip`.

---

### CR-4. No Security Headers in Web App

**File:** `web/next.config.ts`
**Category:** Missing Security Controls

The Next.js configuration contains only `reactStrictMode: true` — no security headers whatsoever. Missing:
- **Content-Security-Policy (CSP):** Primary XSS defense
- **Strict-Transport-Security (HSTS):** HTTPS enforcement (HIPAA TLS requirement)
- **X-Frame-Options / frame-ancestors:** Clickjacking protection
- **X-Content-Type-Options:** MIME sniffing prevention
- **Referrer-Policy:** Prevents token leakage via Referer header (compounds tokens-in-URLs issue in CR-5)
- **Permissions-Policy:** Feature restriction

No `proxy.ts` file exists for request-level enforcement.

**Verified:** `web/next.config.ts` lines 1-14 confirm minimal config with no `headers()` export.

**Recommendation:** Add comprehensive `headers()` configuration to `next.config.ts` or create a `proxy.ts` file.

---

### CR-5. Password Reset Not Atomic — Crash Creates Inconsistent Security State

**File:** `backend/src/routes/auth.ts:428-440`
**Category:** Authentication / Data Integrity
**CLAUDE.md Rules:** Rule 1 (transactions)

Five sequential operations without a transaction:
```
1. updatePassword(userId, passwordHash)        // line 429
2. incrementTokenVersion(userId)               // line 434
3. deleteSessionsByUserId(userId)              // line 437
4. resetLockout(userId)                        // line 440
5. auditService.log(...)                       // line 442
```

Crash scenarios:
- **After step 1:** Password changed but old JWTs valid for up to 1 hour
- **After step 2:** Access tokens invalidated but refresh tokens still work
- **After step 3:** Sessions cleared but lockout not reset — user locked out with new password

**Verified:** Lines 428-458 confirm sequential `await` calls on individual pool queries with no transaction wrapper.

**Recommendation:** Wrap steps 1-4 in a database transaction using a dedicated `PoolClient`.

---

## 2. HIGH Findings

### H-1. Stripe Price ID Validation Bypassed When Env Vars Missing

**File:** `backend/src/routes/billing.ts:14-30`
**Category:** Business Logic / Payment Security

When `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL` are not configured, `allowedPriceIds` is empty. The Zod refine at line 24 returns `true` when the array is empty, accepting **any** Stripe price ID — including test prices ($0.01).

**Verified:** Lines 14-17 build `allowedPriceIds` via filter; lines 21-30 confirm the `length === 0` bypass.

**Recommendation:** Reject all checkout requests when no valid prices are configured, or make Stripe price env vars required in production.

---

### H-2. No Server-Side Duplicate Subscription Check

**File:** `backend/src/services/billing-service.ts:19-42`
**Category:** Payment / Double-Billing

`createCheckoutSession` creates a Stripe checkout without checking if the user already has an active subscription or Stripe customer. The only guard is client-side. A user with `active` subscription can create additional checkout sessions via direct API call.

Additionally, checkout uses `customer_email` (line 24) instead of reusing an existing Stripe customer ID, creating orphaned Customer records on re-subscription.

**Verified:** Lines 19-42 confirm no subscription status check. Line 24 confirms `customer_email` usage.

**Recommendation:** Check `subscription_status` before creating checkout. Reuse existing `stripeCustomerId` when available.

---

### H-3. Webhook Out-of-Order: `invoice.paid` Can Re-Activate Canceled Subscription

**File:** `backend/src/services/billing-service.ts:181-216`
**Category:** Billing Logic

`handleInvoicePaid` at line 201 unconditionally sets status to `active`. A delayed `invoice.paid` arriving after `customer.subscription.deleted` silently re-activates a canceled subscription.

**Verified:** Line 201 confirms unconditional `updateSubscriptionStatus(userId, 'active')`.

**Recommendation:** Check current subscription state before re-activating. Only set `active` if current status is `past_due` or `trialing`.

---

### H-4. Email Address Logged as PII in Audit Metadata

**File:** `backend/src/routes/auth.ts:183`
**Category:** HIPAA / PII Compliance

Failed login audit log includes `metadata: { email }` — the raw email address. This is the only audit call that logs PII; all others correctly log only `userId` or `null`.

**Verified:** Line 183 confirms `metadata: { email }`.

**Recommendation:** Remove email from metadata. Log only `emailProvided: true` or a one-way hash.

---

### H-5. API Responses Not Validated with Zod (Extension and Web)

**Files:** `extension/src/shared/api.ts:109,152,337`, `web/src/lib/api.ts:169`
**Category:** Input Validation / Type Safety
**CLAUDE.md Rules:** Rule 3 (validate external data)

Both clients cast API responses with `as ApiResponse<T>` without Zod validation, despite having Zod schemas available. Malformed backend responses would be silently accepted. In a healthcare context, corrupted SOAP note responses could result in clinicians pasting incorrect clinical documentation.

**Verified:** Extension lines 109, 152, 337 and web line 169 all confirm `as` casting without `.parse()`.

**Recommendation:** Validate critical API responses (AuthResponse, GeneratedNote) with Zod schemas.

---

### H-6. Storage Data Read Without Schema Validation

**Files:** `extension/src/shared/storage.ts:28`, `web/src/lib/storage.ts:27-32`
**Category:** Input Validation
**CLAUDE.md Rules:** Rule 3 (validate external data)

Extension casts chrome.storage data as `StoredAuth` without validation. Web app does basic truthy checks on three fields but no type/shape validation. Corrupted or tampered storage data propagates through the application.

**Verified:** Extension line 28 confirms `as StoredAuth` cast. Web lines 27-32 confirm minimal checks.

**Recommendation:** Parse storage data through Zod schemas on read. Clear auth state if validation fails.

---

### H-7. Token Creation Non-Atomic (Invalidate + Insert)

**File:** `backend/src/services/token-service.ts:67-88`
**Category:** Race Condition
**CLAUDE.md Rules:** Rule 1 (transactions)

`createToken()` invalidates existing tokens (UPDATE at lines 73-78) then inserts a new one (INSERT at lines 81-85) in separate pool queries without a transaction. Concurrent "resend verification" requests can both succeed, creating multiple valid tokens.

**Verified:** Lines 67-88 confirm two separate `db.query()` calls.

**Recommendation:** Wrap invalidation + insertion in a database transaction.

---

### H-8. PHI Not Cleared from Client State on Logout (Extension)

**File:** `extension/src/sidepanel/App.tsx`
**Category:** PHI Retention
**CLAUDE.md Rules:** Rule 4 (clear PHI on logout)

`generatedNote` (SOAP content), `patientContext`, and `quickNotes` (raw clinical input) are not explicitly cleared on logout. The component relies on implicit React key-based remounting rather than explicit state clearing. In shared-workstation clinical environments, PHI could persist in the JS heap.

**Verified:** No explicit PHI state clearing found in the logout flow. Component uses `key={user.id}` for implicit remount.

**Recommendation:** Explicitly set all PHI state variables to null/empty in the logout handler before unmounting.

---

### H-9. Token Refresh Race Condition in Extension — Silent Logout

**File:** `extension/src/shared/api.ts:79-133`
**Category:** Authentication / UX
**CLAUDE.md Rules:** Rule 1 (transactions)

No deduplication mechanism for concurrent refresh calls. Multiple API calls detecting an expired token simultaneously each call `refreshToken()` independently. The first succeeds and rotates; the second fails with the now-invalid old token and calls `storage.clearAuth()`, wiping the valid new tokens. **Result: Silent logout.**

**Verified:** Lines 79-133 confirm no mutex, lock, or deduplication mechanism.

**Recommendation:** Add a token refresh mutex (promise-based lock) so only one refresh executes at a time.

---

### H-10. Error Handler Returns Raw `err.message` in Non-Production

**File:** `backend/src/middleware/error-handler.ts:73-75`
**Category:** Information Disclosure
**CLAUDE.md Rules:** Rule 7 (generic errors in all environments)

Lines 73-75 return raw `err.message` when `NODE_ENV !== 'production'`. Staging environments may contain realistic PHI test data.

**Verified:** Lines 73-75 confirm conditional message exposure.

**Recommendation:** Always return generic error messages regardless of environment.

---

### H-11. `subscription_status` Missing CHECK Constraint on Users Table

**File:** `backend/src/db/migrations/001_initial_schema.sql:16`
**Category:** Schema Integrity

The `organizations` table has a CHECK constraint on `subscription_status`, but the `users` table does not. The `updateSubscriptionStatus` function accepts `status: string`, allowing arbitrary values.

**Verified:** Line 16 confirms no CHECK constraint. The organizations migration confirms the contrasting pattern.

**Recommendation:** Add `CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete'))`.

---

### H-12. Non-Null Assertions on Query Results Without Defensive Checks

**Files:** `backend/src/db/queries/users.ts:69,88,171`
**Category:** Type Safety / Robustness
**CLAUDE.md Rules:** Rule 10 (defensive query results)

Multiple `result.rows[0]!` usages without empty-result checks:
- Line 69: `createUser` — INSERT RETURNING, no row count check
- Line 88: `createUserWithClient` — same pattern
- Line 171: `incrementTokenVersion` — UPDATE RETURNING, **no guard at all**

Lines 45 and 55 are safe (have `if (result.rows.length === 0)` checks).

**Verified:** Confirmed at all cited lines.

**Recommendation:** Add explicit empty-result checks before non-null assertions.

---

### H-13. Invite Code `markCodeAsUsed` Does Not Set `is_active = FALSE`

**File:** `backend/src/db/queries/invite-codes.ts:123-132`
**Category:** Data Integrity

When a code is redeemed, `used_by` and `used_at` are set, but `is_active` remains `TRUE`. Code appears in the `idx_invite_codes_org_pending` partial index.

**Verified:** Lines 123-132 confirm UPDATE only sets `used_by` and `used_at`.

**Recommendation:** Also set `is_active = FALSE` in the UPDATE.

---

### H-14. No Graceful Shutdown for HTTP Server

**File:** `backend/src/index.ts:74-77`
**Category:** Reliability

`app.listen()` return value is never captured — no `server.close()` on shutdown. The SIGTERM handler in `db/index.ts:30-35` kills the pool underneath in-flight requests. No SIGINT handler. Sentry never flushed. In-flight SOAP note generations are terminated mid-request.

**Verified:** Line 74 confirms `app.listen(PORT)` without capturing the server reference. No process-level error handlers (`unhandledRejection`, `uncaughtException`) exist.

**Recommendation:** Capture server reference. Add SIGTERM/SIGINT handlers that stop accepting connections, drain in-flight requests, flush Sentry, then close the DB pool.

---

### H-15. No Process-Level Error Handlers

**File:** `backend/src/index.ts`
**Category:** Reliability / Observability

No `process.on('unhandledRejection')` or `process.on('uncaughtException')` handlers. Errors outside Express middleware (DB pool initialization, event handlers) crash silently without Sentry visibility.

**Verified:** Full file read confirms no process-level handlers.

**Recommendation:** Add explicit handlers that capture to Sentry, flush, then exit.

---

### H-16. XML Delimiter Tags Not Escaped in User Content — Prompt Injection

**File:** `backend/src/utils/prompt-sanitization.ts:86-91`
**Category:** Prompt Injection

`wrapWithDelimiters` wraps user content in XML-style tags but does not escape occurrences of those same tags within user content. A user providing `</clinician_notes>` in quickNotes could break out of semantic boundaries. The `detectSuspiciousPatterns` monitoring (lines 45-72) has **zero patterns** for XML delimiter manipulation.

**Verified:** Lines 86-91 confirm no escaping. Lines 45-72 confirm no XML-related patterns.

**Recommendation:** Strip or escape user-provided strings matching delimiter tags before wrapping. Add XML delimiter patterns to suspicious pattern detection.

---

### H-17. Backend Error Messages Displayed Directly to Users (Extension)

**File:** `extension/src/sidepanel/components/LoginForm.tsx:50`
**Category:** Information Disclosure
**CLAUDE.md Rules:** Rule 2 (never display backend errors)

Line 50: `setErrors([err.message])` displays `err.message` from API errors directly in the UI.

**Verified:** Line 50 confirms direct `err.message` display.

**Note:** Web app pages (`login/page.tsx:73`, `signup/page.tsx:86`) also display `err.message`, but this is partially mitigated because `ApiError` is instantiated with curated messages from the centralized API client. The extension's `LoginForm` has the same pattern but with less mitigation.

**Recommendation:** Map error codes to client-side curated messages in all cases.

---

### H-18. HIPAA Data Retention Risk — CASCADE DELETE on Sessions and Usage

**File:** `backend/src/db/migrations/001_initial_schema.sql:27,48`
**Category:** Data Integrity / HIPAA

The `sessions` table (line 27) and `usage` table (line 48) use `ON DELETE CASCADE` on `user_id`. A single `DELETE FROM users` would permanently destroy all session history and usage data required for HIPAA compliance.

**Verified:** Lines 27 and 48 confirm `ON DELETE CASCADE`.

**Recommendation:** Change to `ON DELETE RESTRICT`. Implement soft-delete for users.

---

## 3. MEDIUM Findings

### M-1. Rate Limiting is IP-Only — Ineffective Behind NAT/Proxies

**File:** `backend/src/middleware/rate-limit.ts`
**Category:** Rate Limit Bypass

All rate limiters key solely on `req.ip`. In clinical environments (target users), many PTs share a single office IP behind NAT. This is compounded by CR-3 (missing `trust proxy`).

**Verified:** All 11 rate limiters use default express-rate-limit keying (IP only).

**Recommendation:** Add compound keying: IP + email hash for login endpoints; user ID for authenticated endpoints.

---

### M-2. Bcrypt Rounds Inconsistency — Refresh Token Uses 10 Instead of 12

**File:** `backend/src/services/auth-service.ts:393`
**Category:** Security Configuration

`storeRefreshToken` uses `bcrypt.hash(refreshToken, 10)` while `BCRYPT_ROUNDS = 12` is defined in config.ts:122 and used for passwords.

**Verified:** Line 393 confirms hardcoded `10`.

**Recommendation:** Use `BCRYPT_ROUNDS` consistently.

---

### M-3. `err.message` Logged to Console in All Environments (Including Production)

**File:** `backend/src/middleware/error-handler.ts:24-28`
**Category:** PHI Leak Risk

The error handler logs `err.message` unconditionally. If errors originate from parsing user input containing PHI, the message could contain PHI in production logs.

**Verified:** Lines 24-28 confirm unconditional `console.error` of `err.message`.

**Recommendation:** Sanitize or omit raw error messages in production logs. Full errors are already captured to Sentry with PHI sanitization.

---

### M-4. Email Verification Middleware Bypasses Error Handler

**File:** `backend/src/middleware/email-verification.ts:76-83`
**Category:** Error Handling / Observability

The catch block returns a 500 directly instead of calling `next(error)`, bypassing Sentry capture and the global error handler. No `Sentry.captureException()`.

**Verified:** Lines 76-83 confirm direct `res.status(500).json()` with only `console.error`.

**Recommendation:** Replace with `next(error)` or add Sentry capture.

---

### M-5. Usage Tracking Failure Silently Swallowed

**File:** `backend/src/services/usage-service.ts:20-24`
**Category:** Billing / Observability

`incrementUsage` catches all errors and only logs to console. No Sentry capture. Persistent failures mean users generate unlimited notes without usage being recorded.

**Verified:** Lines 20-24 confirm `console.error` only, no Sentry.

**Recommendation:** Add `Sentry.captureException()`.

---

### M-6. Audit Log Failures Silently Swallowed in `safeAuditLog`

**File:** `backend/src/utils/request-utils.ts:33-40`
**Category:** HIPAA / Audit Integrity

`safeAuditLog` catches errors and only prints to console. No Sentry capture. While the audit service itself captures to Sentry, persistent failures in the wrapper go unnoticed.

**Verified:** Lines 33-40 confirm `console.error` without Sentry.

**Recommendation:** Add `Sentry.captureException()` to the wrapper's catch block.

---

### M-7. Unauthenticated Pages Use Raw `fetch()` — Missing CSRF Protection

**Files:** `web/src/app/forgot-password/page.tsx:37`, `web/src/app/resend-verification/page.tsx:37`, `web/src/app/reset-password/page.tsx:36,79`, `web/src/app/verify-email/page.tsx:29`
**Category:** CSRF / Architecture
**CLAUDE.md Rules:** Rule 5 (use centralized API client)

Four pages make direct `fetch()` calls instead of using the centralized API client, bypassing CSRF token attachment, token refresh, retry logic, and consistent error handling.

**Verified:** All cited lines confirm raw `fetch()` usage with direct API_URL construction.

**Recommendation:** Refactor to use existing API client methods.

---

### M-8. Open Redirect via Backend-Provided URLs

**Files:** `web/src/app/dashboard/page.tsx:132,142`, `web/src/app/pricing/page.tsx:76`
**Category:** Open Redirect

`checkoutUrl` and `portalUrl` from the backend are used in `window.location.href` without domain validation.

**Verified:** Confirmed at all cited lines — no URL validation before redirect.

**Recommendation:** Validate redirect URLs against an allowlist (e.g., `checkout.stripe.com`, `billing.stripe.com`).

---

### M-9. Reset/Verification Tokens in URL Query Parameters

**Files:** `web/src/app/reset-password/page.tsx:25`, `web/src/app/verify-email/page.tsx:20`
**Category:** Token Exposure

Sensitive tokens passed as URL query parameters appear in browser history, server access logs, and potentially in Referer headers (compounded by CR-4's missing Referrer-Policy).

**Verified:** Both pages use `searchParams.get('token')`.

**Recommendation:** Mitigated by adding `Referrer-Policy: no-referrer` (CR-4). Consider POST-based token validation.

---

### M-10. `isAuthenticated` Derived from Client State Without Token Validation

**File:** `web/src/lib/auth-context.tsx:168`
**Category:** Auth Integrity
**CLAUDE.md Rules:** Rule 8 (server-side auth mandatory)

`isAuthenticated` comes from `Boolean(user)` in React state, initialized from sessionStorage. No token expiry validation on initialization.

**Verified:** Line 168 confirms `isAuthenticated: Boolean(user)`.

**Recommendation:** Validate token expiry on initialization. Add server-side middleware for protected routes.

---

### M-11. Client-Only Authentication Guard — No Server-Side Protection

**File:** `web/src/components/auth/ProtectedRoute.tsx:16-20`
**Category:** Auth Architecture
**CLAUDE.md Rules:** Rule 8 (server-side auth mandatory)

`ProtectedRoute` is client-side only using `useAuth()`. No Next.js proxy validates sessions before serving protected routes.

**Verified:** Lines 16-20 confirm client-side redirect only.

**Recommendation:** Add a `proxy.ts` file for server-side session validation.

---

### M-12. PHI Persists in System Clipboard Indefinitely

**File:** `extension/src/sidepanel/components/ResultDisplay.tsx:34`
**Category:** PHI Retention

`navigator.clipboard.writeText(text)` writes SOAP content with no expiration. In shared-workstation environments, clipboard managers may persist history. No clearing on logout.

**Verified:** Line 34 confirms write without timeout. UI feedback clears after 2s but clipboard content persists.

**Recommendation:** Clear clipboard on logout. Consider auto-clear timer (e.g., 60 seconds).

---

### M-13. No React Error Boundary in Extension

**File:** `extension/src/sidepanel/App.tsx`
**Category:** Error Recovery

No error boundary wraps the component tree. Any rendering error crashes the entire sidepanel to a white screen with no recovery.

**Verified:** No ErrorBoundary component found wrapping the App tree.

**Recommendation:** Add an error boundary with Sentry capture and a recovery UI.

---

### M-14. Content Script Monkey-Patches Browser History API

**File:** `extension/src/content/floating-button.ts:182-192`
**Category:** Extension / EMR Compatibility

Overrides `history.pushState` and `history.replaceState` to detect navigation. Never cleaned up. Could interfere with EMR SPA routing.

**Verified:** Lines 182-192 confirm global prototype modification without cleanup.

**Recommendation:** Use `MutationObserver` or periodic polling instead.

---

### M-15. Service Worker State Loss on Restart

**File:** `extension/src/background/service-worker.ts:29`
**Category:** Extension Reliability

`sidepanelOpenByWindow` Map is in-memory. Chrome MV3 service workers can be killed after 30 seconds of inactivity. State loss desyncs floating button visibility.

**Verified:** Line 29 confirms in-memory `Map` with no persistence.

**Recommendation:** Use `chrome.storage.session` for service worker state that must survive restarts.

---

### M-16. Missing Origin Validation on Runtime Messages

**File:** `extension/src/background/service-worker.ts:109-125`
**Category:** Extension Security

`SIDEPANEL_OPENED`/`SIDEPANEL_CLOSED` messages accept `windowId` from the message payload instead of from `sender.tab?.windowId`.

**Verified:** Lines 109-125 confirm no sender origin validation.

**Recommendation:** Use `sender.tab?.windowId` instead of trusting the message payload.

---

### M-17. `web_accessible_resources` Enables Extension Fingerprinting

**File:** `extension/public/manifest.json:81`
**Category:** Extension Security

Logo accessible to `<all_urls>`, allowing any website to probe for the extension. This reveals the user is a physical therapist.

**Verified:** Line 81 confirms `"matches": ["<all_urls>"]`.

**Recommendation:** Restrict `matches` to EMR domains in `content_scripts.matches`.

---

### M-18. No AbortController for In-Flight Requests on Logout

**File:** `extension/src/sidepanel/components/NoteGenerator.tsx:106`
**Category:** Resource Leak / PHI

If the user logs out during note generation, the API call continues. The response with PHI is received but has nowhere to go — sitting in heap until GC.

**Verified:** Line 106 confirms `api.generateNote()` call without abort control.

**Recommendation:** Use AbortController; abort in-flight requests on logout/unmount.

---

### M-19. Migration Script Uses Pool-Level Transactions

**File:** `backend/src/db/migrate.ts:77-86`
**Category:** Migration Safety
**CLAUDE.md Rules:** Rule 1 (transactions)

`BEGIN`/`COMMIT`/`ROLLBACK` called on the Pool, not a dedicated client. Only safe because pool `max: 1` forces a single connection. If pool size changes, transactions silently break.

**Verified:** Lines 77-86 confirm `db.query('BEGIN')` on pool object.

**Recommendation:** Use a dedicated `PoolClient` for migration transactions.

---

### M-20. Migration Script Lacks Advisory Locks

**File:** `backend/src/db/migrate.ts`
**Category:** Migration Safety

No `pg_advisory_lock` before running migrations. Concurrent deployments could apply migrations simultaneously.

**Verified:** No advisory lock found in the file.

**Recommendation:** Acquire advisory lock before checking/applying migrations.

---

### M-21. Migration 009 Not Idempotent

**File:** `backend/src/db/migrations/009_usage_token_split.sql:5-6`
**Category:** Migration Safety

`ALTER TABLE ... ADD COLUMN` without `IF NOT EXISTS`. Also drops `tokens_used` column in the same migration.

**Verified:** Lines 5-6 confirm bare `ADD COLUMN`.

**Recommendation:** Add `IF NOT EXISTS` guards.

---

### M-22. `findMemberByOrgAndUser` Returns Stale Membership

**File:** `backend/src/db/queries/organization-members.ts:77-90`
**Category:** Query Correctness

Query doesn't filter on `removed_at IS NULL`, returning both active and removed memberships. Row order is nondeterministic.

**Verified:** Lines 77-90 confirm no `removed_at` filter (comment says "for re-join checks" but this is returned as active membership).

**Recommendation:** Add `WHERE removed_at IS NULL` or `ORDER BY removed_at NULLS FIRST`.

---

### M-23. Stripe Webhook Proxy Logs Unsanitized Error Bodies to Sentry

**File:** `web/src/app/api/webhooks/stripe/route.ts:43-50`
**Category:** PHI Leak / Logging

Backend error response body is forwarded unsanitized to both Sentry extras (line 47: `errorBody`) and `console.error` (line 50).

**Verified:** Lines 36-50 confirm unsanitized `errorBody` in both Sentry and console.

**Recommendation:** Sanitize `errorBody` before Sentry capture, or remove it from extras.

---

### M-24. PHI Sanitization Relies on Field-Name Heuristics Only

**File:** `backend/src/utils/sentry-sanitization.ts:13-33`
**Category:** PHI Sanitization

`sanitizeObject` only checks key names against patterns. PHI in fields named `data`, `text`, `description`, `value` passes through unredacted.

**Verified:** Lines 13-33 confirm key-name-only approach.

**Recommendation:** Consider a stricter allowlist approach for Sentry extras.

---

### M-25. `removeMember` Doesn't Verify Row Was Updated

**File:** `backend/src/db/queries/organization-members.ts:113-124`
**Category:** Defensive Programming

Function returns `void` without checking `result.rowCount`. Silent no-op on already-removed members.

**Verified:** Lines 113-124 confirm no rowCount check.

**Recommendation:** Return `rowCount` or boolean indicating success.

---

### M-26. Session Placeholder Hash Briefly in Database

**File:** `backend/src/services/auth-service.ts:375-400`
**Category:** Security

`storeRefreshToken` inserts a session with `'placeholder'` hash, then updates with the real hash. Process crash between INSERT and UPDATE leaves a session with a known hash string.

**Verified:** Lines 375-400 confirm the insert-then-update pattern with `'placeholder'`.

**Recommendation:** Use a transaction or generate the token/hash before INSERT.

---

### M-27. `cleanupExpiredTokens()` Never Called

**File:** `backend/src/services/token-service.ts:167-175`
**Category:** Unbounded Growth

Method exists but is never invoked in production code. The `email_tokens` table grows indefinitely with expired tokens. Similarly, no expired session cleanup exists for the `sessions` table.

**Verified:** Grep confirms only test file references. No scheduler, cron, or startup invocation.

**Recommendation:** Add periodic cleanup job for both `email_tokens` and `sessions`.

---

### M-28. E2E Workflow Exposes Secrets at Global `env` Level

**File:** `.github/workflows/e2e.yml:24-34`
**Category:** CI/CD Security

Environment variables with secrets declared at workflow top level, available to every step including third-party actions like `actions/upload-artifact@v4`.

**Verified:** Lines 24-34 confirm global `env` block.

**Recommendation:** Scope environment variables only to the steps that need them.

---

## 4. LOW Findings

| # | Finding | File | Verified |
|---|---------|------|----------|
| L-1 | Missing rate limit on `validate-reset-token` endpoint | `routes/auth.ts:388` | Yes — no rate limiter middleware |
| L-2 | Auth middleware discards JWT verification error details | `middleware/auth.ts:96` | Yes — generic catch; acceptable for security |
| L-3 | Zod validation details reveal schema information | `middleware/error-handler.ts:37` | Yes — field names exposed |
| L-4 | NaN passes CSRF timestamp check (mitigated by HMAC) | `middleware/csrf.ts:46-47` | Yes — both `NaN > X` and `NaN < 0` are false |
| L-5 | Unsafe type cast of database role value | `middleware/organization.ts:44` | Yes — `as OrgRole` without Zod |
| L-6 | GEMINI_API_KEY and ANTHROPIC_API_KEY optional in schema | `config.ts:24,31` | Yes — but runtime validation enforces selected provider |
| L-7 | DATABASE_URL validated as generic URL, not PostgreSQL | `config.ts:12` | Yes — `z.string().url()` accepts any scheme |
| L-8 | Database URL partially logged in non-production | `env-loader.ts:52-61` | Yes — credentials redacted; host/db visible |
| L-9 | Development CORS allows any Chrome extension | `index.ts:46` | Yes — dev-only pattern |
| L-10 | No explicit request body size limit | `index.ts:55` | Yes — Express default 100KB applies |
| L-11 | Audit action reuse (`SUBSCRIPTION_CANCELLED` for cancellations and payment failures) | `billing-service.ts:175,240` | Yes — ambiguous audit trail |
| L-12 | Legacy refresh token path has O(n) bcrypt comparisons | `auth-service.ts:532-549` | Yes — self-resolving after legacy token expiry |
| L-13 | `email_tokens.token_hash` lacks UNIQUE constraint | `003_email_verification.sql:13` | Yes — structural gap |
| L-14 | Redundant `idx_users_email` index (UNIQUE already creates one) | `001_initial_schema.sql:59` | Yes — wastes storage |
| L-15 | `invite_codes.created_by` nullable — TypeScript type mismatch | `010_invite_codes.sql:19` | Yes — DB allows NULL, TS expects non-null |
| L-16 | Extension `localhost` in production content script matches | `manifest.json:52` | Yes — floating button on any localhost page |
| L-17 | Extension hardcoded version string (`v0.1.0`) | `Settings.tsx:184` | Yes — will drift from manifest |
| L-18 | `NOT NULL` constraints missing on `created_at`/`updated_at` columns | `001_initial_schema.sql:20-21` | Yes — explicit NULL INSERT would succeed |

---

## 5. Invalidated Claims

The following claims from the original audits were found to be **incorrect or significantly overstated** upon verification:

### INV-1. `global-error.tsx` Missing `lang` Attribute — INCORRECT

**Original claim:** L-22 in Code Quality Audit — "Global Error Page Missing `lang` Attribute"
**Finding:** Line 29 of `web/src/app/global-error.tsx` contains `<html lang="en">`. The claim is false.

### INV-2. Refresh Token Rotation Entirely Non-Transactional — OVERSTATED

**Original claim:** SP-1/C-2 rated CRITICAL/HIGH — "refreshTokens validate→revoke→issue defeats token rotation"
**Finding:** While the race condition exists (addressed in CR-2), the original characterization that the pattern is "entirely broken" overstates the issue. Validation checks hash + expiry, revoke is idempotent DELETE by sessionId, and new session is independent. The race window requires precise concurrent timing. Severity adjusted from "defeats token rotation" to "token replay race condition."

### INV-3. Email Service Logs PII Without Production Guard — OVERSTATED

**Original claim:** H-2 in Production Readiness Audit — "logs PII without production guard"
**Finding:** The logging is guarded by `if (!this.resend)` which only fires when the Resend API is not configured. The file header explicitly marks this as intentional dev-mode logging. If `RESEND_API_KEY` were accidentally unset in production, PII would leak — but this is a configuration error, not a code defect. Downgraded from HIGH to note: ensure RESEND_API_KEY is required in production config.

### INV-4. Stripe Webhook Signature Verification Entirely Mocked Away — INCORRECT

**Original claim:** SP-48 rated HIGH — "stripe.webhooks.constructEvent is mocked to return whatever the test wants... actual verification logic is never executed"
**Finding:** The billing service tests DO include signature rejection verification at lines 228-235 and 795-804, where `constructEvent` is configured to throw and the test verifies the error propagates correctly. While the mock doesn't execute the real Stripe SDK crypto, the test does verify the error handling path.

---

## 6. Positive Security Controls

The following security measures are correctly implemented and should be maintained:

1. **Parameterized SQL everywhere** — Zero SQL injection vectors across entire codebase
2. **Timing-safe authentication** — Dummy bcrypt hash for non-existent users prevents timing oracle
3. **Algorithm pinning** — JWT verification explicitly pinned to `HS256` (auth.ts:42)
4. **Token versioning** — Immediate JWT invalidation on password reset via `token_version`
5. **Progressive account lockout** — Atomic SQL-based lockout with configurable thresholds
6. **CSRF on state-changing endpoints** — HMAC-signed, time-limited, user-bound tokens with `crypto.timingSafeEqual()`
7. **PHI-free logging** — Note content never logged or persisted; only metadata tracked
8. **Sentry PHI sanitization** — `beforeSend` hooks strip request bodies and sensitive fields
9. **Webhook idempotency** — Database-backed deduplication (mechanism correct, placement needs fix per CR-1)
10. **Race condition prevention** — `SELECT FOR UPDATE` on seat allocation and invite redemption
11. **Mock AI production guard** — Hard crash if `USE_MOCK_AI` enabled in production (ai-service.ts:17-22)
12. **No XSS vectors** — Zero `dangerouslySetInnerHTML` usage; React handles escaping
13. **Session replay disabled** — HIPAA-aware Sentry configuration
14. **Strict CSP in extension** — `script-src 'self'` only
15. **Comprehensive audit logging** — Auth events, billing events, authorization failures all logged
16. **User data sanitization** — `sanitizeUser()` strips passwordHash, tokenVersion, and all sensitive fields
17. **Zero IDOR surface** — No endpoint accepts entity IDs from user input; all access JWT-derived
18. **React Strict Mode enabled** — Catches common bugs like effects with missing cleanup
19. **100% Zod schema coverage on user-facing inputs** — All API request bodies validated

---

## 7. Remediation Priority Matrix

### Tier 1: Immediate (Before Launch) — 13 items

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| CR-3 | Configure `trust proxy` in Express | Low | All IP-based security broken without it |
| CR-4 | Add security headers to web app | Low | XSS, clickjacking, HTTPS enforcement |
| CR-5 | Wrap password reset in transaction | Low | Non-atomic state change on security-critical path |
| CR-1 | Fix webhook idempotency (mark after, not before processing) | Medium | Users can pay and never get access |
| CR-2 | Atomic refresh token rotation | Medium | Token replay attack |
| H-1 | Require Stripe price IDs in production | Low | Price manipulation |
| H-2 | Add server-side duplicate subscription check | Low | Double-billing |
| H-3 | Check subscription state before webhook re-activation | Low | Webhook reorder attack |
| H-4 | Remove email from audit log metadata | Low | PII compliance |
| H-8 | Clear PHI state on logout (extension) | Low | PHI retention on shared workstations |
| H-14 | Add graceful shutdown | Low | In-flight request reliability |
| H-15 | Add process-level error handlers | Low | Silent crashes |
| H-16 | Escape XML delimiter tags in prompt sanitization | Low | Prompt injection |

### Tier 2: Short-Term (Next Sprint) — 16 items

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| H-5 | Validate API responses with Zod (extension + web) | Medium | Malformed data accepted |
| H-6 | Validate storage data with Zod | Medium | Corrupted auth state |
| H-7 | Wrap token creation in transaction | Low | Duplicate tokens |
| H-9 | Add token refresh mutex in extension | Medium | Silent logout |
| H-10 | Return generic errors in all environments | Low | Rule 7 violation |
| H-11 | Add CHECK constraint to `users.subscription_status` | Low | Invalid states |
| H-12 | Add defensive checks on query results | Medium | Runtime TypeErrors |
| H-13 | Fix `markCodeAsUsed` to set `is_active = FALSE` | Low | Data integrity |
| H-17 | Map error codes to client-side messages (extension) | Medium | Rule 2 violation |
| H-18 | Change CASCADE to RESTRICT on sessions/usage FKs | Medium | HIPAA data retention |
| M-1 | Add user-keyed rate limiting | Medium | Rate limit bypass |
| M-4 | Fix email-verification middleware error handling | Low | Observability |
| M-5 | Add Sentry to usage tracking failures | Low | Silent billing failures |
| M-7 | Refactor auth pages to use API client | Medium | CSRF gap |
| M-13 | Add React error boundary in extension | Low | White screen crash |
| M-23 | Sanitize webhook error bodies in Sentry | Low | PII leak |

### Tier 3: Medium-Term (Next Quarter) — 11 items

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| M-2 | Fix bcrypt rounds for refresh tokens | Low | Policy inconsistency |
| M-8 | Validate redirect URLs against allowlist | Low | Open redirect |
| M-10 | Add server-side auth middleware for web | Medium | Client-only protection |
| M-12 | Clear clipboard on logout; auto-clear timer | Low | PHI in clipboard |
| M-14 | Replace history API monkey-patching | Medium | EMR compatibility |
| M-19 | Use dedicated client for migration transactions | Low | Migration safety |
| M-20 | Add advisory locks to migrations | Low | Concurrent deployment |
| M-24 | Improve PHI sanitization heuristics | Medium | PHI leak to Sentry |
| M-26 | Fix session placeholder hash pattern | Low | Edge-case security |
| M-27 | Add expired data cleanup jobs | Low | Unbounded table growth |
| M-28 | Scope CI secrets to specific steps | Low | CI security |

### Test Coverage Priorities

These test gaps should be addressed alongside the code fixes above:

| Priority | Gap | Impact |
|----------|-----|--------|
| HIGH | Rate limit tests exercise zero blocking behavior (Rule 6) | False confidence in rate limiting |
| HIGH | No test for JWT `algorithm: 'none'` rejection | Algorithm confusion attack unguarded |
| HIGH | Production mock-AI guard untested | Patient safety if guard fails |
| MEDIUM | No middleware chain integration test | Untested security boundary |
| MEDIUM | `sanitizeUser` only tests `passwordHash` removal (not other 6 fields) | Sensitive field leak risk |
| MEDIUM | No test verifying access tokens contain `tokenVersion` | Session invalidation silently breakable |

---

## Overall Assessment

### Strengths
This codebase demonstrates **strong security fundamentals**. SQL injection is non-existent. Authentication uses timing-safe patterns with algorithm pinning. PHI logging is carefully avoided. CSRF protection is properly implemented. Audit logging is comprehensive. The Sentry configuration is HIPAA-aware. These indicate security-conscious development.

### Areas for Improvement
The primary gaps fall into three categories:

1. **Atomicity:** Many multi-step security operations (password reset, token rotation, session creation, webhook processing) execute as individual queries without database transactions. This creates windows where crashes or concurrent requests leave the system in inconsistent security states.

2. **Client-Side Trust:** Both clients trust data from storage without runtime validation, display backend error messages directly, and lack server-side middleware for route protection.

3. **Production Infrastructure:** Missing `trust proxy`, security headers, graceful shutdown, and process-level error handlers are table-stakes for production deployment.

### Risk Rating
**MEDIUM-HIGH for production deployment.** The Tier 1 items (13 findings, mostly low effort) should be addressed before handling real patient interactions. The codebase is far above average for security awareness, but the atomicity gaps and infrastructure omissions create realistic attack vectors — particularly around billing manipulation and token replay.

---

## 8. Remediation PR Plan

### Approach: Domain-Based Grouping

Findings are grouped by **domain** (the system area they touch) rather than by severity or as individual PRs. This means:

- **Each PR touches related files that a reviewer can reason about together.** A PR changing auth-service.ts, token-service.ts, and auth routes keeps the reviewer in "auth mode" — no context-switching to billing or extension code mid-review.
- **Severity determines PR order, not PR boundaries.** The first 3 PRs contain all 5 CRITICALs and most HIGHs. Later PRs handle MEDIUM/LOW items.
- **7 PRs total.** Small enough to avoid review fatigue and merge conflict hell, large enough that each PR is a coherent unit of work.

Individual findings within each PR range from 1-line config changes to small refactors. None require architectural rework. Most Tier 1 items are low effort — the consolidation into 7 PRs is about review coherence, not task size.

---

### PR 1: Backend Infrastructure & Process Safety
**Priority:** Immediate — unblocks all IP-based security
**Files:** `backend/src/index.ts`, `backend/src/middleware/error-handler.ts`

| # | Finding | Effort |
|---|---------|--------|
| CR-3 | Configure `trust proxy` | Low |
| H-10 | Return generic errors in all environments | Low |
| H-14 | Graceful shutdown (capture server ref, SIGTERM/SIGINT, drain, flush Sentry) | Low |
| H-15 | Process-level `unhandledRejection`/`uncaughtException` handlers | Low |
| M-3 | Sanitize `console.error` output in production | Low |

**Why grouped:** All changes live in `index.ts` and `error-handler.ts`. They're about how the Express process starts, runs, shuts down, and handles errors at the infrastructure level. No business logic involved — pure plumbing.

---

### PR 2: Auth & Token Atomicity
**Priority:** Immediate — fixes two CRITICALs
**Files:** `backend/src/services/auth-service.ts`, `backend/src/services/token-service.ts`, `backend/src/routes/auth.ts`

| # | Finding | Effort |
|---|---------|--------|
| CR-2 | Atomic refresh token rotation (`DELETE ... RETURNING`) | Medium |
| CR-5 | Wrap password reset in database transaction | Low |
| H-4 | Remove email PII from audit log metadata | Low |
| H-7 | Wrap token creation (invalidate + insert) in transaction | Low |
| M-2 | Use `BCRYPT_ROUNDS` constant for refresh token hashing | Low |
| M-26 | Fix session placeholder hash (generate before INSERT) | Low |

**Why grouped:** All about making authentication operations atomic and correct. Reviewer needs to hold the auth flow in their head — token rotation, password reset, session creation. These changes interact with each other (e.g., CR-5 and H-7 both add transaction patterns to the same service files).

---

### PR 3: Billing & Webhook Safety
**Priority:** Immediate — fixes payment-critical CRITICAL
**Files:** `backend/src/services/billing-service.ts`, `backend/src/routes/billing.ts`, `backend/src/services/usage-service.ts`, `backend/src/utils/request-utils.ts`

| # | Finding | Effort |
|---|---------|--------|
| CR-1 | Fix webhook idempotency (mark after processing, rollback on failure) | Medium |
| H-1 | Reject checkout when Stripe price IDs not configured | Low |
| H-2 | Server-side duplicate subscription check before checkout | Low |
| H-3 | Check subscription state before `invoice.paid` re-activation | Low |
| M-5 | Add Sentry to usage tracking failures | Low |
| M-6 | Add Sentry to `safeAuditLog` wrapper | Low |

**Why grouped:** All billing/payment code. CR-1 is the most important fix in the entire audit — a reviewer should evaluate the idempotency change with full focus on the billing domain. The other items are small additions to the same files.

---

### PR 4: Web App Hardening
**Priority:** Immediate (CR-4) + Short-term
**Files:** `web/next.config.ts`, `web/src/app/*/page.tsx`, `web/src/lib/auth-context.tsx`, `web/src/components/auth/ProtectedRoute.tsx`, `web/src/app/api/webhooks/stripe/route.ts`

| # | Finding | Effort |
|---|---------|--------|
| CR-4 | Add security headers (CSP, HSTS, X-Frame-Options, etc.) | Low |
| M-7 | Refactor auth pages to use centralized API client | Medium |
| M-8 | Validate redirect URLs against Stripe domain allowlist | Low |
| M-10 | Validate token expiry on auth initialization | Low |
| M-11 | Add Next.js `proxy.ts` for server-side route protection | Medium |
| M-23 | Sanitize webhook proxy error bodies before Sentry | Low |

**Why grouped:** All web package changes. Security headers, auth proxy, and API client refactoring are conceptually related — they're all about hardening the web app's security posture. Self-contained within the `web/` directory.

**Note:** M-9 (tokens in URL params) is mitigated by CR-4's `Referrer-Policy` header. No separate code change needed beyond the header addition.

---

### PR 5: Extension Security & PHI
**Priority:** Short-term
**Files:** All within `extension/src/`

| # | Finding | Effort |
|---|---------|--------|
| H-8 | Clear PHI state explicitly on logout | Low |
| H-9 | Add token refresh mutex (promise lock) | Medium |
| H-17 | Map error codes to curated client-side messages | Medium |
| M-12 | Clear clipboard on logout; consider auto-clear timer | Low |
| M-13 | Add React error boundary with Sentry capture | Low |
| M-14 | Replace history API monkey-patching with MutationObserver | Medium |
| M-15 | Persist service worker state to `chrome.storage.session` | Low |
| M-16 | Validate message sender origin in service worker | Low |
| M-17 | Restrict `web_accessible_resources` to EMR domains | Low |
| M-18 | Add AbortController for in-flight requests on logout/unmount | Low |

**Why grouped:** Extension is a self-contained package. Changes don't affect backend or web. Despite 10 items, most are small and isolated — different files within the extension, not interacting with each other. A reviewer familiar with Chrome extension patterns can work through these efficiently.

---

### PR 6: Input Validation & Data Trust
**Priority:** Short-term
**Files:** `extension/src/shared/api.ts`, `extension/src/shared/storage.ts`, `web/src/lib/api.ts`, `web/src/lib/storage.ts`, `backend/src/utils/prompt-sanitization.ts`, `backend/src/utils/sentry-sanitization.ts`, `backend/src/middleware/email-verification.ts`

| # | Finding | Effort |
|---|---------|--------|
| H-5 | Validate API responses with Zod (extension + web) | Medium |
| H-6 | Validate storage data with Zod schemas | Medium |
| H-16 | Escape XML delimiters in prompt sanitization | Low |
| M-4 | Fix email-verification middleware error handling (`next(error)`) | Low |
| M-24 | Improve PHI sanitization heuristics for Sentry | Medium |

**Why grouped:** Unified theme: "stop trusting external data." API responses, storage reads, user content in prompts, and error payloads to Sentry are all trust boundaries where data should be validated or sanitized. The reviewer evaluates one concept applied across several files.

---

### PR 7: Database Schema, Migrations & CI
**Priority:** Medium-term
**Files:** `backend/src/db/migrations/`, `backend/src/db/queries/`, `backend/src/db/migrate.ts`, `.github/workflows/`

| # | Finding | Effort |
|---|---------|--------|
| H-11 | Add CHECK constraint on `users.subscription_status` | Low |
| H-12 | Add defensive checks on non-null assertions in queries | Medium |
| H-13 | Set `is_active = FALSE` in `markCodeAsUsed` | Low |
| H-18 | Change CASCADE to RESTRICT on sessions/usage FKs | Medium |
| M-19 | Use dedicated PoolClient for migration transactions | Low |
| M-20 | Add advisory locks to migration runner | Low |
| M-21 | Add `IF NOT EXISTS` to migration 009 | Low |
| M-22 | Filter `removed_at IS NULL` in `findMemberByOrgAndUser` | Low |
| M-25 | Check `rowCount` in `removeMember` | Low |
| M-27 | Add periodic cleanup for expired sessions and tokens | Low |
| M-28 | Scope CI secrets to specific steps | Low |
| LOW | Remaining LOW-severity items (as applicable) | Low |

**Why grouped:** Database schema changes, query fixes, and migration tooling improvements are all data-layer concerns. They share a review context (SQL correctness, migration safety) and many result in new migration files that should land together to avoid migration ordering conflicts.

---

### Test Coverage (Parallel Track)

Test improvements should be added **within the PR that touches the related code**, not as a separate PR. Specifically:

| Test Gap | Include In |
|----------|-----------|
| Rate limit blocking behavior tests | PR 1 (if rate limit config changes) or PR 6 |
| JWT `algorithm: 'none'` rejection test | PR 2 |
| Mock-AI production guard test | PR 3 or PR 6 |
| Middleware chain integration test | PR 2 |
| `sanitizeUser` comprehensive field test | PR 6 |
| Access token `tokenVersion` inclusion test | PR 2 |

---

### Execution Order

```
PR 1 (Infra) ──→ PR 2 (Auth) ──→ PR 3 (Billing) ──→ PR 4 (Web)
                                                        ↓
                                          PR 5 (Extension) ──→ PR 6 (Validation) ──→ PR 7 (Database & CI)
```

- **PRs 1-3 are sequential** — PR 2 and 3 build on the trust proxy and error handling from PR 1.
- **PRs 4-5 can run in parallel** — web and extension are independent packages.
- **PR 6 after 4-5** — validation changes touch both extension and web API clients.
- **PR 7 last** — database migrations should land after all application-level code is stable.
