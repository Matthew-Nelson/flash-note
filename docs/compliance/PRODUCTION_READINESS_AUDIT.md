# Production Readiness Audit

**Date:** 2026-02-12
**Scope:** Full codebase audit against production engineering checklist
**Status:** Findings documented, no fixes applied yet

---

## Checklist Origin

Audit based on a senior engineer's production-readiness checklist covering:
1. Database query performance (N+1 problems, missing indexes)
2. Error handling and monitoring
3. Authentication vs Authorization (user data isolation)
4. Environment configuration (debug mode, exposed keys)
5. Database migration safety and backup strategy
6. Concurrent user handling (race conditions)
7. Input validation (special characters, edge cases)
8. Payment handling (silent failures)
9. Architectural decisions for scale

---

## Findings Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 7 |
| MEDIUM | 13 |
| LOW | 15 |

---

## CRITICAL Findings

### C-1: Webhook Idempotency Race Condition

**File:** `backend/src/services/billing-service.ts:80-87`

**Problem:** The idempotency check (`tryMarkWebhookProcessed`) runs _before_ the actual
processing. If the event is marked as processed and then the handler throws (e.g., database
error during `updateUserSubscription`), the event is permanently marked as processed. Stripe
retries are silently skipped. **A user can pay and never get access.**

**Recommended fix:** Wrap event processing in a try/catch. On processing failure, delete the
idempotency record so Stripe retries can succeed. Add Sentry capture for the rollback failure case.

### C-2: Token Refresh Double-Use Vulnerability

**File:** `backend/src/services/auth-service.ts:279-313`

**Problem:** The `refreshTokens()` method has a validate-then-revoke pattern that is not
atomic. Two concurrent refresh requests using the same token can both pass validation before
either revokes the session, resulting in token multiplication. An attacker with a stolen refresh
token can create multiple valid sessions that can't be revoked individually.

**Recommended fix:** Change to an atomic `DELETE ... RETURNING` pattern that validates and
revokes the session in a single SQL statement. The first request succeeds; the second finds
no matching row and fails. This eliminates the TOCTOU race condition entirely.

---

## HIGH Findings

### H-1: No Process-Level Error Handlers

**File:** `backend/src/index.ts`

**Problem:** No `process.on('unhandledRejection')` or `process.on('uncaughtException')` handlers.
Any error outside Express middleware (e.g., during database pool initialization, event handlers)
would crash the process silently without Sentry visibility. While Sentry's SDK registers its own
handlers, without `SENTRY_DSN` configured these events are completely unhandled.

**Recommended fix:** Add explicit handlers that capture to Sentry and ensure graceful shutdown
(flush Sentry, close DB pool) before exiting.

### H-2: Email Service Logs PII Without Production Guard

**File:** `backend/src/services/email-service.ts:182-191`

**Problem:** When `RESEND_API_KEY` is not configured, the email service logs the full recipient
email address, subject, and body to stdout. The guard is `if (!this.resend)` with no
production environment check. If the API key were accidentally unset in production, PII would
be logged to stdout.

**Recommended fix:** Add a production environment check. In production without Resend configured,
throw an error instead of silently logging PII.

### H-3: Web App Missing Security Headers

**File:** `web/next.config.ts`

**Problem:** No security headers configured. Missing Content-Security-Policy, HSTS,
X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.

**Recommended fix:** Add comprehensive security headers via Next.js `headers()` configuration.

### H-4: Redundant User Queries in Middleware Chain [NOT FIXED - Architectural]

**Files:** `backend/src/middleware/auth.ts`, `email-verification.ts`, `subscription.ts`

**Problem:** The `/notes/generate` endpoint hits the `users` table 3 times sequentially through
its middleware chain (auth checks `token_version`, email verification checks `email_verified`,
subscription checks `subscription_status`). This is the most performance-critical path.

**Recommendation:** Consolidate into a single query that fetches all needed fields. This
requires a middleware refactor and should be done as a dedicated optimization pass.

### H-5: No Query Logging or Slow Query Detection [NOT FIXED - Infrastructure]

**File:** `backend/src/db/index.ts`

**Problem:** No query timing, slow query alerting, or pool utilization metrics. In a
healthcare application, the inability to detect degraded database performance before it
becomes user-facing is a significant operational gap.

**Recommendation:** Add a query wrapper that logs execution time and captures slow queries
to Sentry. Add pool event listeners for utilization metrics.

### H-6: Login Failure Audit Log Stores Raw Email (PII) [Second Pass]

**File:** `backend/src/routes/auth.ts:183`

**Problem:** The failed login audit log includes `metadata: { email }` — the raw user email
address. This means the `audit_logs` table becomes a PII store, since every failed login attempt
writes the email into the JSONB metadata column. Under HIPAA, this adds data retention and access
control obligations to the audit_logs table beyond what's necessary. The email could also surface
in Sentry if audit service errors reference metadata.

**Recommended fix:** Remove the raw email from audit log metadata. Log only a boolean
`emailProvided: true` or a one-way hash. The audit trail captures `ipAddress` and `userAgent`
which are sufficient for investigating failed login patterns.

### H-7: Token Creation Non-Atomic (Invalidate + Insert) [Second Pass]

**File:** `backend/src/services/token-service.ts:72-85`

**Problem:** `createToken()` first invalidates existing tokens (UPDATE to set `used_at`),
then inserts a new token — in two separate queries with no transaction. If the process crashes
between the UPDATE and the INSERT, the user's existing verification/reset token is invalidated
but no replacement exists. The user cannot verify their email or complete a password reset until
they request a new token.

**Recommended fix:** Wrap the token invalidation and insertion in a database transaction.

---

## MEDIUM Findings

### M-1: Email Verification Middleware Bypasses Error Handler

**File:** `backend/src/middleware/email-verification.ts:76-83`

**Problem:** The catch block returns a 500 directly instead of calling `next(error)`,
bypassing Sentry capture and the global error handler.

**Recommended fix:** Change to use `next(error)` for consistent error handling and Sentry visibility.

### M-2: Usage Service Missing Sentry

**File:** `backend/src/services/usage-service.ts:21-24`

**Problem:** Usage tracking failures are only logged to console, not captured to Sentry.
Persistent usage tracking failures would be invisible to monitoring -- a billing integrity risk.

**Recommended fix:** Add `Sentry.captureException()` alongside the existing console.error.

### M-3: Password Reset Not Atomic

**File:** `backend/src/routes/auth.ts:428-440`

**Problem:** Five sequential operations (update password, increment token version, delete
sessions, reset lockout, audit log) are not wrapped in a transaction. A crash between
`updatePassword` and `incrementTokenVersion` would leave old tokens valid with the wrong
password hash.

**Recommended fix:** Wrap the four security-critical operations in a database transaction.

### M-4: Duplicate Email Registration Returns 500 Instead of 409 [NOT FIXED]

**File:** `backend/src/services/auth-service.ts:46-76`

**Problem:** The check-then-insert pattern for registration has a TOCTOU race. The database
UNIQUE constraint prevents actual duplicates, but the PostgreSQL error surfaces as a 500
instead of a clean 409 `email_exists` response.

**Recommendation:** Catch PostgreSQL unique violation (code `23505`) in the transaction's
catch block and rethrow as `AppError(409, 'email_exists', ...)`.

### M-5: No Advisory Lock in Migration Runner [NOT FIXED]

**File:** `backend/src/db/migrate.ts`

**Problem:** Two concurrent deployments could run migrations simultaneously. The UNIQUE
constraint on `migrations.name` provides some protection, but concurrent attempts could
cause failures.

**Recommendation:** Acquire `pg_advisory_lock` before running migrations.

### M-6: No Pre-Migration Backup Strategy [NOT FIXED - Infrastructure]

**Problem:** No automated backup before running migrations. Migration 009 includes a
destructive `DROP COLUMN`. For HIPAA compliance, backups must be automated and tested.

**Recommendation:** Add `pg_dump` to the migration runner or CI pipeline.

### M-7: Extension .env Files Tracked in Git [NOT FIXED]

**Files:** `extension/.env.development`, `extension/.env.production`

**Problem:** Contains Sentry DSN. While not a secret per Sentry's design, an attacker could
flood the DSN with junk errors to exhaust quotas. `.gitignore` doesn't cover these patterns.

**Recommendation:** Add `.env.development` and `.env.production` to `.gitignore`.

### M-8: No Expired Session Cleanup (Unbounded Table Growth) [Second Pass]

**Files:** `backend/src/db/queries/sessions.ts`, `backend/src/services/auth-service.ts`

**Problem:** The `sessions` table has no automated cleanup of expired sessions. Sessions have
`expires_at` but nothing ever deletes rows where `expires_at < NOW()`. With 5 concurrent
sessions per user and 7-day expiry, this table grows indefinitely. Under HIPAA, unbounded
retention of session metadata (IP addresses, user agents) is a compliance concern — data
should be purged when no longer needed for its original purpose.

**Recommended fix:** Add a periodic cleanup job (pg_cron or application-level scheduler) to
`DELETE FROM sessions WHERE expires_at < NOW()`. Run daily.

### M-9: cleanupExpiredTokens() Never Called [Second Pass]

**File:** `backend/src/services/token-service.ts:167-175`

**Problem:** The `cleanupExpiredTokens()` method exists but is never invoked — no cron job,
scheduler, startup routine, or endpoint calls it. The `email_tokens` table grows indefinitely
with expired and used tokens.

**Recommended fix:** Add a periodic invocation via pg_cron or a startup setInterval. Can share
a cleanup schedule with M-8 (expired sessions).

### M-10: Rate Limiters Use IP-Only Keying [Second Pass]

**File:** `backend/src/middleware/rate-limit.ts`

**Problem:** All rate limiters use the default `express-rate-limit` key generator (IP-based).
In clinical environments (the target user base), many PTs share a single office IP behind NAT.
One user hitting a rate limit locks out every user at that clinic. This is compounded by M-13
(missing `trust proxy` — behind a load balancer, ALL users share a single perceived IP).

**Recommended fix:** Use composite keying on auth endpoints (IP + email/username). For
authenticated endpoints, key by user ID instead of (or in addition to) IP.

### M-11: Webhook Handler Errors Not Caught Per-Event (Compounds C-1) [Second Pass]

**File:** `backend/src/services/billing-service.ts:89-119`

**Problem:** The individual event handlers (`handleCheckoutComplete`, `handleSubscriptionUpdate`,
etc.) are called directly without per-handler try/catch. If any handler throws (e.g., DB error
in `updateUserSubscription`), the entire `handleWebhook` method throws a 500 to Stripe. Combined
with C-1 (idempotency already marked before processing), this means the event is marked processed
AND returns an error — Stripe retries are blocked AND the event was never processed.

**Recommended fix:** Wrap each event handler case in try/catch. On failure, capture to Sentry
with event type context. This should be addressed alongside C-1.

### M-12: Error Handler console.error May Log PHI [Second Pass]

**File:** `backend/src/middleware/error-handler.ts:24-28`

**Problem:** The global error handler logs `err.message` to stdout via `console.error`. For
unexpected errors, the message may contain user-supplied input (e.g., failed JSON parse of a
request body containing patient names). These logs flow to whatever log aggregation service is
configured in production.

**Recommended fix:** In production, log only error name/code and a sanitized identifier, not
the raw message. The full error is already captured to Sentry with PHI sanitization.

### M-13: No `trust proxy` Express Configuration [Second Pass]

**File:** `backend/src/index.ts`

**Problem:** Express does not have `app.set('trust proxy', ...)` configured. Behind a reverse
proxy or load balancer (standard in production), `req.ip` returns the proxy's IP, not the
client's. This has two compounding effects:

1. **Rate limiting is effectively disabled** — all users share a single IP bucket
2. **Audit logs record the wrong IP** — HIPAA audit trail integrity is compromised

**Recommended fix:** Configure `trust proxy` based on deployment architecture (e.g.,
`app.set('trust proxy', 1)` for a single proxy layer).

---

## LOW Findings

| # | Finding | File | Status |
|---|---------|------|--------|
| L-1 | `GET /auth/validate-reset-token` lacks rate limiting | `routes/auth.ts:388` | Not fixed (unexploitable due to token entropy) |
| L-2 | Legacy token validation O(n) bcrypt loop | `auth-service.ts:532-549` | Self-resolving after legacy token expiry |
| L-3 | Billing checkout/portal endpoints lack rate limiting | `routes/billing.ts:35,57` | Low risk (auth + CSRF required) |
| L-4 | `RETURNING *` in legal acceptances | `legal-acceptances.ts:24` | Inconsistent with codebase standards |
| L-5 | `response.json()` can throw SyntaxError on non-JSON responses | `extension/src/shared/api.ts:152`, `web/src/lib/api.ts:169` | Low risk (backend always returns JSON) |
| L-6 | `safeAuditLog` catch has no Sentry | `utils/request-utils.ts:37-39` | Mitigated by audit-service internal Sentry |
| L-7 | No `min` pool size configured | `db/index.ts:8-14` | Cold-start latency after idle periods |
| L-8 | Backend source maps generated in production | `backend/tsconfig.json:16` | Low risk if not served |
| L-9 | CI security audit uses `continue-on-error: true` | `.github/workflows/ci.yml:214` | Vulnerabilities don't block CI |
| L-10 | Email case sensitivity (PostgreSQL WHERE email = $1) | `db/queries/users.ts:40` | Functional concern, not security |
| L-11 | Health endpoint doesn't check DB connectivity | `routes/health.ts` | Load balancer routes to broken instances [Second Pass] |
| L-12 | `getRequestMetadata` doesn't call `sanitizeIpAddress` | `utils/request-utils.ts:19-27` | Invalid IPs could break audit log INSERT [Second Pass] |
| L-13 | Graceful shutdown only handles SIGTERM, not SIGINT | `db/index.ts:30-35` | Undrained connections on Ctrl+C / some orchestrators [Second Pass] |
| L-14 | Web app stores refresh token in sessionStorage | `web/src/lib/storage.ts` | XSS-accessible (known architecture trade-off) [Second Pass] |
| L-15 | `storeRefreshToken` non-atomic insert-then-update | `auth-service.ts:366-400` | Zombie session rows on crash between queries [Second Pass] |

---

## Positive Findings (What's Working Well)

### Authentication & Authorization: EXCELLENT
- **Zero IDOR surface** -- No endpoint accepts entity IDs from user input. All resource access is JWT-derived.
- Timing-safe password comparison (dummy hash when user doesn't exist)
- Algorithm pinning (HS256) prevents algorithm confusion attacks
- Token versioning enables immediate session invalidation on password reset
- Progressive account lockout with atomic SQL
- CSRF protection with timing-safe HMAC comparison

### Input Validation: EXCELLENT
- 100% Zod schema coverage on all user-facing inputs
- 100% parameterized SQL queries (zero string concatenation)
- Zero `dangerouslySetInnerHTML` usage -- React auto-escaping throughout
- Multi-layered LLM prompt injection defense (XML delimiters + system instructions + monitoring)

### Data Isolation: EXCELLENT
- Every endpoint derives user identity exclusively from JWT tokens
- Organization access verified via JOIN (defense-in-depth beyond the denormalized `organization_id`)
- Invite code redemption uses `SELECT ... FOR UPDATE` within transactions
- Seat allocation uses pessimistic locking

### HIPAA Compliance: STRONG
- PHI never stored long-term (pass-through to LLM only)
- Comprehensive audit logging on all security events
- PHI sanitization in Sentry `beforeSend` hooks
- Legal acceptance recorded as immutable database records
- Error responses sanitized (no stack traces or PHI in production)

### Stripe Integration: STRONG (once C-1 is fixed)
- Webhook signature verification robust
- Secret key properly isolated to backend
- Checkout sessions created server-side
- Trial expiration enforced server-side (not manipulable)

---

## Recommendations for Future Work

1. **Consolidate middleware queries** (H-4) -- Single user query for auth+email+subscription
2. **Add query instrumentation** (H-5) -- Slow query logging, pool utilization metrics
3. **Add migration rollback support** -- Down migrations for safe production rollbacks
4. **Add pre-migration backups** (M-6) -- Automated `pg_dump` before destructive migrations
5. **Add migration advisory locking** (M-5) -- Prevent concurrent migration runs
6. **Partition audit_logs table** -- Time-based partitioning for unbounded growth
7. **Add `past_due` grace period** -- Don't instantly lock out users on first payment failure
8. **Normalize email to lowercase** -- Prevent case-variant duplicate accounts
9. **Configure `trust proxy`** (M-13) -- Critical for rate limiting and audit IP accuracy
10. **Add expired data cleanup jobs** (M-8, M-9) -- Sessions and email_tokens tables
11. **Remove PII from audit log metadata** (H-6) -- Email addresses in failed login logs
12. **Add composite rate limit keying** (M-10) -- IP + identifier for shared-IP clinics
13. **Add DB health check to `/health`** (L-11) -- `SELECT 1` with fast timeout
14. **Sanitize error handler logs** (M-12) -- Don't log raw error messages in production
