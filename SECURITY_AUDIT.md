# FlashNote Security Audit Report

**Date:** January 2026 (Updated January 27, 2026)
**Auditor:** Security Review
**Scope:** Full codebase audit (backend, extension, web)
**Classification:** HIPAA-regulated healthcare application

---

## Executive Summary

This audit was originally conducted in January 2026 and identified **4 critical**, **9 high**, **8 medium**, and **5 low** severity security issues. This document has been updated to reflect the current remediation status and new findings based on updated HIPAA compliance standards.

### Current Status

| Severity | Original | Resolved | Open | New Issues |
|----------|----------|----------|------|------------|
| CRITICAL | 4 | 4 | 0 | 0 |
| HIGH | 9 | 4 | 6 | 1 |
| MEDIUM | 8 | 1 | 7 | 2 |
| LOW | 5 | 0 | 5 | 0 |

### Overall Risk Assessment: **MEDIUM** (improved from HIGH)

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
**Status:** OPEN
**Severity:** HIGH
**CVSS:** 6.5

**Risk:** Healthcare workers locked out of their accounts cannot recover access. This could:
- Delay critical patient documentation
- Force workarounds that bypass security
- Result in HIPAA violations if users share credentials

**Fix:** Implement secure password reset flow with:
- Email verification
- Time-limited tokens (15 minutes)
- Audit logging of reset attempts

---

### HIGH-002: Missing CSRF Protection
**Status:** OPEN
**File:** `backend/src/index.ts`
**Severity:** HIGH
**CVSS:** 6.5

No CSRF tokens are implemented for state-changing operations.

**Risk:** Attackers could trick authenticated users into performing unwanted actions via malicious websites.

**Fix:** Implement CSRF protection using `csurf` middleware or SameSite cookies with Strict mode.

---

### HIGH-003: No Content Security Policy
**Status:** OPEN
**File:** `backend/src/index.ts:14`
**Severity:** HIGH
**CVSS:** 6.1

Helmet is enabled but CSP is not configured.

**Risk:** XSS attacks could execute arbitrary JavaScript, potentially stealing tokens or PHI.

**Fix:** Configure strict CSP headers in Helmet configuration:
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", config.API_URL],
    },
  },
}));
```

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
**Status:** OPEN
**File:** `backend/src/middleware/rate-limit.ts`
**Severity:** HIGH
**CVSS:** 5.9

Rate limiting resets after the window. There's no permanent lockout after repeated failures.

**Risk:** Persistent attackers can continue attempts indefinitely by waiting between windows.

**Fix:** Implement progressive lockout:
- After 5 failures: 15-minute cooldown
- After 10 failures: 1-hour cooldown
- After 20 failures: Account locked, requires admin unlock

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
**Status:** OPEN
**File:** `backend/src/routes/auth.ts`
**Severity:** HIGH
**CVSS:** 5.3

Users can register with any email without verification.

**Risk:**
- Account takeover via typo-squatting
- Spam accounts
- No way to verify identity for password resets

**Fix:** Implement email verification flow before allowing full access.

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
**Status:** OPEN
**Files:** `backend/src/middleware/auth.ts:14-18,31-34`, `backend/src/middleware/subscription.ts`
**Severity:** HIGH
**CVSS:** 5.0

Authorization failures return error responses but are NOT logged to the audit system:
- Missing token (401)
- Invalid/expired token (401)
- Subscription expired (403)
- Trial ended (403)

**Risk:** HIPAA violation - incomplete audit trail. Cannot detect:
- Brute force attempts
- Compromised token usage
- Unauthorized access patterns

**HIPAA Requirement Violated:** "Log ALL authorization failures (access denied events)"

**Fix:** Add audit logging to auth middleware:
```typescript
if (!authHeader?.startsWith('Bearer ')) {
  await auditService.log({
    userId: null,
    action: AuditAction.AUTH_FAILED,
    status: 'FAILURE',
    metadata: { reason: 'missing_token' },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  // ... return 401
}
```

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
**Status:** OPEN
**File:** `backend/src/routes/notes.ts:60-62`
**Severity:** MEDIUM

Only successful note generations are logged to the audit system (lines 40-51). Failed attempts pass through `next(error)` without audit logging.

**Risk:** Incomplete audit trail - cannot track:
- Failed generation attempts (potential abuse)
- Error patterns that may indicate attacks
- Usage anomalies

**HIPAA Requirement Violated:** "Log note generation metadata (timestamp, user ID, success/failure)"

**Fix:** Add audit logging in catch block:
```typescript
} catch (error) {
  await auditService.log({
    userId,
    action: AuditAction.NOTE_GENERATED,
    status: 'FAILURE',
    metadata: { noteType, error: error instanceof Error ? error.message : 'Unknown' },
    ipAddress,
    userAgent,
  });
  next(error);
}
```

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

## Compliance Checklist (HIPAA)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Access Controls | PARTIAL | Missing MFA, account lockout |
| Audit Controls | PARTIAL | Auth failures and generation failures not logged (HIGH-011, MEDIUM-009) |
| Transmission Security | PASS | TLS enforced |
| PHI Storage | PASS | No PHI stored; patient context kept in memory only (HIGH-010 resolved) |
| Unique User IDs | PASS | UUID-based |
| Automatic Logoff | FAIL | No session timeout warning |
| Encryption | PARTIAL | Tokens not encrypted at rest |
| Password Management | PARTIAL | No password reset functionality |

---

## Recommended Remediation Priority

### Immediate (HIPAA Critical)
1. **HIGH-011:** Audit authorization failures - *HIPAA audit requirement*
2. **MEDIUM-009:** Audit note generation failures - *HIPAA audit requirement*

### Before Production
1. **HIGH-002:** CSRF protection
2. **HIGH-003:** Content Security Policy
3. **HIGH-005:** Account lockout mechanism

### Short-term
1. **HIGH-001 + HIGH-007:** Password reset + email verification (build together)
2. **HIGH-006:** Device binding for refresh tokens
3. **MEDIUM-005:** Prompt injection protection

### Medium-term
1. **MEDIUM-002:** Efficient refresh token validation
2. **MEDIUM-003:** Session timeout warning
3. **MEDIUM-006:** Request ID tracing
4. **LOW-001:** Structured logging

### Ongoing
1. **LOW-003:** Test coverage
2. **LOW-005:** Dependency scanning in CI
3. Security testing automation
4. Penetration testing

---

## Change Log

| Date | Changes |
|------|---------|
| January 2026 | Initial audit completed |
| January 27, 2026 | Updated to reflect remediation status. Marked CRITICAL-001 through CRITICAL-004 as RESOLVED. Marked HIGH-004, HIGH-008, HIGH-009, MEDIUM-001 as RESOLVED. Added HIGH-010, HIGH-011, MEDIUM-009, MEDIUM-010 based on updated HIPAA compliance standards. Updated risk assessment from HIGH to MEDIUM. |
| January 27, 2026 | HIGH-010 RESOLVED: Removed `lastUsedPatientContext` field from extension storage schema to prevent PHI persistence. |

---

## Summary

Significant progress has been made on security remediation. All critical vulnerabilities have been resolved, substantially reducing the risk of credential theft, API key exposure, and token manipulation attacks.

**Remaining Priority Items:**
- 2 HIPAA audit logging issues require immediate attention (HIGH-011, MEDIUM-009)
- 6 original HIGH severity issues remain open (access controls, CSRF, CSP)
- Production deployment should wait until HIGH-011 and MEDIUM-009 are resolved

**Recommended Action:** Address the HIPAA audit logging gaps (HIGH-011, MEDIUM-009) immediately. These are compliance requirements, not optional hardening. Then proceed with remaining HIGH severity items before production deployment.
