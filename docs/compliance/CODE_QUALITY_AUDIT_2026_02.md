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
