# FlashNote Security Audit Report

**Date:** January 2026 (Updated January 28, 2026, Code Review January 28, 2026)
**Auditor:** Security Review
**Scope:** Full codebase audit (backend, extension, web)
**Classification:** HIPAA-regulated healthcare application

---

## Executive Summary

This audit was originally conducted in January 2026 and identified **4 critical**, **9 high**, **8 medium**, and **5 low** severity security issues. This document has been updated to reflect the current remediation status and new findings based on updated HIPAA compliance standards.

### Current Status

| Severity | Original | Resolved | Accepted | Open | New Issues |
|----------|----------|----------|----------|------|------------|
| CRITICAL | 4 | 4 | 0 | 0 | 0 |
| HIGH | 9 | 11 | 1 | 1 | 4 |
| MEDIUM | 8 | 3 | 0 | 5 | 5 |
| LOW | 5 | 0 | 0 | 5 | 2 |

### Overall Risk Assessment: **LOW-MEDIUM** (improved from MEDIUM)

All critical vulnerabilities have been remediated. The codebase demonstrates good security fundamentals (parameterized queries, bcrypt hashing, JWT tokens with explicit algorithms, input validation). Remaining gaps are primarily in defense-in-depth controls and HIPAA audit requirements.

---

## Critical Findings

### CRITICAL-001: Credential Logging in Web App
**Status:** RESOLVED
**File:** `web/src/app/login/page.tsx`
**Severity:** CRITICAL
**CVSS:** 9.1

**Original Issue:** User passwords were logged to the browser console via `console.log('Login:', { email, password })`.

**Resolution:** The credential logging line has been removed. The login page now redirects users to the Chrome extension for authentication.

---

### CRITICAL-002: No Rate Limiting on Token Refresh Endpoint
**Status:** RESOLVED
**File:** `backend/src/routes/auth.ts:99`
**Severity:** CRITICAL
**CVSS:** 8.6

**Original Issue:** The `/auth/refresh` endpoint had no rate limiting, unlike login and register endpoints.

**Resolution:** Added `refreshRateLimit` middleware (30 attempts per 15 minutes) to the `/auth/refresh` endpoint at `backend/src/middleware/rate-limit.ts:59-72`.

---

### CRITICAL-003: JWT Algorithm Not Specified in Verification
**Status:** RESOLVED
**Files:** `backend/src/middleware/auth.ts:25-26`, `backend/src/services/auth-service.ts:103,112,119-120`
**Severity:** CRITICAL
**CVSS:** 9.8

**Original Issue:** JWT verification did not specify the expected algorithm, making it vulnerable to algorithm confusion attacks.

**Resolution:** All JWT operations now explicitly specify `algorithms: ['HS256']`:
- Access token verification in auth middleware
- Access token generation in auth service
- Refresh token generation and verification in auth service

---

### CRITICAL-004: API Key Exposed in URL Parameter
**Status:** RESOLVED
**File:** `backend/src/services/ai-service.ts:81-92`
**Severity:** CRITICAL
**CVSS:** 8.2

**Original Issue:** The Gemini API key was passed as a URL query parameter.

**Resolution:** API key moved to request header using `x-goog-api-key` header, preventing exposure in logs and browser history.

---

## High Severity Findings

### HIGH-001: No Password Reset Functionality
**Status:** RESOLVED
**Files:** `backend/src/routes/auth.ts`, `backend/src/services/token-service.ts`, `backend/src/services/email-service.ts`, `web/src/app/forgot-password/page.tsx`, `web/src/app/reset-password/page.tsx`
**Severity:** HIGH
**CVSS:** 6.5

**Original Issue:** Healthcare workers locked out of their accounts could not recover access, potentially causing:
- Delayed critical patient documentation
- Workarounds that bypass security
- HIPAA violations if users share credentials

**Resolution:** Implemented secure password reset flow with:

**Token Security:**
- 256-bit cryptographically random tokens (32 bytes)
- SHA-256 hashed for storage (appropriate for high-entropy tokens)
- 15-minute expiry (per security audit recommendation)
- Single-use enforcement via atomic database operation
- Previous tokens invalidated when new one is generated

**Endpoints:**
- `POST /auth/request-password-reset` - Request reset email (rate limited: 3/hour per IP)
- `GET /auth/validate-reset-token` - Check if token is valid (for UI validation)
- `POST /auth/reset-password` - Complete reset with new password (rate limited: 5/15min per IP)

**Security Properties:**
- Enumeration-safe: Same response for existing/non-existing emails
- Session invalidation: All existing sessions deleted on password reset
- Lockout reset: Failed login counter cleared on password reset
- Full audit logging: `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_SUCCESS`, `PASSWORD_RESET_TOKEN_INVALID`

**Web Pages:**
- `/forgot-password` - Request password reset
- `/reset-password` - Enter new password (validates token before showing form)

**Extension Integration:**
- Forgot password flow available inline in LoginForm (no web redirect needed for request)

---

### HIGH-002: Missing CSRF Protection
**Status:** RESOLVED
**File:** `backend/src/middleware/csrf.ts`
**Severity:** HIGH
**CVSS:** 6.5

**Original Issue:** No CSRF tokens were implemented for state-changing operations.

**Resolution:** Implemented stateless signed CSRF token system:

**Token Design:**
- Format: `base64url(userId:timestamp:hmac_signature)`
- HMAC-SHA256 signed using JWT_SECRET
- 24-hour expiry window
- User-bound (token userId must match authenticated user)
- Timing-safe comparison to prevent timing attacks

**Protected Endpoints:**
- `POST /notes/generate` - Core functionality
- `POST /billing/checkout` - Financial operations
- `POST /billing/portal` - Financial operations
- `POST /auth/logout` - Session destruction

**Implementation Files:**
- `backend/src/middleware/csrf.ts` - Token generation, validation, and middleware
- `backend/src/services/auth-service.ts` - CSRF token included in auth responses
- `backend/src/routes/notes.ts` - `requireCsrf` middleware applied
- `backend/src/routes/billing.ts` - `requireCsrf` on /checkout and /portal
- `backend/src/routes/auth.ts` - `requireCsrf` on /logout
- `extension/src/shared/storage.ts` - csrfToken stored with auth data
- `extension/src/shared/schemas.ts` - csrfToken added to schemas
- `extension/src/shared/api.ts` - X-CSRF-Token header included in requests

**Why This Approach:**
- No database changes required (stateless)
- Works with Bearer token architecture
- Defense-in-depth against XSS+CSRF chain attacks
- Meets HIPAA expectation for layered security controls

---

### HIGH-003: No Content Security Policy
**Status:** RESOLVED
**File:** `backend/src/index.ts:14-24`
**Severity:** HIGH
**CVSS:** 6.1

**Original Issue:** Helmet was enabled but CSP was not configured.

**Resolution:** Implemented CSP appropriate for a JSON REST API:
- `defaultSrc: ["'none'"]` - API serves no renderable content
- `frameAncestors: ["'none'"]` - Prevent embedding in iframes (clickjacking protection)
- HSTS enabled with 1-year max-age, includeSubDomains, and preload

**Note:** Extensive CSP directives (scriptSrc, styleSrc, etc.) are not necessary for a pure JSON API since those directives only apply when browsers render HTML content. Helmet's defaults handle other security headers (X-Frame-Options, X-Content-Type-Options, etc.).

---

### HIGH-004: Stripe Webhook Content-Type Mismatch
**Status:** RESOLVED
**File:** `web/src/app/api/webhooks/stripe/route.ts:26`
**Severity:** HIGH
**CVSS:** 7.4

**Original Issue:** Hardcoded `Content-Type: application/json` header when forwarding raw body to backend.

**Resolution:** Now forwards the original content-type from the Stripe request: `request.headers.get('content-type') || 'application/json'`

---

### HIGH-005: No Account Lockout Mechanism
**Status:** RESOLVED
**Files:** `backend/src/services/lockout-service.ts`, `backend/src/services/auth-service.ts`, `backend/src/db/migrations/002_account_lockout.sql`
**Severity:** HIGH
**CVSS:** 5.9

**Original Issue:** Rate limiting resets after the window. There was no permanent lockout after repeated failures, allowing persistent attackers to continue attempts indefinitely by waiting between windows.

**Resolution:** Implemented database-backed progressive account lockout with timing-safe login:

**Progressive Lockout Thresholds:**
- 5 failures: 15-minute lockout
- 10 failures: 1-hour lockout
- 15 failures: 24-hour lockout
- 20+ failures: Permanent lockout (requires admin unlock)

**Implementation Details:**
1. **Database Migration** (`002_account_lockout.sql`):
   - Added `failed_login_attempts`, `locked_until`, `last_failed_login_at` columns to users table
   - Added index on `locked_until` for efficient lockout queries

2. **Lockout Service** (`lockout-service.ts`):
   - `getAccountLockoutStatus()` - Check if account is locked
   - `recordFailedAttempt()` - Increment failures, apply lockout if threshold exceeded
   - `resetFailedAttempts()` - Reset on successful login
   - `unlockAccount()` - Admin function for manual unlock

3. **Timing-Safe Login** (`auth-service.ts`):
   - Always performs bcrypt comparison (even for non-existent users) to prevent timing attacks
   - Uses dummy hash comparison when user doesn't exist
   - Checks lockout AFTER password validation to prevent lockout status from being a timing oracle
   - Returns identical error for invalid credentials vs locked account

4. **Audit Logging:**
   - `ACCOUNT_LOCKED` - Logged when lockout is triggered (includes lockout duration, attempt count)
   - `ACCOUNT_UNLOCKED` - Logged when admin unlocks account
   - `LOGIN_BLOCKED_LOCKED` - Available for future use when revealing lockout status

**Security Properties:**
- Consistent response time regardless of account existence (timing-safe)
- No information leakage about lockout status (same error as invalid credentials)
- Per-account tracking (not just IP-based)
- Persists across server restarts (database-backed)
- Full audit trail for compliance

**Future Enhancements (Documented in SECURITY_AUDIT.md):**
- Admin API endpoint for unlocking accounts
- Email notification when account is locked
- Self-service unlock via verified email

---

### HIGH-006: Refresh Token Not Bound to Device/IP
**Status:** OPEN
**File:** `backend/src/services/auth-service.ts`
**Severity:** HIGH
**CVSS:** 6.8

Refresh tokens can be used from any device/IP without validation.

**Risk:** Stolen refresh tokens can be used by attackers from different locations.

**Fix:** Store device fingerprint and/or IP with refresh token, validate on refresh. Add columns to sessions table:
```sql
ALTER TABLE sessions ADD COLUMN ip_address INET;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;
```

---

### HIGH-007: No Email Verification
**Status:** RESOLVED
**Files:** `backend/src/routes/auth.ts`, `backend/src/services/token-service.ts`, `backend/src/services/email-service.ts`, `backend/src/middleware/email-verification.ts`, `backend/src/db/migrations/003_email_verification.sql`, `web/src/app/verify-email/page.tsx`, `web/src/app/resend-verification/page.tsx`
**Severity:** HIGH
**CVSS:** 5.3

**Original Issue:** Users could register with any email without verification.

**Risk:**
- Account takeover via typo-squatting
- Spam accounts
- No way to verify identity for password resets

**Resolution:** Implemented complete email verification flow:

**Database Schema:**
- Added `email_verified` (boolean) and `email_verified_at` (timestamp) columns to users table
- Created `email_tokens` table for secure token storage with types: `email_verification`, `password_reset`

**Token Security:**
- 256-bit cryptographically random tokens (32 bytes, URL-safe base64)
- SHA-256 hashed for storage
- 24-hour expiry for verification tokens
- Single-use enforcement via atomic UPDATE query
- Previous tokens invalidated when new one is generated

**Endpoints:**
- `POST /auth/verify-email` - Verify email with token (handles "already verified" gracefully)
- `POST /auth/resend-verification` - Resend verification email (rate limited: 3/hour per IP)

**Access Control Middleware:**
- `requireEmailVerification` middleware blocks unverified users from:
  - Note generation (`/notes/generate`)
  - Billing operations (`/billing/checkout`, `/billing/portal`)
- Returns 403 with `email_not_verified` error code
- Logs `ACCESS_DENIED` audit event

**Registration Flow:**
- New users receive verification email automatically on registration
- Unverified users can log in but see verification banner
- Extension polls for verification status (auto-clears banner when verified)

**Web Pages:**
- `/verify-email` - Processes verification token from email link
- `/resend-verification` - Request new verification email

**Extension UX:**
- Verification banner shown for unverified users
- "Resend verification email" button in banner
- Auto-polling every 10 seconds clears banner when verified (no logout required)
- Forgot password flow inline in LoginForm

**Audit Logging:**
- `EMAIL_VERIFICATION_SENT` - On registration
- `EMAIL_VERIFICATION_SUCCESS` - On successful verification
- `EMAIL_VERIFICATION_FAILED` - On invalid/expired token
- `EMAIL_VERIFICATION_RESENT` - On resend request

---

### HIGH-008: Mock AI Can Be Enabled in Production
**Status:** RESOLVED
**File:** `backend/src/services/ai-service.ts:7-14`
**Severity:** HIGH
**CVSS:** 5.4

**Original Issue:** `USE_MOCK_AI=true` could be set in production environment.

**Resolution:** Added runtime check that throws an error at startup if `USE_MOCK_AI` is enabled in production:
```typescript
if (isProduction && config.USE_MOCK_AI) {
  throw new Error(
    'SECURITY ERROR: USE_MOCK_AI cannot be enabled in production. ' +
    'Mock responses could generate fake clinical notes that harm patients.'
  );
}
```

---

### HIGH-009: Audit Logs Missing User-Agent
**Status:** RESOLVED
**File:** `backend/src/services/audit-service.ts:9`
**Severity:** HIGH
**CVSS:** 4.3

**Original Issue:** The database schema includes `user_agent` column but it was never populated.

**Resolution:** Audit service now accepts and stores `userAgent` parameter. All auth routes pass `req.get('user-agent')` to audit logging.

---

## New High Severity Findings (HIPAA Compliance)

### HIGH-010: PHI May Persist in Extension Storage
**Status:** RESOLVED
**File:** `extension/src/shared/storage.ts`
**Severity:** HIGH
**CVSS:** 6.5

**Original Issue:** The `lastUsedPatientContext` field was defined in the storage schema, which would persist patient identifiers or diagnoses in `chrome.storage.local` beyond the active session.

**Resolution:** Removed the `lastUsedPatientContext` field entirely from:
- `StoredPreferences` interface in `storage.ts`
- Default preferences in `getPreferences()`
- `storedPreferencesSchema` in `schemas.ts`

Patient context now only exists in React component state during the active session.

---

### HIGH-011: Authorization Failures Not Audited
**Status:** RESOLVED
**Files:** `backend/src/middleware/auth.ts`, `backend/src/middleware/subscription.ts`
**Severity:** HIGH
**CVSS:** 5.0

**Original Issue:** Authorization failures returned error responses but were NOT logged to the audit system.

**Resolution:** Added audit logging for all authorization failure scenarios:
- `AUTH_FAILED` action logged in auth middleware for missing/invalid tokens
- `ACCESS_DENIED` action logged in subscription middleware for:
  - Missing user context
  - User not found
  - Trial expired
  - Subscription required

All audit entries include userId (when available), reason, path, IP address, and user-agent.

---

## New High Severity Findings (Code Review - January 28, 2026)

### HIGH-012: Email Logged in Failed Login Audit
**Status:** ACCEPTED RISK
**File:** `backend/src/routes/auth.ts:73`
**Severity:** HIGH (downgraded to LOW after analysis)
**CVSS:** 5.5 (original), 2.0 (revised)

User-provided email is logged directly in audit metadata for failed login attempts:
```typescript
await auditService.log({
  userId: null,
  action: AuditAction.LOGIN_FAILED,
  status: 'FAILURE',
  metadata: { email },  // User input logged directly
  ...
});
```

**Original Concerns:**
- Enables user enumeration through audit log analysis
- Sets precedent for logging user-supplied data
- Email addresses may contain PII in some contexts

**Risk Acceptance Rationale (January 28, 2026):**
After analysis, this is accepted as standard security practice:
1. **Audit logs are internal** - stored in the `audit_logs` database table, accessible only to operators with database access. An attacker with that access could query the `users` table directly.
2. **Input is validated** - Email is Zod-validated (`z.string().email()`) before logging, ensuring it's a properly-formatted email address, not arbitrary injection content.
3. **Email is PII, not PHI** - HIPAA primarily concerns Protected Health Information. Email addresses don't reveal health conditions.
4. **Security investigation value** - Logging failed login emails is essential for investigating brute-force attacks and identifying targeted accounts. This is industry-standard practice.
5. **Low actual risk** - User enumeration via audit log analysis requires prior database compromise.

**Decision:** Accept risk. The security investigation value outweighs the minimal PII exposure risk in this context.

---

### HIGH-013: No Query Statement Timeout (formerly HIGH-014)
**Status:** RESOLVED
**File:** `backend/src/db/index.ts:6-12`
**Severity:** HIGH
**CVSS:** 6.0

**Original Issue:** The database connection pool had connection timeout but individual queries had no statement timeout. Long-running or malicious queries could exhaust the connection pool (20 connections), causing denial of service for all users.

**Resolution:** Added 30-second `statement_timeout` to the database pool configuration:
```typescript
export const db = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 30000,
});
```

PostgreSQL will now terminate any query exceeding 30 seconds, immediately releasing the connection back to the pool and preventing resource exhaustion attacks.

---

## Medium Severity Findings

### MEDIUM-001: TypeScript Type Assertion Bypasses Type Safety
**Status:** RESOLVED
**File:** `backend/src/routes/notes.ts:15`
**Severity:** MEDIUM

**Original Issue:** `notesRouter.use(requireActiveSubscription as any);`

**Resolution:** The `as any` cast has been removed. Proper typing now used for middleware.

---

### MEDIUM-002: Inefficient Refresh Token Validation
**Status:** OPEN
**File:** `backend/src/services/auth-service.ts:143-156`
**Severity:** MEDIUM

```typescript
for (const row of result.rows) {
  if (await bcrypt.compare(refreshToken, row.refresh_token_hash)) {
    return true;
  }
}
```

**Risk:** O(n) bcrypt comparisons per refresh. With many sessions per user, this could cause:
- DoS via resource exhaustion
- Slow response times

**Fix:** Store a token identifier (first 8 chars of hash) for quick lookup, then verify full hash:
```sql
ALTER TABLE sessions ADD COLUMN token_hint VARCHAR(16);
```

---

### MEDIUM-003: No Session Timeout Warning
**Status:** OPEN
**Severity:** MEDIUM

Users aren't warned before token expiration.

**Risk:** Lost work if session expires mid-documentation.

**Fix:** Implement client-side countdown and auto-refresh before expiry. Add `expiresAt` timestamp tracking in extension.

---

### MEDIUM-004: Database Connection Errors Not Handled
**Status:** OPEN
**File:** `backend/src/db/index.ts:18-20`
**Severity:** MEDIUM

```typescript
db.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});
```

**Risk:** Errors are logged but not handled. Database reconnection not attempted.

**Fix:** Implement connection retry logic with exponential backoff.

---

### MEDIUM-005: Prompt Injection Vulnerability
**Status:** OPEN
**File:** `backend/src/prompts/pt-prompts.ts:100-128`
**Severity:** MEDIUM

User input (`quickNotes`, `patientContext`) is directly concatenated into prompts without sanitization.

**Risk:** Malicious users could inject prompt instructions to:
- Extract system prompts
- Generate inappropriate content
- Bypass safety guidelines

**Fix:** Implement input sanitization and prompt injection detection. Consider using structured prompt formats or XML-style delimiters.

---

### MEDIUM-006: No Request ID for Tracing
**Status:** OPEN
**Severity:** MEDIUM

No request ID is generated for log correlation.

**Risk:** Difficult to trace issues across services for debugging and audit purposes.

**Fix:** Add `x-request-id` header generation middleware using `uuid` or `nanoid`.

---

### MEDIUM-007: CORS Allows Development Origins
**Status:** OPEN
**File:** `backend/src/index.ts:15-19`
**Severity:** MEDIUM

```typescript
origin: config.NODE_ENV === 'production'
  ? [config.WEB_URL]
  : ['http://localhost:3000', 'http://localhost:5173'],
```

**Risk:** In staging/test environments that aren't "production", CORS is permissive.

**Fix:** Use explicit environment checks or whitelist approach. Consider `ALLOWED_ORIGINS` env var.

---

### MEDIUM-008: Extension Stores Both Tokens Together
**Status:** OPEN
**File:** `extension/src/shared/storage.ts`
**Severity:** MEDIUM

Access and refresh tokens stored in the same storage object.

**Risk:** If storage is compromised, attacker gets both tokens.

**Fix:** Consider storing refresh token more securely or implementing additional encryption layer.

---

## New Medium Severity Findings (HIPAA Compliance)

### MEDIUM-009: Note Generation Failures Not Audited
**Status:** RESOLVED
**File:** `backend/src/routes/notes.ts`
**Severity:** MEDIUM

**Original Issue:** Only successful note generations were logged to the audit system. Failed attempts passed through without audit logging.

**Resolution:** Added audit logging in catch block with:
- `NOTE_GENERATED` action with `FAILURE` status
- noteType and error type (validation_error or generation_error)
- Error messages intentionally excluded to prevent PHI leakage
- userId, IP address, and user-agent included

---

### MEDIUM-010: Prompt Parsing Warnings May Leak Context
**Status:** OPEN
**File:** `backend/src/prompts/pt-prompts.ts:164`
**Severity:** MEDIUM

```typescript
console.warn(`Missing SOAP sections: ${missing.join(', ')}`);
```

While this specific line doesn't log PHI directly, it indicates that error/warning logging paths exist that could inadvertently capture user content in stack traces or related error context.

**Risk:** If logging is expanded or errors bubble up with context, PHI could leak to logs.

**Fix:** Ensure all logging paths are audited for PHI exposure. Consider structured logging that explicitly excludes user content fields.

---

## New Medium Severity Findings (Code Review - January 28, 2026)

### MEDIUM-011: No Session Count Limit Per User
**Status:** OPEN
**File:** `backend/src/services/auth-service.ts:136-144`
**Severity:** MEDIUM

`storeRefreshToken` creates new sessions without limiting count per user:
```typescript
await db.query(
  `INSERT INTO sessions (user_id, refresh_token_hash, expires_at)
   VALUES ($1, $2, $3)`,
  [userId, hash, expiresAt]
);
```

**Risk:**
- An attacker with valid credentials could create unlimited sessions
- Causes database bloat over time
- Exacerbates MEDIUM-002 (O(n) bcrypt comparisons per refresh)

**Relation to MEDIUM-002:** These issues should be addressed together. Limiting sessions reduces the performance impact of the bcrypt loop.

**Fix:** Add session limit (e.g., max 5 active sessions) and remove oldest when exceeded:
```typescript
// Before inserting new session
await db.query(
  `DELETE FROM sessions WHERE user_id = $1 AND id NOT IN (
    SELECT id FROM sessions WHERE user_id = $1
    ORDER BY created_at DESC LIMIT 4
  )`,
  [userId]
);
```

**Implementation Note:** The extension UI is already prepared for this feature. The `SessionAlert` component (added January 29, 2026) supports a `session_limit` reason that displays "You were signed out because you signed in on another device." When implementing session limits, dispatch the `AUTH_INVALIDATED_EVENT` with `reason: 'session_limit'` and the UI will handle it automatically.

---

### MEDIUM-012: LLM API Error Response May Contain PHI
**Status:** RESOLVED
**File:** `backend/src/services/ai-service.ts:110-131`
**Severity:** MEDIUM

**Original Issue:** Raw API error response was logged without sanitization:
```typescript
const error = await response.text();
console.error('Gemini API error:', error);
```

**Risk:** Error responses from LLM APIs may echo back portions of the request (which contains PHI from `quickNotes` and `patientContext`), which would then be logged.

**Resolution (January 28, 2026):** Implemented provider-agnostic sanitized error logging:
1. HTTP errors now log only status code and status text, never the response body
2. Catch block errors log only error type and message, never the full error object
3. Added security comments explaining the principle for future maintainers

```typescript
// HTTP errors - safe fields only
console.error('LLM API error:', {
  status: response.status,
  statusText: response.statusText,
});

// Caught errors - type and message only
console.error('LLM service error:', { type: error.name, message: error.message });
```

**Design Note:** The fix is provider-agnostic. The same principle applies regardless of LLM provider (Gemini, Claude, OpenAI, etc.) - never log raw error responses from APIs that receive PHI.

---

### MEDIUM-013: Missing Webhook Idempotency Check
**Status:** OPEN
**File:** `backend/src/services/billing-service.ts:52-85`
**Severity:** MEDIUM

Stripe webhooks are processed without checking for duplicate events:
```typescript
async handleWebhook(body: Buffer, signature: string): Promise<void> {
  // No idempotency check for event.id
  switch (event.type) {
    case 'checkout.session.completed':
      await this.handleCheckoutComplete(session);
```

**Risk:** Stripe may retry webhooks on delivery failures. Without idempotency checks:
- Duplicate subscription status updates
- Potential billing inconsistencies
- Duplicate audit log entries

**Fix:** Store processed event IDs and skip duplicates:
```typescript
// Check if already processed
const existing = await db.query(
  'SELECT id FROM webhook_events WHERE stripe_event_id = $1',
  [event.id]
);
if (existing.rows.length > 0) {
  return; // Already processed
}
// Process and record
await db.query(
  'INSERT INTO webhook_events (stripe_event_id) VALUES ($1)',
  [event.id]
);
```

---

### MEDIUM-014: Extension API Client Missing Retry Logic
**Status:** OPEN
**File:** `extension/src/shared/api.ts:71-99`
**Severity:** MEDIUM

The API client doesn't implement retry logic for transient failures:
```typescript
private async request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // No retry on 5xx or network errors
  const response = await fetch(`${API_BASE}${endpoint}`, { ... });
```

**Risk:**
- Users see failures for temporary network issues that would succeed on retry
- Poor UX in unstable network conditions (common in clinical environments)
- Lost work if note generation fails on transient error

**Fix:** Add exponential backoff retry for 5xx errors and network failures:
```typescript
private async requestWithRetry<T>(
  endpoint: string,
  options: RequestInit = {},
  retries = 3
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await this.request(endpoint, options);
    } catch (error) {
      if (i === retries - 1) throw error;
      if (error instanceof ApiError && error.status < 500) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}
```

---

### MEDIUM-015: CORS Missing Extension Origin in Production
**Status:** OPEN
**File:** `backend/src/index.ts:15-19`
**Severity:** MEDIUM

**Update to MEDIUM-007:** In addition to the staging/test environment concern, the production CORS configuration only allows `config.WEB_URL`:
```typescript
origin: config.NODE_ENV === 'production'
  ? [config.WEB_URL]
  : ['http://localhost:3000', 'http://localhost:5173'],
```

**Risk:** Chrome extensions make requests from `chrome-extension://<extension-id>` origins. If the extension makes direct API calls in production, they may be blocked by CORS.

**Note:** The extension may work via different mechanisms (e.g., service worker fetch without CORS, or if the API doesn't enforce CORS for Bearer-authenticated requests). This should be verified.

**Fix:** If extension requires CORS, add the extension ID to allowed origins:
```typescript
origin: config.NODE_ENV === 'production'
  ? [config.WEB_URL, 'chrome-extension://YOUR_EXTENSION_ID']
  : ['http://localhost:3000', 'http://localhost:5173'],
```

Or use a CORS configuration that allows credentialed requests from extensions.

---

## Low Severity Findings

### LOW-001: Console Logging in Production
**Status:** OPEN
**Severity:** LOW

Multiple `console.log` and `console.error` statements throughout codebase (25+ instances in backend).

**Fix:** Implement structured logging with a library like `pino` or `winston` that supports:
- Log levels (debug, info, warn, error)
- JSON formatting for log aggregation
- PHI field filtering

---

### LOW-002: No Health Check Authentication
**Status:** OPEN
**File:** `backend/src/routes/health.ts`
**Severity:** LOW

Health endpoint is public.

**Risk:** Information disclosure about service status.

**Fix:** Consider adding basic auth or IP restrictions for detailed health endpoints. Keep simple `/health` public for load balancers.

---

### LOW-003: Missing Test Coverage
**Status:** OPEN
**Severity:** LOW

No test files found in the codebase.

**Risk:** Regressions and security issues may not be caught.

**Fix:** Implement comprehensive test suite covering security-critical paths:
- Authentication flows
- Authorization checks
- Input validation
- Token handling

---

### LOW-004: No Security Headers for Extension
**Status:** OPEN
**File:** `extension/public/manifest.json`
**Severity:** LOW

No Content Security Policy defined for extension.

**Fix:** Add CSP to manifest.json:
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

---

### LOW-005: Dependency Audit Required
**Status:** OPEN
**Severity:** LOW

No automated dependency vulnerability scanning configured.

**Fix:** Add `npm audit` or `snyk` to CI pipeline. Consider Dependabot for automated PRs.

---

## New Low Severity Findings (Code Review - January 28, 2026)

### LOW-006: Subscription Status Uses Magic Strings
**Status:** OPEN
**File:** `backend/src/middleware/subscription.ts:66,94`
**Severity:** LOW

Subscription status is checked with string literals rather than constants or enums:
```typescript
if (user.subscription_status === 'trialing')
if (user.subscription_status === 'active')
```

**Risk:** Typos could cause silent failures in authorization logic. This is a code quality issue rather than a security vulnerability.

**Fix:** Define subscription statuses as an enum or constants:
```typescript
export const SubscriptionStatus = {
  TRIALING: 'trialing',
  ACTIVE: 'active',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due',
} as const;
```

---

### LOW-007: JSON Body Size Limit Not Explicit
**Status:** OPEN
**File:** `backend/src/index.ts:23`
**Severity:** LOW

Express JSON body parser relies on implicit default size limit:
```typescript
app.use(express.json());
```

**Note:** Express defaults to 100KB, which is adequate (the max legitimate request based on Zod validation is ~5.5KB). This is not an active vulnerability.

**Risk:**
- Express could change the default in a future version
- Security auditors may flag the missing explicit limit
- Code clarity - not immediately obvious a limit exists

**Fix:** Make the default explicit for clarity:
```typescript
app.use(express.json({ limit: '100kb' }));
```

---

## Compliance Checklist (HIPAA)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Access Controls | PARTIAL | Missing MFA; account lockout (HIGH-005) and email verification (HIGH-007) implemented |
| Audit Controls | PASS | Auth failures (HIGH-011) and generation failures (MEDIUM-009) now logged |
| Transmission Security | PASS | TLS enforced |
| PHI Storage | PASS | No PHI stored; patient context kept in memory only (HIGH-010 resolved) |
| Unique User IDs | PASS | UUID-based |
| Automatic Logoff | FAIL | No session timeout warning |
| Encryption | PARTIAL | Tokens not encrypted at rest |
| Password Management | PASS | Password reset (HIGH-001) and email verification (HIGH-007) implemented |

---

## Recommended Remediation Priority

### Before Production (DoS & Security Hardening)
1. ~~**HIGH-002:** CSRF protection~~ RESOLVED
2. ~~**HIGH-013:** Query statement timeout (DoS prevention)~~ RESOLVED
3. ~~**HIGH-003:** Content Security Policy~~ RESOLVED
4. ~~**HIGH-005:** Account lockout mechanism~~ RESOLVED
5. ~~**HIGH-001 + HIGH-007:** Password reset + email verification~~ RESOLVED
6. ~~**HIGH-006 + MEDIUM-002 + MEDIUM-011:** Session infrastructure (device binding, O(1) validation, session limits)~~ RESOLVED

---

## Implementation Groups

Open issues have been organized into logical groups for efficient implementation. Issues within each group share code paths, dependencies, or architectural concerns.

### ~~Group A: Session Infrastructure (Backend)~~ RESOLVED
**Priority: HIGH** | **Issues: HIGH-006, MEDIUM-002, MEDIUM-011**

All three issues required changes to the `sessions` table schema and `auth-service.ts`. Implemented together with a single migration.

| Issue | Description | Status |
|-------|-------------|--------|
| HIGH-006 | Refresh token not bound to device/IP | ✅ RESOLVED |
| MEDIUM-002 | O(n) bcrypt loop on token validation | ✅ RESOLVED |
| MEDIUM-011 | No session count limit per user | ✅ RESOLVED |

**Implementation (completed January 30, 2026):**
1. Migration `006_session_device_binding.sql`:
   - Added `ip_address` (INET) and `user_agent` (TEXT) columns to sessions
   - Added `idx_sessions_user_created` index for session cleanup queries
2. Refresh tokens now include `sessionId` in JWT payload for O(1) lookup
3. Device binding: IP/user-agent stored on session creation, mismatches logged (lenient mode)
4. Session limit: Max 5 sessions per user, oldest deleted when exceeded
5. Backwards compatible: Legacy tokens fall back to O(n) validation
6. New audit events: `SESSION_DEVICE_CHANGE`, `SESSION_LIMIT_EXCEEDED`

---

### Group B: Extension Resilience
**Priority: MEDIUM** | **Issues: MEDIUM-003, MEDIUM-008, MEDIUM-014**

All extension-side improvements to authentication resilience and error handling. Touch `extension/src/shared/api.ts` and `storage.ts`.

| Issue | Description | Shared Code |
|-------|-------------|-------------|
| MEDIUM-003 | No session timeout warning | storage.ts, token tracking |
| MEDIUM-008 | Both tokens stored together | storage.ts architecture |
| MEDIUM-014 | No API retry logic | api.ts request handling |

**Implementation approach:**
1. Refactor token storage architecture (MEDIUM-008)
2. Add `expiresAt` tracking and warning UI (MEDIUM-003)
3. Implement exponential backoff retry for 5xx/network errors (MEDIUM-014)

**Dependencies:** Partially depends on Group A (token response changes)

---

### Group C: Observability Stack
**Priority: MEDIUM** | **Issues: LOW-001, MEDIUM-004, MEDIUM-006**

All about logging and monitoring infrastructure. If implementing structured logging, naturally include request IDs and proper error handling.

| Issue | Description | Shared Code |
|-------|-------------|-------------|
| LOW-001 | Console logging in production | All backend files |
| MEDIUM-006 | No request ID for tracing | Middleware, logger |
| MEDIUM-004 | DB connection errors not handled | db/index.ts, logger |

**Implementation approach:**
1. Add structured logging library (pino recommended for performance)
2. Add request ID middleware, include in all log entries
3. Implement DB connection retry with exponential backoff
4. Replace all `console.log/error` calls with structured logger

**Dependencies:** None - can be done independently

---

### Group D: CORS Configuration
**Priority: MEDIUM** | **Issues: MEDIUM-007, MEDIUM-015**

Both issues are in `backend/src/index.ts:15-19`. Same root cause: hardcoded origin logic.

| Issue | Description | Shared Code |
|-------|-------------|-------------|
| MEDIUM-007 | CORS allows dev origins in staging | index.ts CORS config |
| MEDIUM-015 | Extension origin missing in prod | index.ts CORS config |

**Implementation approach:**
1. Add `ALLOWED_ORIGINS` environment variable
2. Parse as comma-separated list
3. Include extension ID in production config
4. Remove NODE_ENV-based logic

**Dependencies:** None - quick win

---

### Group E: LLM/Prompt Security
**Priority: MEDIUM** | **Issues: MEDIUM-005, MEDIUM-010**

Both in prompt handling code (`backend/src/prompts/`). Address injection and leakage risks together.

| Issue | Description | Shared Code |
|-------|-------------|-------------|
| MEDIUM-005 | Prompt injection vulnerability | pt-prompts.ts |
| MEDIUM-010 | Prompt warnings may leak context | pt-prompts.ts logging |

**Implementation approach:**
1. Audit all prompt code for PHI leakage in logs/warnings
2. Implement input sanitization before LLM submission
3. Consider XML-style delimiters for user content isolation
4. Add prompt injection detection heuristics

**Dependencies:** None - isolated to prompt code

---

### Group F: CI/CD Pipeline
**Priority: LOW** | **Issues: LOW-003, LOW-005**

Pipeline improvements rather than code changes.

| Issue | Description | Implementation |
|-------|-------------|----------------|
| LOW-003 | Missing test coverage | Add test suites for security-critical paths |
| LOW-005 | No dependency vulnerability scanning | Add `npm audit` or Snyk to CI |

**Implementation approach:**
1. Add `npm audit --audit-level=high` to CI pipeline
2. Consider Dependabot for automated PRs
3. Add test coverage for auth, authorization, token handling

**Dependencies:** None - can be done anytime

---

### Standalone Items

Quick fixes that don't require grouping:

| Issue | Description | Effort |
|-------|-------------|--------|
| MEDIUM-013 | Missing webhook idempotency | Medium - new table + billing-service changes |
| LOW-002 | Health check authentication | Low - add basic auth or IP restriction |
| LOW-004 | Extension CSP missing | Low - manifest.json change |
| LOW-006 | Subscription magic strings | Low - extract to constants |
| LOW-007 | Body size limit implicit | Low - one-line fix |

---

## Recommended Implementation Order

```
Phase 1: Security Foundation
├── Group A: Session Infrastructure (HIGH-006, MEDIUM-002, MEDIUM-011)
└── Group D: CORS Configuration (MEDIUM-007, MEDIUM-015)

Phase 2: Security Hardening
├── Group E: LLM/Prompt Security (MEDIUM-005, MEDIUM-010)
└── MEDIUM-013: Webhook Idempotency (standalone)

Phase 3: Resilience & UX
├── Group B: Extension Resilience (MEDIUM-003, MEDIUM-008, MEDIUM-014)
└── Group C: Observability Stack (LOW-001, MEDIUM-004, MEDIUM-006)

Phase 4: Ongoing
├── Group F: CI/CD Pipeline (LOW-003, LOW-005)
└── Standalone low-priority items
```

**Rationale:**
- Phase 1 addresses the only remaining HIGH issue and a quick CORS fix
- Phase 2 handles security-critical prompt injection before it becomes a vector
- Phase 3 improves reliability and debugging capability
- Phase 4 is continuous improvement

---

## Change Log

| Date | Changes |
|------|---------|
| January 2026 | Initial audit completed |
| January 27, 2026 | **Major remediation update:** All critical issues (CRITICAL-001 through CRITICAL-004) resolved. Resolved HIGH-004, HIGH-008, HIGH-009, HIGH-010, HIGH-011, MEDIUM-001, MEDIUM-009. Added HIGH-010, HIGH-011, MEDIUM-009, MEDIUM-010 based on updated HIPAA compliance standards. Updated risk assessment from HIGH to MEDIUM. Key fixes: removed PHI persistence in extension storage, added comprehensive audit logging for auth/access failures and note generation failures. |
| January 28, 2026 | **Resolved HIGH-002 (CSRF Protection):** Implemented stateless signed CSRF tokens with HMAC-SHA256 signatures. Protected all state-changing endpoints (notes/generate, billing/checkout, billing/portal, auth/logout). Extension updated to store and send X-CSRF-Token header. Tokens are user-bound, time-limited (24h), and validated with timing-safe comparison. |
| January 28, 2026 | **Code Review - New Findings:** Added 2 HIGH (HIGH-012: email in audit logs, HIGH-013: query timeout), 5 MEDIUM (MEDIUM-011: session count limit, MEDIUM-012: Gemini error logging, MEDIUM-013: webhook idempotency, MEDIUM-014: extension retry logic, MEDIUM-015: CORS extension origin), 2 LOW (LOW-006: magic strings, LOW-007: implicit body size limit). Body size limit downgraded from HIGH to LOW as Express defaults to 100KB - fix is for explicitness only. |
| January 28, 2026 | **Resolved HIGH-013 (Query Statement Timeout):** Added 30-second `statement_timeout` to database pool configuration. Prevents DoS attacks via long-running queries exhausting connection pool. |
| January 28, 2026 | **Resolved HIGH-003 (Content Security Policy):** Configured CSP appropriate for JSON API: `defaultSrc: 'none'` (no renderable content), `frameAncestors: 'none'` (clickjacking protection). Enabled HSTS with 1-year max-age, includeSubDomains, and preload. |
| January 28, 2026 | **HIGH-012 Accepted, MEDIUM-012 Resolved:** Marked HIGH-012 (email in failed login audit) as ACCEPTED RISK after analysis - standard security practice with low actual risk. Resolved MEDIUM-012 by implementing provider-agnostic sanitized LLM error logging that logs only status codes and error types, never raw response bodies or full error objects that could contain PHI. |
| January 28, 2026 | **Resolved HIGH-005 (Account Lockout):** Implemented database-backed progressive account lockout with timing-safe login. Thresholds: 5 failures → 15 min, 10 → 1 hour, 15 → 24 hours, 20+ → permanent. Added `lockout-service.ts` for lockout logic, migration `002_account_lockout.sql` for database columns. Auth service updated with dummy hash comparison to prevent timing attacks. New audit actions: `ACCOUNT_LOCKED`, `ACCOUNT_UNLOCKED`, `LOGIN_BLOCKED_LOCKED`. |
| January 29, 2026 | **Resolved HIGH-001 (Password Reset) + HIGH-007 (Email Verification):** Implemented complete email verification and password reset flows. Key components: (1) `token-service.ts` - 256-bit cryptographic tokens with SHA-256 storage, atomic single-use consumption; (2) `email-service.ts` - Resend integration with HTML/text templates; (3) `email-verification.ts` middleware - blocks unverified users from note generation and billing; (4) Database migration `003_email_verification.sql` - adds `email_verified`, `email_verified_at` to users, creates `email_tokens` table; (5) Rate limiting on all sensitive endpoints (3-5 requests per window); (6) Web pages for verify-email, forgot-password, reset-password, resend-verification; (7) Extension UX improvements - inline forgot password flow, verification banner with resend button, auto-polling clears banner when verified. Security properties: enumeration-safe responses, session invalidation on password reset, lockout counter reset, full audit trail. |
| January 29, 2026 | **Token Versioning for Immediate Session Invalidation:** Fixed security gap where stateless JWT access tokens remained valid up to 1 hour after password reset. Implemented token versioning: (1) Database migration `004_token_version.sql` - adds `token_version` column to users; (2) Auth service includes `tokenVersion` in JWT payload; (3) Auth middleware validates token version on every request against database; (4) Password reset increments token version, immediately invalidating all access tokens. Added `SessionAlert` component to extension for consistent logout messaging - supports multiple reasons (session_invalidated, session_expired, session_limit, session_revoked) preparing for MEDIUM-011 session limits implementation. |
| January 30, 2026 | **Reorganized Open Issues into Implementation Groups:** Analyzed remaining 17 open issues and organized into 6 logical groups based on shared code paths and dependencies: Group A (Session Infrastructure: HIGH-006, MEDIUM-002, MEDIUM-011), Group B (Extension Resilience: MEDIUM-003, MEDIUM-008, MEDIUM-014), Group C (Observability Stack: LOW-001, MEDIUM-004, MEDIUM-006), Group D (CORS Configuration: MEDIUM-007, MEDIUM-015), Group E (LLM/Prompt Security: MEDIUM-005, MEDIUM-010), Group F (CI/CD Pipeline: LOW-003, LOW-005). Added phased implementation order prioritizing the remaining HIGH severity issue. Standalone items identified for quick wins. |
| January 30, 2026 | **Resolved Group A - Session Infrastructure (HIGH-006, MEDIUM-002, MEDIUM-011):** Implemented comprehensive session security improvements. (1) HIGH-006 Device Binding: Sessions now store IP address and user agent; mismatches logged as `SESSION_DEVICE_CHANGE` warnings (lenient mode - doesn't block, since PT staff frequently change networks); (2) MEDIUM-002 O(1) Token Validation: Refresh tokens include `sessionId` in JWT payload, enabling primary key lookup instead of O(n) bcrypt loop; legacy tokens fall back gracefully; (3) MEDIUM-011 Session Limits: Max 5 sessions per user enforced, oldest deleted when exceeded, `SESSION_LIMIT_EXCEEDED` audit events logged. Migration: `006_session_device_binding.sql`. Test coverage: 27 auth-service tests. **All HIGH severity issues now resolved.** |

---

## Summary

Significant progress has been made on security remediation. All critical vulnerabilities and most HIGH severity issues have been resolved, substantially reducing the risk of credential theft, API key exposure, account takeover, and token manipulation attacks.

**Current Issue Count:**
| Severity | Open | Accepted | New (This Review) |
|----------|------|----------|-------------------|
| CRITICAL | 0 | 0 | 0 |
| HIGH | 0 | 1 | 4 |
| MEDIUM | 8 | 0 | 5 |
| LOW | 7 | 0 | 2 |

**Remaining Priority Items:**
- All HIPAA-critical audit logging issues have been resolved
- CSRF protection implemented (HIGH-002 resolved)
- Query statement timeout implemented (HIGH-013 resolved) - DoS prevention now in place
- Content Security Policy implemented (HIGH-003 resolved) - XSS defense-in-depth
- Account lockout implemented (HIGH-005 resolved) - Progressive lockout with timing-safe login
- Email verification implemented (HIGH-007 resolved) - Full verification flow with access control
- Password reset implemented (HIGH-001 resolved) - Secure token-based reset with session invalidation
- HIGH-012 (email in failed login audit) accepted as standard security practice after risk analysis
- MEDIUM-012 (LLM API error logging) resolved - errors now logged without PHI exposure risk
- Session infrastructure implemented (HIGH-006, MEDIUM-002, MEDIUM-011 resolved) - Device binding, O(1) token validation, session limits
- **All HIGH severity issues now resolved**

**Recommended Action:**
1. **Short-term:** Address remaining MEDIUM severity items (prompt injection, webhook idempotency, extension resilience)
2. **Medium-term:** Observability stack (structured logging, request ID tracing)

**Notes:**
- JSON body size limit (LOW-007) was downgraded from HIGH as Express already defaults to 100KB - the fix is about making this explicit for code clarity, not addressing an active vulnerability.
- Email in failed login audit (HIGH-012) marked as ACCEPTED RISK - standard security practice with low actual risk in this context.
- Account lockout admin unlock currently via direct database access; admin API endpoint planned for future.
- Device binding uses lenient mode (log, don't block) to avoid false positives for PT staff who frequently switch networks and devices.
- Email verification uses Resend for transactional email delivery (falls back to console logging when API key not configured).
- Extension auto-polls for verification status - banner clears automatically without logout.

---

## Future Security Enhancements

### Admin Role System and Account Management

**Priority:** Medium-term (implement before scaling support operations)
**Related Issues:** HIGH-005 (Account Lockout), MEDIUM-011 (Session Limits)
**Ticket ID:** ADMIN-001

#### Overview

As FlashNote scales, we need a proper admin system to manage user accounts without direct database access. This includes unlocking locked accounts, managing sessions, and potentially suspending accounts for policy violations.

#### Current State

- `lockoutService.unlockAccount()` function exists but has no API endpoint
- Admin operations require direct database access
- No role differentiation between users
- No admin authentication system

Currently, locked accounts can only be unlocked via direct database access:
```sql
UPDATE users
SET failed_login_attempts = 0, locked_until = NULL, last_failed_login_at = NULL
WHERE email = 'user@example.com';
```

#### Proposed Role Hierarchy

| Role | Scope | Capabilities |
|------|-------|--------------|
| **Super Admin** | System-wide | All admin actions, manage org admins, system configuration |
| **Org Admin** | Single organization | Unlock accounts, view audit logs, manage org users |
| **User** | Self | Standard user capabilities |

**Note:** Organization support is not currently implemented. Initial implementation may only need Super Admin role, with Org Admin added when multi-tenancy is introduced.

#### Required Components

**1. Database Schema Changes**
```sql
-- Admin roles table
CREATE TABLE admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'super_admin', 'org_admin'
  organization_id UUID REFERENCES organizations(id), -- NULL for super_admin
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE(user_id, role, organization_id)
);

CREATE INDEX idx_admin_roles_user ON admin_roles(user_id) WHERE revoked_at IS NULL;
```

**2. Admin Authentication**
- Option A: Separate admin login with MFA requirement
- Option B: Elevated permissions on existing accounts with MFA step-up
- Recommendation: Option B for simplicity, with mandatory MFA for admin actions

**3. Admin API Endpoints**
```
POST   /admin/users/:userId/unlock          - Unlock locked account
POST   /admin/users/:userId/sessions/revoke - Revoke all user sessions
GET    /admin/users/:userId/audit-log       - View user's audit history
GET    /admin/locked-accounts               - List all locked accounts
POST   /admin/users/:userId/suspend         - Suspend account (future)
```

**4. Authorization Middleware**
```typescript
// Example middleware
export function requireAdmin(allowedRoles: ('super_admin' | 'org_admin')[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as AuthenticatedRequest).user.userId;
    const role = await getAdminRole(userId);

    if (!role || !allowedRoles.includes(role)) {
      await auditService.log({
        userId,
        action: AuditAction.ADMIN_ACCESS_DENIED,
        status: 'FAILURE',
        metadata: { attemptedAction: req.path },
      });
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  };
}
```

**5. Audit Logging**
New audit actions needed:
- `ADMIN_ACCOUNT_UNLOCKED` - Admin unlocked a user account
- `ADMIN_SESSIONS_REVOKED` - Admin revoked user sessions
- `ADMIN_ACCOUNT_SUSPENDED` - Admin suspended an account
- `ADMIN_ACCESS_DENIED` - Unauthorized admin action attempted
- `ADMIN_ROLE_GRANTED` - Admin role assigned to user
- `ADMIN_ROLE_REVOKED` - Admin role removed from user

#### Security Considerations

| Risk | Mitigation |
|------|------------|
| Privilege escalation | Strict role validation, audit all admin actions |
| Compromised admin account | MFA required for admin actions, session monitoring |
| Social engineering | Identity verification procedures (operational), audit trail |
| Insider threat | Audit correlation, alerts on sensitive actions, principle of least privilege |
| Admin unlocks then brute forces | Alert on unlock followed by failed login attempts within 24h |

#### Implementation Phases

**Phase 1: Super Admin Only (MVP)**
- Add `is_super_admin` boolean to users table (simpler than full roles table)
- Create `/admin/users/:userId/unlock` endpoint
- Require existing auth + super admin check
- Full audit logging

**Phase 2: Admin Dashboard**
- Web-based admin interface
- View locked accounts, audit logs
- One-click unlock with reason/ticket field

**Phase 3: Org Admin Support**
- Full roles table schema
- Organization scoping
- Delegated administration

**Phase 4: Advanced Features**
- MFA step-up for admin actions
- Admin action approval workflows
- Automated alerts for suspicious patterns

#### Implementation Effort

| Phase | Effort | Trigger |
|-------|--------|---------|
| Phase 1 | 1-2 days | Support staff hired or >100 users |
| Phase 2 | 3-5 days | Regular unlock requests (>5/week) |
| Phase 3 | 1-2 weeks | Multi-tenancy / enterprise customers |
| Phase 4 | 2-3 weeks | Compliance requirements or security incident |

#### Existing Infrastructure to Leverage

- `lockoutService.unlockAccount(userId, context)` - Already implemented with audit logging
- `AuditAction.ACCOUNT_UNLOCKED` - Audit action already exists
- `SessionAlert` component - Already supports `session_revoked` reason for UI messaging

---

### Email Notification System

**Status:** IMPLEMENTED
**Related Issues:** HIGH-001 (RESOLVED), HIGH-007 (RESOLVED), Account Lockout Notifications

**Provider:** [Resend](https://resend.com)
- Modern API with excellent TypeScript SDK
- Free tier: 3,000 emails/month
- Built for transactional email (verification, password reset)
- Simple domain setup

**Implementation:** `backend/src/services/email-service.ts`
- `sendVerificationEmail(email, token)` - Email verification link
- `sendPasswordResetEmail(email, token)` - Password reset link
- Falls back to console logging when `RESEND_API_KEY` not configured (for development)

**Configuration:**
- `RESEND_API_KEY` - API key from Resend dashboard
- `EMAIL_FROM_ADDRESS` - Sender email (default: noreply@flashnote.app)
- `EMAIL_FROM_NAME` - Sender name (default: FlashNote)
- `EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS` - Token expiry (default: 24)
- `PASSWORD_RESET_TOKEN_EXPIRY_MINUTES` - Token expiry (default: 15)

**Implemented Use Cases:**
1. ~~**Password Reset** (HIGH-001)~~ - IMPLEMENTED
2. ~~**Email Verification** (HIGH-007)~~ - IMPLEMENTED

**Future Use Cases:**
1. **Account Lockout Notification** - Alert user when account is locked
2. **Security Alerts** - Login from new device/location

---

### Self-Service Account Unlock

**Priority:** Low (nice-to-have, email infrastructure now in place)
**Related Issues:** HIGH-005, HIGH-007 (RESOLVED)

Now that email verification (HIGH-007) is implemented, users could self-unlock:
1. User clicks "Unlock my account" on login page
2. System sends unlock link to verified email
3. Clicking link resets lockout counter
4. Full audit trail maintained

**Prerequisites:** ✅ All met
- ✅ Email verification implemented (HIGH-007)
- ✅ Email sending infrastructure in place

**Implementation Effort:** Low
**Trigger to Build:** When user support requests increase or support staff is limited
