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
| HIGH | 5 |
| MEDIUM | 7 |
| LOW | 10 |

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
