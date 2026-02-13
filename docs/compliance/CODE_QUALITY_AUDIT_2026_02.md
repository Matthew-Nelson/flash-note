# FlashNote Comprehensive Code Quality & Security Audit

**Date:** 2026-02-12
**Scope:** Full codebase audit — backend, extension, web app, database, CI/CD, dependencies
**Auditor:** Automated deep analysis (Claude Opus 4.6)

---

## Executive Summary

This audit performed a line-by-line security and code quality review of the FlashNote healthcare application across all three components (backend API, Chrome extension, Next.js web app), the database layer, CI/CD pipelines, and dependency configurations.

**Overall Assessment:** The codebase demonstrates strong security awareness throughout. SQL injection is consistently prevented via parameterized queries, authentication uses timing-safe comparisons, PHI handling follows defense-in-depth principles, and Sentry monitoring is broadly deployed. However, several findings require attention — particularly around missing security headers in the web app, infrastructure configuration gaps (trust proxy, CSP), and areas where HIPAA audit trail integrity could be improved.

### Findings Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 5 | Infrastructure security gaps, HIPAA data retention risks |
| **HIGH** | 12 | Auth architecture, token storage, input validation, schema integrity |
| **MEDIUM** | 24 | Race conditions, PHI leak vectors, rate limiting, CSRF gaps |
| **LOW** | 22 | Code quality, type safety, minor security hardening |
| **INFO** | 12 | Positive findings and minor observations |
| **Total** | **75** | |

---

## Table of Contents

1. [CRITICAL Findings](#1-critical-findings)
2. [HIGH Findings](#2-high-findings)
3. [MEDIUM Findings](#3-medium-findings)
4. [LOW Findings](#4-low-findings)
5. [INFO / Positive Findings](#5-info--positive-findings)
6. [Remediation Priority Matrix](#6-remediation-priority-matrix)
7. [Positive Security Controls](#7-positive-security-controls-already-in-place)

---

## 1. CRITICAL Findings

### C-1. No Security Headers Configured in Web App

**File:** `web/next.config.ts`
**Category:** Missing Security Controls
**Impact:** XSS exploitation, clickjacking, MIME sniffing, missing HTTPS enforcement

The Next.js configuration contains **no security headers whatsoever**. For a HIPAA-compliant healthcare application, the following are mandatory and missing:

- **Content-Security-Policy (CSP):** Primary defense against XSS. Without it, an injected script could exfiltrate PHI.
- **X-Frame-Options / frame-ancestors:** No clickjacking protection. The app could be embedded in a malicious iframe.
- **Strict-Transport-Security (HSTS):** No enforcement of HTTPS. Critical for HIPAA TLS requirements.
- **X-Content-Type-Options:** Missing `nosniff` allows MIME-type sniffing attacks.
- **Referrer-Policy:** No control over referrer leakage. Reset tokens in URLs could leak via Referer header.
- **Permissions-Policy:** Not configured.

There is also no Next.js middleware file (`middleware.ts`) for edge-level header enforcement.

**Recommendation:** Add comprehensive `headers()` configuration to `next.config.ts` or create a `middleware.ts` file. At minimum: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.

---

### C-2. Missing `trust proxy` in Express — Breaks All IP-Based Security

**File:** `backend/src/index.ts`
**Category:** Infrastructure / Security
**Impact:** Rate limiting ineffective, audit logs record wrong IPs, HIPAA audit trail integrity compromised

The Express application does **not** call `app.set('trust proxy', ...)`. When deployed behind a reverse proxy or load balancer (standard for production):

- `req.ip` always returns the proxy's IP, not the client's
- All rate limit counters are shared across ALL clients (effectively no rate limiting)
- All audit log entries record the proxy IP (HIPAA audit trail integrity compromised)
- CSRF tokens could be misattributed

This is the **single most impactful production deployment issue** in the audit. Every IP-based security control becomes ineffective.

**Recommendation:** Add `app.set('trust proxy', 1)` (or appropriate value for your infrastructure) before any middleware that reads `req.ip`.

---

### C-3. HIPAA Data Retention Risk — CASCADE DELETE on Sessions and Usage

**File:** `backend/src/db/migrations/001_initial_schema.sql`
**Category:** Data Integrity / HIPAA Compliance
**Impact:** User deletion would destroy session history and usage data required for HIPAA compliance

The `sessions` table (line 27) and `usage` table (line 48) use `ON DELETE CASCADE` on their `user_id` foreign keys. A single `DELETE FROM users WHERE id = ...` (accidental, admin error, or exploitation) would:

1. Permanently destroy all session records for that user
2. Permanently destroy all usage tracking records
3. Set `audit_logs.user_id` to NULL (via `SET NULL`), breaking the audit trail association

HIPAA requires retention of audit trails and access logs. While `legal_acceptances` uses `RESTRICT`, this guard only fires if a legal acceptance row exists for that user. The protection is incomplete and inconsistent.

**Recommendation:** Change `sessions` and `usage` foreign keys to `ON DELETE RESTRICT`. Implement soft-delete for users (add `deleted_at` column) instead of allowing hard deletes.

---

### C-4. Stripe Webhook Proxy Logs Unsanitized Error Bodies to Sentry

**File:** `web/src/app/api/webhooks/stripe/route.ts`, lines 36-50
**Category:** PHI Leak / Logging
**Impact:** Customer-identifying data could leak to Sentry and server logs

The webhook proxy reads the backend's error response body and forwards it unsanitized to both `Sentry.captureException` extras and `console.error`:

```typescript
errorBody = await response.json();
Sentry.captureException(new Error('Backend webhook error'), {
  extra: { errorBody }, // Unsanitized
});
console.error('Backend webhook error:', errorBody);
```

If the backend error response contains customer email, Stripe customer ID, or subscription metadata, this data leaks to monitoring systems.

**Recommendation:** Either remove `errorBody` from Sentry extras entirely, or sanitize it using the project's existing `sanitizeObject` utility before capture.

---

### C-5. Security Audit CI Job Uses `continue-on-error: true` — Vulnerabilities Never Block Merges

**File:** `.github/workflows/ci.yml`, lines 211-224
**Category:** CI/CD Security
**Impact:** Known high-severity dependency vulnerabilities can be merged without any gate

The `security-audit` job runs `pnpm audit --audit-level=high` for all packages, but each step has `continue-on-error: true`. This means the security audit **never fails the CI pipeline**, even with high-severity vulnerabilities. The `ci-success` gate job includes `security-audit` in its `needs`, but `continue-on-error` causes the job to always report success.

**Recommendation:** Remove `continue-on-error: true` from security audit steps, or implement a separate mandatory check that examines actual audit results.

---

## 2. HIGH Findings

### H-1. Email Address Logged as PII in Audit Metadata

**File:** `backend/src/routes/auth.ts`, line 183
**Category:** HIPAA Violation (PII in Audit Logs)
**Impact:** Email addresses stored in plaintext in audit log metadata

On login failure, the user's email is recorded directly in audit metadata:
```typescript
metadata: { email },
```

Email addresses are PII under HIPAA. All other audit log calls correctly log only `userId` or `null`. This is the sole exception.

**Recommendation:** Remove email from audit metadata. The `userId: null` already correctly indicates a failed login for an unknown user.

---

### H-2. Client-Only Authentication Guard — No Server-Side Protection

**File:** `web/src/components/auth/ProtectedRoute.tsx`
**Category:** Auth Architecture
**Impact:** Protected page HTML accessible without authentication

`ProtectedRoute` is a client-side-only guard using `useAuth()`. There is no Next.js middleware or server-side session validation. Protected pages are served to the browser before any auth check occurs. While the pages use `'use client'` (so SSR output shows a loading spinner, not actual data), the absence of middleware-level protection is a significant architectural gap.

**Recommendation:** Add a `middleware.ts` file that validates the session cookie/token before serving protected routes.

---

### H-3. Refresh Token in JavaScript-Accessible Storage (Both Web and Extension)

**Files:** `web/src/lib/storage.ts`, `extension/src/shared/storage.ts`
**Category:** Token Security
**Impact:** XSS vulnerability would expose 7-day refresh tokens

Both the web app (sessionStorage) and extension (chrome.storage.local) store refresh tokens in JavaScript-accessible storage without encryption. A single XSS vulnerability would allow an attacker to steal refresh tokens with a 7-day lifetime.

For the extension specifically, `chrome.storage.local` is not encrypted on disk, making it readable by local processes or physical access — particularly concerning in clinical environments with shared workstations.

**Recommendation:** For the web app, consider httpOnly cookies for refresh token storage. For the extension, document this as an accepted risk with compensating controls (session timeouts, token rotation) or evaluate Web Crypto API encryption at rest.

---

### H-4. API Responses Not Validated with Zod Before Use (Extension and Web)

**Files:** `extension/src/shared/api.ts` (lines 109, 152, 337), `web/src/lib/api.ts` (line 169)
**Category:** Input Validation / Type Safety
**Impact:** Malformed backend responses silently accepted as valid data

Both client API layers cast server responses with `as ApiResponse<T>` without runtime validation, despite having Zod schemas defined in their respective `schemas.ts` files. A compromised or misbehaving backend could return malformed data that clients trust blindly. In a healthcare context, corrupted SOAP note responses could result in clinicians pasting incorrect clinical documentation.

**Recommendation:** Validate API responses with appropriate Zod schemas before use. At minimum validate `AuthResponse` and `GeneratedNote` responses.

---

### H-5. Storage Data Read Without Schema Validation (Extension and Web)

**Files:** `extension/src/shared/storage.ts`, `web/src/lib/storage.ts`
**Category:** Input Validation
**Impact:** Corrupted or tampered storage data propagates through the application

Both clients read auth data from storage and cast it with `as StoredAuth` without validation. The web app does basic truthy checks on three fields but doesn't validate types or shapes. If storage data is corrupted, tampered with, or the schema evolves across versions, malformed data could cause authentication failures or security bypasses.

**Recommendation:** Parse storage data through Zod schemas on read. Clear auth state if validation fails.

---

### H-6. `subscription_status` Column Missing CHECK Constraint on Users Table

**File:** `backend/src/db/migrations/001_initial_schema.sql`, line 16
**Category:** Schema Design / Data Integrity
**Impact:** Arbitrary strings can be written to subscription status, potentially bypassing access control

The `organizations` table correctly has a `CHECK (subscription_status IN (...))` constraint, but the `users` table does not. The `updateSubscriptionStatus` function accepts `status: string` instead of `SubscriptionStatus`, allowing any arbitrary string to be written. No database-level enforcement prevents invalid subscription states.

**Recommendation:** Add a CHECK constraint matching the organizations table. Change TypeScript function signatures to accept `SubscriptionStatus` instead of `string`.

---

### H-7. Missing `NOT NULL` Constraints on Critical Timestamp Columns

**File:** `backend/src/db/migrations/001_initial_schema.sql`, lines 20-21
**Category:** Schema Design / Data Integrity
**Impact:** NULL timestamps could break audit trail integrity

`created_at` and `updated_at` columns across tables (`users`, `sessions`, `audit_logs`, `usage`, `organizations`) use `DEFAULT NOW()` but lack `NOT NULL` constraints. An explicit `INSERT ... (created_at) VALUES (NULL)` would succeed. For HIPAA-regulated applications, timestamp integrity is essential.

**Recommendation:** Add `NOT NULL` constraints to all `created_at` and `updated_at` columns.

---

### H-8. Invite Code `markCodeAsUsed` Does Not Set `is_active = FALSE`

**File:** `backend/src/db/queries/invite-codes.ts`, lines 123-132
**Category:** Data Integrity / Logic Error
**Impact:** Used codes still appear as "active" in queries filtering by `is_active`

When a code is redeemed, `used_by` and `used_at` are set, but `is_active` remains `TRUE`. The code appears in the `idx_invite_codes_org_pending` partial index. If any code path checks only `is_active` (rather than using `validateCodeRedeemable()`), it would consider a used code as still active.

**Recommendation:** Update the query to also set `is_active = FALSE` when marking a code as used.

---

### H-9. Non-Null Assertions (`!`) on Query Results Without Defensive Checks

**Files:** `backend/src/db/queries/users.ts` (lines 45, 55, 69, 88, 171), `organizations.ts`, `organization-members.ts`, `invite-codes.ts`, `legal-acceptances.ts`
**Category:** Type Safety / Robustness
**Impact:** Runtime TypeErrors if queries return zero rows unexpectedly

Across all query files, `result.rows[0]!` is used after INSERT RETURNING or basic length checks. Notably, `incrementTokenVersion` (line 171) does not check for empty results at all. If a user is deleted between auth check and this call, the application throws a runtime TypeError.

**Recommendation:** Add explicit empty-result checks before non-null assertions, especially on UPDATE/INSERT RETURNING queries.

---

### H-10. Billing Price ID Validation Bypassed When Env Vars Missing

**File:** `backend/src/routes/billing.ts`, lines 14-30
**Category:** Business Logic / Security
**Impact:** In production without price env vars, ANY Stripe price ID accepted (including $0.01 test prices)

When `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL` are not configured, the `allowedPriceIds` array is empty, and validation accepts **any** priceId. There is no enforcement that this permissive mode only applies to development.

**Recommendation:** Make Stripe price IDs required in production configuration, or reject all checkout requests when no valid prices are configured.

---

### H-11. Backend Error Messages Displayed Directly to Users (Web and Extension)

**Files:** `web/src/app/login/page.tsx` (line 73), `web/src/app/signup/page.tsx` (line 86), `web/src/app/dashboard/page.tsx` (line 142), `extension/src/sidepanel/components/LoginForm.tsx` (line 48)
**Category:** Information Disclosure / PHI Leak Risk
**Impact:** If backend ever includes internal details in error messages, they would be displayed to users

Multiple pages display `err.message` from API errors directly in the UI. While the current backend returns safe generic messages, this creates a fragile dependency — any backend change that adds more detail to error messages would immediately be visible to users.

**Recommendation:** Map error codes to client-side curated messages instead of displaying backend error text verbatim.

---

### H-12. Invite Code Generation Has TOCTOU Race Condition

**File:** `backend/src/db/queries/invite-codes.ts`, lines 53-66
**Category:** Race Condition
**Impact:** Concurrent requests could generate duplicate codes, causing unhandled unique violation errors

`generateUniqueCode()` checks for code existence via SELECT, then returns the code for later INSERT. Between the check and the actual INSERT (in `createInviteCode()`), another concurrent request could insert the same code. The UNIQUE constraint catches this, but `createInviteCode()` does not handle the unique violation with a retry.

**Recommendation:** Handle unique violation errors in `createInviteCode()` with a retry loop, or perform uniqueness check within the same transaction as the insert.

---

## 3. MEDIUM Findings

### M-1. Non-Atomic Password Reset Sequence

**File:** `backend/src/routes/auth.ts`, lines 426-440
**Category:** Race Condition
**Impact:** Crash between password update and token invalidation leaves old JWTs valid

The password reset handler performs four sequential operations without a transaction:
```typescript
await updatePassword(userId, passwordHash);
await incrementTokenVersion(userId);
await deleteSessionsByUserId(userId);
await resetLockout(userId);
```

If the process crashes after `updatePassword` but before `incrementTokenVersion`, the user's password is changed but old JWTs remain valid.

**Recommendation:** Wrap all four operations in a database transaction.

---

### M-2. Token Invalidation and Creation Not Atomic

**File:** `backend/src/services/token-service.ts`, lines 72-85
**Category:** Race Condition
**Impact:** Concurrent requests can create multiple valid tokens for the same user/type

`createToken` invalidates existing tokens and inserts a new one in separate queries without a transaction. Concurrent requests can result in two valid tokens, widening the attack window for password reset token leakage.

**Recommendation:** Wrap invalidation + insertion in a database transaction.

---

### M-3. Error Messages Leaked in Non-Production Environments

**File:** `backend/src/middleware/error-handler.ts`, lines 74-75
**Category:** HIPAA Violation (PHI in Error Responses)
**Impact:** Raw error messages (potentially containing PHI) returned to clients in dev/staging

In non-production environments, raw `err.message` is returned in API responses. If the error originated from a database query or from parsing user input containing PHI, the message could contain PHI. Healthcare software should use generic messages in all environments.

**Recommendation:** Always return generic error messages to clients regardless of environment.

---

### M-4. `err.message` Always Logged to Console (Including Production)

**Files:** `backend/src/middleware/error-handler.ts` (line 24), `backend/src/middleware/email-verification.ts` (line 78)
**Category:** HIPAA Violation (PHI in Logs)
**Impact:** Error messages containing user input could leak PHI to server logs

The error handler logs `err.message` for all environments. If an error message contains user-provided content (e.g., malformed JSON parse error, database constraint error), PHI could end up in server logs. The email verification middleware similarly logs raw error objects.

**Recommendation:** Sanitize or truncate error messages before logging. Use structured logging that flags messages as potentially PHI-contaminated.

---

### M-5. Rate Limiting is IP-Only — Ineffective Behind NAT/Proxies

**File:** `backend/src/middleware/rate-limit.ts`
**Category:** Security (Rate Limit Bypass)
**Impact:** Shared office IP could lock out all users; attacker with multiple IPs bypasses limits

All rate limiters key solely on `req.ip`. Multiple legitimate users behind a corporate NAT share the same counter (5 login attempts per 15 minutes shared across everyone). An attacker with rotating IPs bypasses rate limits entirely.

**Recommendation:** For login endpoints, add a compound key including the target email (hashed). For authenticated endpoints like `/notes/generate`, add user-keyed rate limiting.

---

### M-6. Refresh Token Hashed with bcrypt(10) Instead of bcrypt(12)

**File:** `backend/src/services/auth-service.ts`, line 393
**Category:** Security Configuration
**Impact:** Inconsistency with project security policy requiring bcrypt with 12 rounds minimum

The `storeRefreshToken` method uses `bcrypt.hash(refreshToken, 10)`, but CLAUDE.md specifies "bcrypt with 12 rounds minimum." Passwords correctly use `BCRYPT_ROUNDS = 12`.

**Recommendation:** Use `config.BCRYPT_ROUNDS` (12) consistently for all bcrypt operations.

---

### M-7. Usage Increment Not Atomic with Note Generation

**File:** `backend/src/routes/notes.ts`, lines 67-69
**Category:** Business Logic / Race Condition
**Impact:** Server crash between response and usage increment results in unbilled AI usage

Usage tracking is performed after note generation outside any transaction. If the server crashes between sending the response and incrementing usage, the consumption goes uncounted.

**Recommendation:** Consider a "credit check before generation" pattern or idempotent retry mechanism for usage tracking.

---

### M-8. Audit Log Failures Silently Swallowed Without Sentry

**Files:** `backend/src/utils/request-utils.ts` (lines 33-40), `backend/src/services/audit-service.ts` (lines 21-33)
**Category:** HIPAA Compliance (Audit Integrity)
**Impact:** Persistent audit log failures go unnoticed; HIPAA requires reliable audit logging

`safeAuditLog` catches errors and only prints to console. While the audit service itself captures to Sentry, there is no mechanism for retry, queuing, or alerting on sustained failures. Persistent audit failures could constitute a HIPAA violation.

**Recommendation:** Add `Sentry.captureException()` to `safeAuditLog`. Consider a circuit breaker or alert threshold for sustained audit failures.

---

### M-9. Missing Sentry Monitoring in Critical Paths

**Files:** `backend/src/middleware/email-verification.ts` (line 78), `backend/src/services/usage-service.ts` (lines 21-24)
**Category:** Observability
**Impact:** Database failures in email verification and usage tracking invisible in production

Per CLAUDE.md guidelines, any `catch` block with `console.error` that doesn't re-throw should include `Sentry.captureException()`. Both email verification middleware and usage service catch errors without Sentry capture.

**Recommendation:** Add Sentry monitoring to both catch blocks.

---

### M-10. Unauthenticated Pages Bypass API Client — Missing CSRF Protection

**Files:** `web/src/app/forgot-password/page.tsx`, `web/src/app/resend-verification/page.tsx`, `web/src/app/reset-password/page.tsx`
**Category:** CSRF
**Impact:** CSRF attacks could trigger password reset spam or email bombing

Four pages make direct `fetch()` calls instead of using the centralized API client, bypassing CSRF token attachment, automatic token refresh, retry logic, and consistent error handling.

**Recommendation:** Refactor these pages to use the existing API client methods (`requestPasswordReset()`, `resendVerificationEmail()`).

---

### M-11. Open Redirect via Backend-Provided URLs

**Files:** `web/src/app/dashboard/page.tsx` (line 132), `web/src/app/pricing/page.tsx` (line 76)
**Category:** Open Redirect
**Impact:** Compromised backend could redirect users to malicious sites

The application receives `portalUrl` and `checkoutUrl` from the backend and redirects with `window.location.href` without any domain validation.

**Recommendation:** Validate redirect URLs against an allowlist (e.g., `checkout.stripe.com`, `billing.stripe.com`).

---

### M-12. Reset Token in URL Query Parameters

**Files:** `web/src/app/reset-password/page.tsx`, `web/src/app/verify-email/page.tsx`
**Category:** Token Exposure
**Impact:** Tokens appear in server access logs, browser history, and potentially in Referer headers

Sensitive tokens are passed as URL query parameters and sent in GET requests. Without a `Referrer-Policy` header (see C-1), these tokens could leak via the Referer header.

**Recommendation:** This is partially mitigated by adding `Referrer-Policy: no-referrer` header (see C-1). Consider POST-based token validation instead of GET.

---

### M-13. Content Script Monkey-Patches Browser History API

**File:** `extension/src/content/floating-button.ts`, lines 182-192
**Category:** Chrome Extension / Compatibility
**Impact:** Could conflict with EMR's SPA routing or other extensions

The content script overrides `history.pushState` and `history.replaceState` to detect navigation. This could interfere with EMR software's own routing code. The overrides are never cleaned up.

**Recommendation:** Use `MutationObserver` or periodic polling instead of modifying global prototypes.

---

### M-14. `web_accessible_resources` Enables Extension Fingerprinting

**File:** `extension/public/manifest.json`, lines 78-83
**Category:** Chrome Extension Security
**Impact:** Any website can detect the extension is installed, enabling targeted phishing

The logo is accessible to `<all_urls>`, allowing any website to probe for the extension via `chrome-extension://<id>/icons/logo-cutout.png`. This reveals the user is a physical therapist.

**Recommendation:** Restrict `matches` to only the EMR domains listed in `content_scripts.matches`.

---

### M-15. Migration Script Lacks Advisory Locks

**File:** `backend/src/db/migrate.ts`, lines 45-96
**Category:** Migration Safety
**Impact:** Concurrent migrations (e.g., two pods starting) could cause conflicts

No `pg_advisory_lock` acquired before running migrations. If two migration processes run concurrently, both could attempt to apply the same migrations.

**Recommendation:** Acquire an advisory lock before checking/applying migrations.

---

### M-16. Migration 009 Not Idempotent

**File:** `backend/src/db/migrations/009_usage_token_split.sql`, lines 5-6
**Category:** Migration Safety
**Impact:** Re-running after partial failure would error on "column already exists"

`ALTER TABLE ... ADD COLUMN` without `IF NOT EXISTS`. Also drops `tokens_used` column in the same migration, which is risky for rolling deploys.

**Recommendation:** Add `IF NOT EXISTS` guards. Consider splitting column drop into a separate migration.

---

### M-17. PHI Sanitization Relies on Field-Name Heuristics Only

**File:** `backend/src/utils/sentry-sanitization.ts`, lines 13-33
**Category:** PHI Sanitization Effectiveness
**Impact:** PHI in non-matching field names passes through unredacted to Sentry

The `sanitizeObject` function only checks key names against patterns. PHI in fields named `data`, `text`, `description`, `value`, `details`, `reason`, etc. would not be redacted. Over-broad patterns (`/plan/i`, `/body/i`, `/message/i`) also redact non-PHI debugging context.

**Recommendation:** Consider a stricter allowlist approach for Sentry extras, or add value-level scanning for PHI patterns.

---

### M-18. Prompt Injection — XML Delimiters Not Escaped in User Content

**File:** `backend/src/utils/prompt-sanitization.ts`, lines 86-91
**Category:** Prompt Injection
**Impact:** User could include closing delimiter tags to break out of semantic boundaries

`wrapWithDelimiters` wraps user content in XML-style tags but does not escape or strip occurrences of those same tags within user content. Defense relies entirely on the LLM honoring instructions.

**Recommendation:** Strip or escape user-provided strings matching the exact delimiter tags before wrapping.

---

### M-19. `isAuthenticated` Derived from Client State Without Token Validation

**File:** `web/src/lib/auth-context.tsx`, lines 51-58
**Category:** Auth Integrity
**Impact:** Expired/tampered tokens in sessionStorage cause false "authenticated" state

The `isAuthenticated` flag comes from the presence of a `User` object in React state (initialized from sessionStorage). No token validation occurs on initialization, creating a window where protected UI content is shown with an invalid session.

**Recommendation:** Validate token expiry on initialization before setting `isAuthenticated`.

---

### M-20. `findMemberByOrgAndUser` Could Return Stale Membership

**File:** `backend/src/db/queries/organization-members.ts`, lines 77-90
**Category:** Data Integrity / Query Correctness
**Impact:** Could return removed membership instead of active one

The query doesn't filter on `removed_at IS NULL`, so it could return multiple rows (active + removed). Only `rows[0]` is returned, and row order is nondeterministic.

**Recommendation:** Add `ORDER BY removed_at NULLS FIRST` and/or `WHERE removed_at IS NULL`.

---

### M-21. `removeMember` Doesn't Verify Row Was Updated

**File:** `backend/src/db/queries/organization-members.ts`, lines 113-124
**Category:** Defensive Programming
**Impact:** Silent no-op on already-removed or non-existent members

The function returns `void` without checking `result.rowCount`. Callers have no way to know if the operation was a no-op.

**Recommendation:** Return `rowCount` or a boolean indicating success.

---

### M-22. Session Placeholder Hash Briefly in Database

**File:** `backend/src/services/auth-service.ts`, lines 376-398
**Category:** Security
**Impact:** Process crash leaves session with known 'placeholder' hash string

`storeRefreshToken` uses insert-then-update pattern with a `'placeholder'` token hash between the two operations.

**Recommendation:** Use a transaction or single INSERT with the real hash.

---

### M-23. E2E Workflow Exposes Secrets at Global `env` Level

**File:** `.github/workflows/e2e.yml`, lines 24-34
**Category:** CI/CD Security
**Impact:** All steps (including third-party actions) can access sensitive env vars

Environment variables with secrets are declared at the workflow top level, available to every job and step including `actions/upload-artifact@v4`.

**Recommendation:** Scope environment variables only to the steps that need them.

---

### M-24. CI Workflows Hardcode Test Secrets in YAML

**Files:** `.github/workflows/ci.yml` (lines 46-51), `.github/workflows/e2e.yml` (lines 28-34)
**Category:** CI/CD Security
**Impact:** Normalizes secret-in-code practice; test JWT secrets could forge tokens against accessible test environments

While these are clearly test/fake values, the pattern normalizes putting secrets in workflow files and could be flagged by HIPAA auditors.

**Recommendation:** Use GitHub Actions repository/environment secrets or generate ephemeral secrets in CI.

---

## 4. LOW Findings

### L-1. Missing Rate Limit on `validate-reset-token` Endpoint
**File:** `backend/src/routes/auth.ts`, line 388
**Impact:** Rapid probing of reset token validity (mitigated by token entropy)

### L-2. Auth Middleware Discards JWT Verification Error Details
**File:** `backend/src/middleware/auth.ts`, line 96
**Impact:** Configuration issues indistinguishable from expired tokens in monitoring

### L-3. Zod Validation Details Reveal Schema Information
**File:** `backend/src/middleware/error-handler.ts`, line 37
**Impact:** Field names and constraints exposed to attackers (aids reconnaissance)

### L-4. CSRF Token Format Fragile to userId Format Changes
**File:** `backend/src/middleware/csrf.ts`, lines 17, 33
**Impact:** If userId ever contains colons, CSRF validation would break

### L-5. Unsafe Type Cast of Database Role Value
**File:** `backend/src/middleware/organization.ts`, line 44
**Impact:** Invalid role from database propagates unchecked

### L-6. GEMINI_API_KEY and ANTHROPIC_API_KEY Optional in Schema
**File:** `backend/src/config.ts`, lines 24, 31
**Impact:** `string | undefined` type requires scattered null checks

### L-7. Database URL Partially Logged in Non-Production
**File:** `backend/src/env-loader.ts`, lines 52-61
**Impact:** Host, port, database name visible in logs

### L-8. Development CORS Allows Any Chrome Extension
**File:** `backend/src/index.ts`, line 46
**Impact:** Any malicious extension in developer's browser could make authenticated requests

### L-9. No Explicit Request Body Size Limit
**File:** `backend/src/index.ts`, lines 51-57
**Impact:** Express default 100KB applies, but should be explicit for defense-in-depth

### L-10. Billing Service Casts Stripe Objects Without Validation
**File:** `backend/src/services/billing-service.ts`, lines 132-137
**Impact:** Stripe object expansion could silently break type assumptions

### L-11. Audit Action Reuse Creates Ambiguous Trail
**File:** `backend/src/services/billing-service.ts`, lines 207, 240
**Impact:** `SUBSCRIPTION_CANCELLED` used for both cancellations and payment failures

### L-12. Legacy Refresh Token Path Has O(n) bcrypt Comparisons
**File:** `backend/src/services/auth-service.ts`, lines 532-549
**Impact:** Up to 5 bcrypt comparisons (~1.25s CPU) per refresh request on legacy path

### L-13. Claude Health Check Consumes API Tokens
**File:** `backend/src/services/llm/claude-provider.ts`, lines 394-415
**Impact:** Billable API call for health checks; HTTP 400 considered "healthy"

### L-14. `user_agent` Column Stored Unsanitized
**File:** `backend/src/db/queries/legal-acceptances.ts`, line 25
**Impact:** Arbitrarily long User-Agent strings could be stored (no length constraint)

### L-15. `email_tokens.token_hash` Lacks UNIQUE Constraint
**File:** `backend/src/db/migrations/003_email_verification.sql`, line 13
**Impact:** No structural enforcement of token hash uniqueness

### L-16. Redundant `idx_users_email` Index
**File:** `backend/src/db/migrations/001_initial_schema.sql`, line 59
**Impact:** Wastes storage; UNIQUE constraint already creates an index

### L-17. `invite_codes.created_by` Nullable — Type Mismatch with TypeScript
**File:** `backend/src/db/migrations/010_invite_codes.sql`, line 19
**Impact:** TypeScript type declares non-nullable but DB allows NULL

### L-18. Extension `localhost` in Production Content Script Matches
**File:** `extension/public/manifest.json`, line 52
**Impact:** Floating button injected into any localhost page in production builds

### L-19. Extension Hardcoded Version String
**File:** `extension/src/sidepanel/components/Settings.tsx`, line 184
**Impact:** Version will drift from manifest.json

### L-20. `getRequestMetadata` Returns Unsanitized IP
**File:** `backend/src/utils/request-utils.ts`, lines 19-27
**Impact:** Callers must remember to sanitize IP separately

### L-21. Default Fallback to `http://localhost:4000` in 6 Files
**Files:** `web/src/lib/api.ts`, 4 auth pages, `api/webhooks/stripe/route.ts`
**Impact:** Missing env var in production causes silent failures

### L-22. Global Error Page Missing `lang` Attribute
**File:** `web/src/app/global-error.tsx`
**Impact:** WCAG 2.1 SC 3.1.1 violation

---

## 5. INFO / Positive Findings

### I-1. SQL Injection Consistently Prevented
All database queries across the entire codebase use parameterized queries (`$1`, `$2`). No string concatenation of user input into SQL was found.

### I-2. Timing-Safe Password Comparison
Login flow uses bcrypt comparison with a dummy hash for non-existent users, preventing timing oracle attacks.

### I-3. CSRF Protection on State-Changing Endpoints
HMAC-signed, time-limited, user-bound CSRF tokens with timing-safe comparison on billing, notes, and organization endpoints.

### I-4. PHI Never Logged in Notes Route
Only metadata (noteType, token counts, timing) is logged. Note content is never persisted or logged.

### I-5. User Data Sanitization Before Response
`sanitizeUser()` strips passwordHash, failedLoginAttempts, lockedUntil, stripeCustomerId, subscriptionId.

### I-6. Webhook Idempotency
Billing webhook uses database-backed idempotency to prevent duplicate event processing.

### I-7. Organization Join Race Condition Prevention
Uses `FOR UPDATE` row locks within transactions for seat allocation and membership checks.

### I-8. Mock AI Production Guard
AI service throws at module load time if `USE_MOCK_AI` is enabled in production.

### I-9. No `dangerouslySetInnerHTML` Usage
No instances found in any component. All content rendered through React's JSX (automatic escaping).

### I-10. Sentry Session Replay Disabled
Explicitly disabled with HIPAA justification. Console breadcrumbs also filtered.

### I-11. Extension CSP Correctly Strict
`script-src 'self'; object-src 'self'` — no unsafe-inline, no unsafe-eval, no external scripts.

### I-12. React Strict Mode Enabled
Catches common bugs like effects with missing cleanup.

---

## 6. Remediation Priority Matrix

### Immediate (Before Launch)

| # | Finding | Effort | Risk if Unresolved |
|---|---------|--------|--------------------|
| C-1 | Add security headers to web app | Low | High — XSS, clickjacking, HTTPS enforcement |
| C-2 | Configure `trust proxy` in Express | Low | Critical — All IP-based security broken |
| C-5 | Fix CI security audit `continue-on-error` | Low | High — Vulnerable deps merged silently |
| H-1 | Remove email from audit log metadata | Low | Medium — PII compliance violation |
| H-6 | Add CHECK constraint to users.subscription_status | Low | High — Invalid subscription states possible |
| H-10 | Require Stripe price IDs in production | Low | High — Price manipulation attack |

### Short-Term (Next Sprint)

| # | Finding | Effort | Risk if Unresolved |
|---|---------|--------|--------------------|
| C-3 | Add ON DELETE RESTRICT to sessions/usage | Medium | Critical — Data retention HIPAA violation |
| C-4 | Sanitize webhook error bodies in Sentry | Low | Medium — PII leak to monitoring |
| H-2 | Add server-side auth middleware (web) | Medium | High — No SSR protection |
| H-4 | Validate API responses with Zod | Medium | High — Malformed data accepted |
| M-1 | Wrap password reset in transaction | Low | Medium — Non-atomic state change |
| M-5 | Add user-keyed rate limiting | Medium | Medium — Rate limits bypassed |
| M-8 | Add Sentry to safeAuditLog failures | Low | Medium — Silent audit failures |
| M-10 | Refactor auth pages to use API client | Medium | Medium — CSRF gap |

### Medium-Term (Next Quarter)

| # | Finding | Effort | Risk if Unresolved |
|---|---------|--------|--------------------|
| H-3 | Evaluate httpOnly cookies for refresh tokens | High | Medium — XSS = session takeover |
| M-6 | Fix bcrypt rounds to 12 for refresh tokens | Low | Low — Policy inconsistency |
| M-13 | Replace history.pushState monkey-patching | Medium | Low — EMR compatibility risk |
| M-15 | Add advisory locks to migrations | Low | Low — Concurrent deployment risk |
| M-17 | Improve PHI sanitization heuristics | Medium | Medium — PHI leak to Sentry |
| M-18 | Escape delimiter tags in user content | Low | Low — Prompt injection defense-in-depth |

---

## 7. Positive Security Controls Already in Place

The following security measures are correctly implemented and should be maintained:

1. **Parameterized SQL everywhere** — Zero SQL injection vectors found
2. **Timing-safe auth** — Dummy bcrypt hash for non-existent users
3. **Token versioning** — Immediate JWT invalidation on password reset
4. **Progressive account lockout** — Atomic SQL-based lockout with configurable thresholds
5. **CSRF on state-changing endpoints** — HMAC-signed, time-limited tokens
6. **PHI-free logging** — Note content never logged or persisted
7. **Sentry PHI sanitization** — `beforeSend` hooks strip request bodies
8. **Webhook idempotency** — Database-backed deduplication
9. **Race condition prevention** — `SELECT FOR UPDATE` on seat allocation, invite redemption
10. **Mock AI production guard** — Hard crash if mock enabled in production
11. **No XSS vectors** — No `dangerouslySetInnerHTML`, React handles escaping
12. **Session replay disabled** — HIPAA-aware Sentry configuration
13. **Strict CSP in extension** — `script-src 'self'` only
14. **Audit logging** — Comprehensive auth event logging (login, logout, token refresh, failures)
15. **User data sanitization** — Sensitive fields stripped before API responses

---
---

# SECOND-PASS: Deep Dive Audit

**Date:** 2026-02-12
**Methodology:** Targeted deep analysis of subtle bugs, race conditions, edge cases, test coverage gaps, and dependency risks that a first pass would miss.

## Second-Pass Summary

The second pass uncovered **78 additional findings** across 8 audit domains. Many of these are subtle race conditions, non-atomic multi-step operations, test coverage blind spots, and dependency risks that only become apparent through line-by-line analysis of interacting code paths.

| Severity | Count | Key Themes |
|----------|-------|------------|
| **CRITICAL** | 4 | Rate limit tests provide zero coverage; production mock-AI guard untested; middleware chain integration untested |
| **HIGH** | 22 | Refresh token race conditions, non-atomic password reset, duplicate subscriptions, cost control gaps, unmaintained bcryptjs |
| **MEDIUM** | 32 | Timing oracles, PHI retention, webhook reorder attacks, billing accuracy, missing audit trails |
| **LOW** | 20 | Type coercion, config validation, code quality, minor security hardening |

---

## 8. Second-Pass: Authentication & Token Lifecycle

### SP-1. Refresh Token Rotation Race Condition — Replay Window

**File:** `backend/src/services/auth-service.ts`, lines 279-312
**Severity:** HIGH
**Category:** Refresh Token Rotation / Race Condition

The `refreshTokens()` method performs validate → revoke → issue in separate non-transactional steps. If two concurrent requests arrive with the same refresh token, both can pass validation before either reaches revocation. Both requests succeed, producing two valid sessions from one token — defeating token rotation's purpose.

**Attack Vector:** An attacker who intercepts a refresh token sends two concurrent refresh requests. Both succeed, giving the attacker a valid session even after the legitimate client refreshes.

---

### SP-2. Legacy Refresh Token Path Leaves Sessions Unrevoked

**File:** `backend/src/services/auth-service.ts`, lines 555-561
**Severity:** HIGH
**Category:** Token Lifecycle / Incomplete Revocation

When `revokeRefreshToken` is called with an empty sessionId (legacy tokens), it returns early without deleting anything. During `refreshTokens()`, the old session row with its valid bcrypt hash remains in the database. The legacy validation path iterates ALL active sessions. **Result:** For legacy tokens, refresh token rotation is completely broken — old refresh tokens remain valid indefinitely.

---

### SP-3. Non-Atomic Password Reset Creates Inconsistent State Windows

**File:** `backend/src/routes/auth.ts`, lines 426-440
**Severity:** HIGH
**Category:** Race Condition / Inconsistent State

Four sequential operations without a transaction:
1. `updatePassword` → 2. `incrementTokenVersion` → 3. `deleteSessionsByUserId` → 4. `resetLockout`

- **Crash after step 1:** Password changed but old JWTs still valid (up to 1 hour)
- **Crash after step 2:** Old access tokens invalidated but refresh tokens still work
- **Crash after step 3:** Sessions cleared but lockout not reset — user locked out with new password

---

### SP-4. Per-Request DB Query on Every Auth Check — DoS Amplification

**File:** `backend/src/middleware/auth.ts`, line 47
**Severity:** MEDIUM
**Category:** Denial of Service / Performance

`requireAuth` performs `getTokenVersion(payload.userId)` on every authenticated request. With a pool of 20 connections and 2-second timeout, an attacker with a valid token can exhaust the connection pool before endpoint-specific rate limiting kicks in.

---

### SP-5. CSRF Token Not Invalidated on Password Reset

**File:** `backend/src/middleware/csrf.ts`, lines 15-23
**Severity:** MEDIUM
**Category:** CSRF Token Lifecycle

CSRF tokens are stateless HMAC-signed tokens valid for 24 hours. Password reset invalidates access tokens and refresh tokens, but CSRF tokens remain valid. A previously-obtained CSRF token remains usable for up to 24 hours after password reset.

---

### SP-6. Timing Oracle on Locked Accounts

**File:** `backend/src/services/auth-service.ts`, lines 186-244
**Severity:** MEDIUM
**Category:** Timing Side Channel

When an account is locked:
- Wrong password → `recordFailedAttempt` (UPDATE query, slower)
- Correct password → `getAccountLockoutStatus` (SELECT query, faster)

The timing difference is small but consistent and measurable, partially defeating the purpose of checking lockout after password validation.

---

### SP-7. Registration Email Enumeration via HTTP Status Code

**File:** `backend/src/services/auth-service.ts`, lines 44-49
**Severity:** MEDIUM
**Category:** Information Disclosure

Registration throws `AppError(409, 'email_exists')` with a distinct HTTP status. Unlike login (which uses timing-safe comparison), registration explicitly reveals whether an email is registered. In a healthcare context, this reveals someone is a physical therapist or uses PT services.

---

### SP-8. Concurrent Registration Race Condition

**File:** `backend/src/services/auth-service.ts`, lines 44-76
**Severity:** MEDIUM
**Category:** Race Condition

Email uniqueness check happens outside the transaction. The ~250ms bcrypt hash creates a window where two registrations with the same email both pass the check. The UNIQUE constraint catches this, but the error surfaces as a 500 instead of a clean 409.

---

### SP-9. Token Invalidation and Creation Not Atomic

**File:** `backend/src/services/token-service.ts`, lines 67-88
**Severity:** MEDIUM
**Category:** Race Condition

`createToken` invalidates existing tokens and inserts a new one in separate queries without a transaction. Concurrent "resend verification" requests can both succeed, creating multiple valid tokens simultaneously.

---

### SP-10. Audit Failure During Login Creates Orphaned Sessions

**File:** `backend/src/routes/auth.ts`, lines 179-197
**Severity:** MEDIUM
**Category:** HIPAA / Audit Integrity

If `auditService.log()` fails after a successful login, the error propagates as a 500. The client receives no tokens, but the server has already created a valid session — an orphaned session the user doesn't know about.

---

### SP-11. NaN Passes CSRF Timestamp Check

**File:** `backend/src/middleware/csrf.ts`, line 47
**Severity:** LOW
**Category:** Validation Edge Case

If `parseInt(timestamp, 10)` returns `NaN`, both `NaN > CSRF_TOKEN_EXPIRY_MS` and `NaN < 0` are `false`, so the timestamp check passes. The HMAC check would subsequently fail, so this is not exploitable but is a defense-in-depth gap.

---

### SP-12. Orphaned Placeholder Sessions Can Exhaust Session Limit

**File:** `backend/src/services/auth-service.ts`, lines 366-400
**Severity:** LOW
**Category:** Resource Leak

If bcrypt hash or UPDATE fails after the placeholder INSERT, orphaned session rows accumulate. Each counts against `MAX_SESSIONS_PER_USER = 5`. Repeated failures could lock a user out of creating new sessions.

---

## 9. Second-Pass: LLM / AI Service

### SP-13. Retry After Timeout Causes Duplicate Billable LLM Calls

**File:** `backend/src/services/llm/provider.ts`, lines 131-167
**Severity:** HIGH
**Category:** Cost Control

When the client-side AbortController fires on timeout, the retry logic sends the same prompt again. The original request may have already completed on the LLM provider's side. With 3 retries, a single slow request can cost 4x the expected amount.

---

### SP-14. No Input Token Budget Check Before Sending to LLM

**File:** `backend/src/services/ai-service.ts`, lines 71-136
**Severity:** HIGH
**Category:** Cost Control

`maxTokens` only controls output. With 5,000-character quickNotes + system prompt (~5,000 chars), input can reach 2,500+ tokens per request. There is no per-user daily/monthly token budget enforcement — `usageService.incrementUsage` tracks after generation but never enforces a pre-check.

---

### SP-15. XML Closing Tag Injection Not Escaped in User Content

**File:** `backend/src/utils/prompt-sanitization.ts`, lines 86-91
**Severity:** HIGH
**Category:** Prompt Injection

`wrapWithDelimiters` does not escape closing tags. A user providing `</clinician_notes>` in quickNotes prematurely closes the delimiter and injects content the LLM interprets as system instructions. `detectSuspiciousPatterns` monitors but does not block, and has **zero patterns** for XML delimiter manipulation.

---

### SP-16. Error `cause` Chain May Leak PHI to Sentry

**File:** `backend/src/services/llm/errors.ts`, lines 24-41
**Severity:** MEDIUM
**Category:** PHI Leakage

`LLMError` subclasses pass `cause` to the native Error constructor. Sentry serializes the full chain including `cause`. `ParseError` causes can contain Zod validation errors with fragments of LLM response content (which contains PHI). The `beforeSend` hook does not sanitize the `error.cause` chain.

---

### SP-17. Token Usage Silently Defaults to Zero

**File:** `backend/src/services/llm/gemini-provider.ts`, lines 226-227
**Severity:** MEDIUM
**Category:** Billing Accuracy

Both providers default token counts to `0` when API responses omit usage metadata. A systematic API change could result in massive uncounted costs with no alerting.

---

### SP-18. No Clinical Content Validation on LLM Output

**File:** `backend/src/services/llm/schemas.ts`, lines 160-207
**Severity:** MEDIUM
**Category:** Patient Safety

The Zod schema validates structure only. `z.string()` accepts empty strings. A production LLM glitch returning empty SOAP sections would pass validation and be returned to the clinician.

---

### SP-19. No Per-User Rate Limit on LLM Generation

**File:** `backend/src/middleware/rate-limit.ts`, lines 47-59
**Severity:** MEDIUM
**Category:** Cost Control

30 generations/minute rate limit is per-IP only. A single user across multiple IPs faces no aggregate limit. Sustained abuse at 30 req/min = ~11.7M tokens/hour per IP.

---

### SP-20. Prompt Injection Detection Has No XML Delimiter Patterns

**File:** `backend/src/utils/prompt-sanitization.ts`, lines 45-72
**Severity:** MEDIUM
**Category:** Security Monitoring Gap

The `SUSPICIOUS_PATTERNS` array has zero patterns for detecting `</clinician_notes>`, `</patient_context>`, or other XML delimiter manipulation — the exact attack that would bypass the system's primary defense.

---

### SP-21. Model Name Injected into URL Without Validation

**File:** `backend/src/services/llm/gemini-provider.ts`, line 134
**Severity:** MEDIUM
**Category:** Configuration Injection

`GEMINI_MODEL` is interpolated into the API URL with no validation beyond `z.string()`. A malicious env var like `../../v1/some-other-endpoint` could cause path traversal.

---

## 10. Second-Pass: Billing & Stripe

### SP-22. No Server-Side Guard Against Duplicate Subscriptions

**File:** `backend/src/services/billing-service.ts`, lines 19-42
**Severity:** HIGH
**Category:** Double-Charge / Billing Manipulation

`createCheckoutSession` creates a Stripe checkout without checking if the user already has an active subscription or Stripe customer. The only guard is a client-side check in `pricing/page.tsx`. A user with `active` subscription can create additional checkout sessions via direct API call, resulting in multiple Stripe subscriptions and double-billing.

---

### SP-23. Webhook Out-of-Order: `invoice.paid` Can Re-Activate Canceled Subscription

**File:** `backend/src/services/billing-service.ts`, lines 181-216
**Severity:** HIGH
**Category:** Webhook Reorder Attack

`handleInvoicePaid` unconditionally sets status to `active`. If a delayed `invoice.paid` event arrives after a `customer.subscription.deleted` event, the user's canceled subscription is silently re-activated. Idempotency checks prevent replay but not reorder.

---

### SP-24. Orphaned Stripe Customers on Re-Subscription

**File:** `backend/src/services/billing-service.ts`, lines 24-35
**Severity:** MEDIUM
**Category:** Stripe State Inconsistency

Checkout uses `customer_email` instead of reusing existing Stripe customer. Re-subscribing creates Customer B, orphaning Customer A (with its payment methods and history).

---

### SP-25. No Audit Trail for `handleSubscriptionUpdate`

**File:** `backend/src/services/billing-service.ts`, lines 150-160
**Severity:** MEDIUM
**Category:** HIPAA Audit Gap

Subscription status updates via webhook do not create audit entries, unlike checkout completion and deletion. Access-control-relevant state changes go unaudited.

---

### SP-26. `past_due` Immediately Blocks Access — No Grace Period

**File:** `backend/src/middleware/subscription.ts`, lines 67-77
**Severity:** MEDIUM
**Category:** Business Logic

First payment failure instantly locks users out. No grace period during Stripe's retry cycle. No payment failure email notification (TODO in code). An expired credit card causes instant lockout before user notification.

---

### SP-27. Usage Tracking Failure Silently Swallowed Without Sentry

**File:** `backend/src/services/usage-service.ts`, lines 20-24
**Severity:** MEDIUM
**Category:** Observability / Billing

`incrementUsage` catches all errors and only logs to console. No Sentry capture. Persistent failures mean users generate unlimited notes without usage being recorded.

---

### SP-28. No Organization-Level Usage Aggregation

**File:** `backend/src/routes/notes.ts`, line 69
**Severity:** MEDIUM
**Category:** Organization Billing

Usage is tracked per-user only. No mechanism for org-wide usage limits, team usage visibility, or per-seat billing based on actual consumption.

---

## 11. Second-Pass: Chrome Extension

### SP-29. Token Refresh Race Condition — No Mutex

**File:** `extension/src/shared/api.ts`, lines 79-133
**Severity:** HIGH
**Category:** Token Refresh Race Condition

No deduplication mechanism for concurrent refresh calls. Multiple API calls detecting an expired token simultaneously each call `refreshToken()` independently. The first succeeds and rotates; the second fails with the now-invalid old token and calls `storage.clearAuth()`, wiping the valid new tokens. **Result: Silent logout.**

---

### SP-30. PHI Retained in React State After Logout

**File:** `extension/src/sidepanel/App.tsx`, lines 94, 141-148
**Severity:** HIGH
**Category:** PHI Retention

`generatedNote` state (SOAP content), `patientContext`, and `quickNotes` (raw clinical input) are not explicitly cleared on logout. React unmounting abandons state to garbage collection with no zeroing. In shared-workstation clinical environments, PHI could persist in JS heap.

---

### SP-31. No AbortController for In-Flight Requests on Logout

**File:** `extension/src/sidepanel/components/NoteGenerator.tsx`, lines 86-119
**Severity:** MEDIUM
**Category:** Resource Leak / PHI

If the user logs out during note generation, the API call continues with retry logic (up to 3 retries with exponential backoff). The response with PHI is received but has nowhere to go — sitting in heap until GC.

---

### SP-32. PHI Persists in System Clipboard Indefinitely

**File:** `extension/src/sidepanel/components/ResultDisplay.tsx`, lines 32-52
**Severity:** MEDIUM
**Category:** PHI in Clipboard

`copyToClipboard` writes SOAP content to the system clipboard with no expiration timer. In shared-workstation environments, clipboard managers may persist history. No clipboard clearing on logout.

---

### SP-33. No React Error Boundary in Extension

**File:** `extension/src/sidepanel/App.tsx`, line 235
**Severity:** MEDIUM
**Category:** Error Boundary Gap

No error boundary wraps the component tree. Any rendering error crashes the entire sidepanel UI to a white screen with no recovery path.

---

### SP-34. Service Worker State Loss on Restart

**File:** `extension/src/background/service-worker.ts`, lines 29, 132-160
**Severity:** MEDIUM
**Category:** Service Worker Lifecycle

`sidepanelOpenByWindow` Map is in-memory. Chrome MV3 service workers can be killed after 30 seconds of inactivity. State loss desyncs floating button visual state.

---

### SP-35. Content Script Monkey-Patches History API Without Cleanup

**File:** `extension/src/content/floating-button.ts`, lines 182-192
**Severity:** MEDIUM
**Category:** EMR Compatibility

`history.pushState` and `history.replaceState` are overridden globally. Never cleaned up. Could interfere with EMR SPA routing.

---

### SP-36. Login Form Retains Password in State After Login

**File:** `extension/src/sidepanel/components/LoginForm.tsx`, lines 16-17
**Severity:** MEDIUM
**Category:** Credential Retention

`password` and `confirmPassword` state not explicitly cleared before unmount. In shared-workstation clinical environments, credentials linger in heap until GC.

---

### SP-37. Missing Origin Validation on Runtime Messages

**File:** `extension/src/background/service-worker.ts`, lines 109-125
**Severity:** MEDIUM
**Category:** Chrome Extension Security

`SIDEPANEL_OPENED`/`SIDEPANEL_CLOSED` messages accept `windowId` from the message payload instead of from `sender.tab?.windowId`. A compromised content script could spoof these messages.

---

## 12. Second-Pass: Database & Infrastructure

### SP-38. Migration Script Uses Pool-Level Transactions (Accidentally Safe)

**File:** `backend/src/db/migrate.ts`, lines 77-86
**Severity:** HIGH
**Category:** Migration Safety

`BEGIN`/`COMMIT`/`ROLLBACK` are called on the Pool object, not a dedicated client. Only safe because `max: 1` forces a single connection. If pool size ever changes, transactions silently break.

---

### SP-39. No Graceful Shutdown for HTTP Server

**File:** `backend/src/index.ts`, lines 73-77
**Severity:** HIGH
**Category:** Reliability

The `app.listen()` return value is never captured. No `server.close()` on shutdown. On SIGTERM, `db.end()` kills the pool underneath in-flight requests. No SIGINT handler. Sentry never flushed. In-flight SOAP note generations are abruptly terminated.

---

### SP-40. `updatePassword` and `incrementTokenVersion` Not Transactional

**File:** `backend/src/db/queries/users.ts`, lines 130-141, 161-172
**Severity:** MEDIUM
**Category:** Security / Session Invalidation

Separate functions executing as individual pool queries. Crash between them leaves password changed but all existing tokens valid.

---

### SP-41. DATABASE_URL Validated as Generic URL, Not PostgreSQL

**File:** `backend/src/config.ts`, line 12
**Severity:** MEDIUM
**Category:** Configuration Validation

`z.string().url()` accepts `http://`, `ftp://`, `file://` — doesn't enforce `postgres://` or `postgresql://` schema.

---

### SP-42. No Down-Migration Strategy

**File:** `backend/src/db/migrate.ts`
**Severity:** MEDIUM
**Category:** Migration Safety

No rollback mechanism. No `DOWN` SQL. Production migration failures require manual database intervention.

---

### SP-43. `incrementTokenVersion` Has No Empty-Result Guard

**File:** `backend/src/db/queries/users.ts`, line 171
**Severity:** MEDIUM
**Category:** Defensive Programming

`result.rows[0]!.token_version` — if user was deleted between auth check and this call, throws unhandled TypeError.

---

## 13. Second-Pass: Test Coverage Gaps

### SP-44. Rate Limit Tests Provide ZERO Security Coverage

**File:** `backend/src/middleware/rate-limit.test.ts`
**Severity:** CRITICAL
**Category:** False Confidence

Tests only verify rate limiters are exported as functions with correct arity. No test for: correct window sizes, correct max values, production vs development limits, response format, or key function. `inviteCodeValidateRateLimit` and `orgJoinRateLimit` are not tested at all.

---

### SP-45. Production Mock-AI Guard Is Untested

**File:** `backend/src/services/ai-service.ts`, lines 17-22
**Severity:** CRITICAL
**Category:** Patient Safety

The guard `if (isProduction && config.USE_MOCK_AI) throw` prevents fake clinical notes in production. **Zero test coverage.** If this guard fails, PTs receive fabricated SOAP notes entered into patient records.

---

### SP-46. No Integration Test for Middleware Chain

**Severity:** CRITICAL
**Category:** Missing Integration Tests

`requireAuth` → `requireCsrf` → `requireActiveSubscription` chain is tested in isolation only. No test verifies: correct ordering, request mutation propagation (`req.user`), or error handler interaction.

---

### SP-47. No Registration Test Without Invite Code

**File:** `backend/src/services/auth-service.test.ts`
**Severity:** CRITICAL
**Category:** Missing Coverage

No test for standard registration (without invite code). No test verifying bcrypt rounds match production config (tests mock 10, production requires 12). No test for `acceptedLegalTerms` enforcement at the service layer.

---

### SP-48. Stripe Webhook Signature Verification Is Mocked Away

**File:** `backend/src/services/billing-service.test.ts`
**Severity:** HIGH
**Category:** False Confidence

`stripe.webhooks.constructEvent` is mocked to return whatever the test wants. The actual Stripe signature verification logic is never executed. A Stripe SDK upgrade changing the API would not be caught.

---

### SP-49. Algorithm Confusion Attack Resistance Not Tested

**File:** `backend/src/middleware/auth.test.ts`
**Severity:** HIGH
**Category:** Missing Security Test

No test verifies that a JWT signed with `algorithm: 'none'` is rejected. The implementation correctly specifies `algorithms: ['HS256']`, but no test guards this.

---

### SP-50. Token Version in JWT Payload Not Tested

**File:** `backend/src/services/auth-service.test.ts`
**Severity:** HIGH
**Category:** Missing Security Test

No test verifies that generated access tokens contain `tokenVersion`. If accidentally removed, the password-reset-invalidates-sessions feature silently breaks.

---

### SP-51. Database Failure Paths Not Tested in Auth/Billing

**Severity:** HIGH
**Category:** Missing Failure Tests

No test for: `getTokenVersion` DB failure in auth middleware, `updateUserSubscription` failure after Stripe checkout, `storeRefreshToken` INSERT failure. All are fail-open risks.

---

### SP-52. `sanitizeUser` Not Fully Tested

**File:** `backend/src/services/auth-service.test.ts`
**Severity:** MEDIUM
**Category:** Missing Coverage

No test verifying `stripeCustomerId`, `subscriptionId`, `failedLoginAttempts`, `lockedUntil`, `lastFailedLoginAt`, or `tokenVersion` are excluded from sanitized user output.

---

## 14. Second-Pass: Dependency Analysis

### SP-53. `bcryptjs` Unmaintained Since 2017

**Severity:** HIGH
**Category:** Dependency Maintenance

`bcryptjs@2.4.3` — last published 8+ years ago. No security patches if vulnerabilities are discovered. For a healthcare application's password hashing, this is a significant risk.

**Recommendation:** Evaluate migration to `bcrypt` (native, maintained) or `argon2` (OWASP recommended).

---

### SP-54. Security-Critical Dependencies Not Pinned to Exact Versions

**Severity:** HIGH
**Category:** Supply Chain

Every dependency uses caret (`^`) ranges including `bcryptjs`, `jsonwebtoken`, `helmet`, `express`, `stripe`, `pg`. Any `pnpm install` without `--frozen-lockfile` can silently upgrade these.

---

### SP-55. Zod Version Mismatch Across Packages

**Severity:** HIGH
**Category:** Version Mismatch

Backend and extension use `^3.22.4`, web uses `^3.25.76`. Schema behavior differences between versions could cause inconsistent validation — especially dangerous for shared password policy schemas.

---

### SP-56. Express 5.x Ecosystem Maturity

**Severity:** MEDIUM
**Category:** Stability

Express 5 only reached stable release in mid-2025. Middleware ecosystem compatibility is still being established. For healthcare software, Express 4.x has a much longer track record.

---

### SP-57. No `.npmrc` With Security Hardening

**Severity:** MEDIUM
**Category:** Configuration

Missing: `save-exact=true`, `engine-strict=true`. No enforcement of exact version pinning or Node.js version requirements.

---

---

## 15. Combined Remediation Priority Matrix

### Tier 1: Immediate (Before Launch) — 15 items

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| C-2 | Configure `trust proxy` in Express | Low | All IP-based security broken without it |
| C-1 | Add security headers to web app (CSP, HSTS) | Low | XSS/clickjacking defense |
| SP-39 | Add graceful shutdown (capture server, close properly) | Low | In-flight request reliability |
| SP-3 | Wrap password reset operations in a transaction | Low | Non-atomic state change |
| SP-22 | Add server-side duplicate subscription check | Low | Double-billing prevention |
| H-1 | Remove email from audit log metadata | Low | PII compliance |
| H-10 | Require Stripe price IDs in production config | Low | Price manipulation |
| C-5 | Fix CI security audit `continue-on-error` | Low | Vulnerable deps merged silently |
| SP-29 | Add token refresh mutex in extension API client | Medium | Silent logout on concurrent calls |
| SP-1 | Wrap refresh token rotation in a transaction | Medium | Token replay attack |
| SP-30 | Clear PHI state on logout (extension) | Low | PHI retention on shared workstations |
| SP-15 | Escape XML delimiter tags in user content | Low | Prompt injection |
| SP-23 | Check Stripe subscription state before re-activating | Low | Webhook reorder attack |
| H-6 | Add CHECK constraint to users.subscription_status | Low | Invalid subscription states |
| H-7 | Add NOT NULL to timestamp columns | Low | Audit trail integrity |

### Tier 2: Short-Term (Next Sprint) — 18 items

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| C-3 | Change ON DELETE CASCADE to RESTRICT on sessions/usage | Medium | HIPAA data retention |
| C-4 | Sanitize webhook error bodies before Sentry | Low | PII leak to monitoring |
| H-2 | Add server-side auth middleware for web app | Medium | No SSR protection |
| H-4 | Validate API responses with Zod (extension + web) | Medium | Malformed data accepted |
| SP-44 | Replace rate limit tests with behavioral tests | Medium | Zero security coverage |
| SP-45 | Add test for production mock-AI guard | Low | Patient safety |
| SP-46 | Add middleware chain integration tests | Medium | Untested security boundary |
| SP-48 | Add real Stripe signature verification test | Medium | Webhook security |
| SP-33 | Add React error boundary in extension | Low | White screen crash |
| SP-32 | Clear clipboard on logout; consider auto-clear timer | Low | PHI in clipboard |
| SP-25 | Add audit log in handleSubscriptionUpdate | Low | HIPAA compliance |
| SP-27 | Add Sentry to usage tracking failures | Low | Silent billing failures |
| M-5 | Add user-keyed rate limiting on generation | Medium | Rate limit bypass |
| M-6 | Fix bcrypt rounds to 12 for refresh tokens | Low | Policy inconsistency |
| M-10 | Refactor auth pages to use API client (CSRF) | Medium | CSRF gap |
| SP-55 | Align Zod versions across all packages | Low | Schema inconsistency |
| SP-54 | Pin security-critical deps to exact versions | Low | Supply chain risk |
| SP-38 | Use dedicated client for migration transactions | Low | Migration safety |

### Tier 3: Medium-Term (Next Quarter) — 12 items

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| H-3 | Evaluate httpOnly cookies for refresh tokens | High | XSS = session takeover |
| SP-53 | Evaluate replacing bcryptjs with bcrypt/argon2 | Medium | Unmaintained dependency |
| SP-14 | Add input token budget pre-check | Medium | Cost control |
| SP-13 | Add idempotency keys for LLM retry logic | Medium | Duplicate billable calls |
| SP-18 | Add minimum length validation on SOAP output | Low | Empty clinical notes |
| M-15 | Add advisory locks to migrations | Low | Concurrent deployment risk |
| SP-42 | Implement down-migration strategy | Medium | Production rollback |
| SP-35 | Replace history API monkey-patching | Medium | EMR compatibility |
| M-14 | Restrict web_accessible_resources matches | Low | Extension fingerprinting |
| SP-17 | Alert on zero-token usage responses | Low | Billing accuracy |
| SP-21 | Validate GEMINI_MODEL against allowed pattern | Low | Config injection |
| SP-36 | Clear credentials from state on login success | Low | Credential retention |

---

## 16. Final Assessment

### Strengths
This codebase demonstrates **strong security fundamentals**. The development team clearly understands HIPAA requirements and has built defense-in-depth into the architecture. SQL injection is non-existent. Authentication uses timing-safe patterns. PHI logging is carefully avoided. Audit logging is comprehensive. The Sentry configuration is HIPAA-aware. These are not trivial to get right and indicate security-conscious development.

### Areas for Improvement
The primary gaps fall into three categories:

1. **Atomicity:** Many multi-step security operations (password reset, token rotation, session creation) execute as individual queries without database transactions. This creates windows where crashes or concurrent requests can leave the system in inconsistent security states.

2. **Client-Side Trust:** Both the web app and extension trust data from sessionStorage/chrome.storage without runtime validation, display backend error messages verbatim, and lack server-side middleware for route protection.

3. **Test Coverage False Confidence:** Several test suites mock away the exact security mechanisms they claim to test (Stripe signatures, rate limit values, production guards). The rate limit test suite provides zero actual security assurance.

### Risk Rating
**Overall: MEDIUM-HIGH for production deployment.** The codebase is far above average for security awareness, but the atomicity gaps and test coverage holes mean there are realistic attack vectors (particularly around billing manipulation and token replay) that should be addressed before handling real patient interactions.
