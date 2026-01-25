# FlashNote Security Audit Report

**Date:** January 2026
**Auditor:** Security Review
**Scope:** Full codebase audit (backend, extension, web)
**Classification:** HIPAA-regulated healthcare application

---

## Executive Summary

This audit identified **4 critical**, **9 high**, **8 medium**, and **5 low** severity security issues. Given this is a healthcare application handling PHI (Protected Health Information), all critical and high issues should be addressed before production deployment.

### Overall Risk Assessment: **HIGH**

The codebase demonstrates good security fundamentals (parameterized queries, bcrypt hashing, JWT tokens, input validation), but several critical gaps exist that could lead to data breaches or HIPAA violations.

---

## Critical Findings

### CRITICAL-001: Credential Logging in Web App
**File:** `web/src/app/login/page.tsx:19`
**Severity:** CRITICAL
**CVSS:** 9.1

```typescript
// LINE 19 - LOGS CREDENTIALS TO CONSOLE
console.log('Login:', { email, password });
```

**Risk:** User passwords are logged to the browser console. In production, this could be captured by browser extensions, error monitoring tools, or if console logs are forwarded to a logging service.

**Fix:** Remove this line immediately.

---

### CRITICAL-002: No Rate Limiting on Token Refresh Endpoint
**File:** `backend/src/routes/auth.ts:93`
**Severity:** CRITICAL
**CVSS:** 8.6

The `/auth/refresh` endpoint has no rate limiting, unlike login and register endpoints.

**Risk:**
- Attackers can enumerate valid refresh tokens
- DoS attacks can exhaust database connections
- Brute force attacks on refresh tokens

**Fix:** Add `refreshRateLimit` middleware to the endpoint.

---

### CRITICAL-003: JWT Algorithm Not Specified in Verification
**File:** `backend/src/middleware/auth.ts:24`
**Severity:** CRITICAL
**CVSS:** 9.8

```typescript
const payload = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
```

**Risk:** Without specifying the expected algorithm, the server is vulnerable to algorithm confusion attacks. An attacker could craft a token using the `none` algorithm or switch from RS256 to HS256.

**Fix:** Explicitly specify the algorithm:
```typescript
jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] })
```

---

### CRITICAL-004: API Key Exposed in URL Parameter
**File:** `backend/src/services/ai-service.ts:72`
**Severity:** CRITICAL
**CVSS:** 8.2

```typescript
const url = `${this.apiUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
```

**Risk:** API keys in URLs are logged by:
- Web server access logs
- Proxy servers
- Browser history (if client-side)
- Network monitoring tools

**Fix:** Move API key to request header:
```typescript
headers: {
  'Content-Type': 'application/json',
  'x-goog-api-key': this.apiKey,
}
```

---

## High Severity Findings

### HIGH-001: No Password Reset Functionality
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
**File:** `backend/src/index.ts`
**Severity:** HIGH
**CVSS:** 6.5

No CSRF tokens are implemented for state-changing operations.

**Risk:** Attackers could trick authenticated users into performing unwanted actions via malicious websites.

**Fix:** Implement CSRF protection using `csurf` middleware or SameSite cookies.

---

### HIGH-003: No Content Security Policy
**File:** `backend/src/index.ts:14`
**Severity:** HIGH
**CVSS:** 6.1

Helmet is enabled but CSP is not configured.

**Risk:** XSS attacks could execute arbitrary JavaScript, potentially stealing tokens or PHI.

**Fix:** Configure strict CSP headers in Helmet configuration.

---

### HIGH-004: Stripe Webhook Content-Type Mismatch
**File:** `web/src/app/api/webhooks/stripe/route.ts:22-24`
**Severity:** HIGH
**CVSS:** 7.4

```typescript
headers: {
  'Content-Type': 'application/json',  // WRONG - should be raw
  'Stripe-Signature': signature,
},
body,  // This is raw text
```

**Risk:** The webhook signature verification may fail intermittently or be bypassed because the Content-Type doesn't match the body format.

**Fix:** Remove the Content-Type header or send as raw body.

---

### HIGH-005: No Account Lockout Mechanism
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
**File:** `backend/src/services/auth-service.ts`
**Severity:** HIGH
**CVSS:** 6.8

Refresh tokens can be used from any device/IP without validation.

**Risk:** Stolen refresh tokens can be used by attackers from different locations.

**Fix:** Store device fingerprint and/or IP with refresh token, validate on refresh.

---

### HIGH-007: No Email Verification
**File:** `backend/src/routes/auth.ts`
**Severity:** HIGH
**CVSS:** 5.3

Users can register with any email without verification.

**Risk:**
- Account takeover via typo-squatting
- Spam accounts
- No way to verify identity for password resets

**Fix:** Implement email verification flow before allowing login.

---

### HIGH-008: Mock AI Can Be Enabled in Production
**File:** `backend/src/config.ts:27-30`
**Severity:** HIGH
**CVSS:** 5.4

```typescript
USE_MOCK_AI: z
  .string()
  .transform((val) => val === 'true')
  .default('false'),
```

**Risk:** If accidentally set in production, users receive fake clinical notes that could harm patients.

**Fix:** Throw error if `USE_MOCK_AI=true` in production environment.

---

### HIGH-009: Audit Logs Missing User-Agent
**File:** `backend/src/services/audit-service.ts:8`
**Severity:** HIGH
**CVSS:** 4.3

The database schema includes `user_agent` column but it's never populated.

**Risk:** Incomplete audit trail for HIPAA compliance. Cannot detect compromised accounts accessing from unusual browsers.

**Fix:** Pass user-agent from request headers to audit service.

---

## Medium Severity Findings

### MEDIUM-001: TypeScript Type Assertion Bypasses Type Safety
**File:** `backend/src/routes/notes.ts:15`
**Severity:** MEDIUM

```typescript
notesRouter.use(requireActiveSubscription as any);
```

**Risk:** The `as any` cast hides potential type errors that could lead to runtime failures.

**Fix:** Fix the type definition for the middleware.

---

### MEDIUM-002: Inefficient Refresh Token Validation
**File:** `backend/src/services/auth-service.ts:138-151`
**Severity:** MEDIUM

```typescript
for (const row of result.rows) {
  if (await bcrypt.compare(refreshToken, row.refresh_token_hash)) {
    return true;
  }
}
```

**Risk:** O(n) bcrypt comparisons per refresh. With many sessions, this could cause:
- DoS via resource exhaustion
- Slow response times

**Fix:** Store a token identifier (first 8 chars of hash) for quick lookup, then verify full hash.

---

### MEDIUM-003: No Session Timeout Warning
**Severity:** MEDIUM

Users aren't warned before token expiration.

**Risk:** Lost work if session expires mid-documentation.

**Fix:** Implement client-side countdown and auto-refresh before expiry.

---

### MEDIUM-004: Database Connection Errors Not Handled
**File:** `backend/src/db/index.ts:18-19`
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
**File:** `backend/src/prompts/pt-prompts.ts:100-128`
**Severity:** MEDIUM

User input (`quickNotes`, `patientContext`) is directly concatenated into prompts without sanitization.

**Risk:** Malicious users could inject prompt instructions to:
- Extract system prompts
- Generate inappropriate content
- Bypass safety guidelines

**Fix:** Implement input sanitization and prompt injection detection.

---

### MEDIUM-006: No Request ID for Tracing
**Severity:** MEDIUM

No request ID is generated for log correlation.

**Risk:** Difficult to trace issues across services for debugging and audit purposes.

**Fix:** Add `x-request-id` header generation middleware.

---

### MEDIUM-007: CORS Allows Development Origins
**File:** `backend/src/index.ts:15-19`
**Severity:** MEDIUM

```typescript
origin: config.NODE_ENV === 'production'
  ? [config.WEB_URL]
  : ['http://localhost:3000', 'http://localhost:5173'],
```

**Risk:** In staging/test environments that aren't "production", CORS is permissive.

**Fix:** Use explicit environment checks or whitelist approach.

---

### MEDIUM-008: Extension Stores Both Tokens Together
**File:** `extension/src/shared/storage.ts`
**Severity:** MEDIUM

Access and refresh tokens stored in the same storage object.

**Risk:** If storage is compromised, attacker gets both tokens.

**Fix:** Consider storing refresh token more securely or implementing additional encryption.

---

## Low Severity Findings

### LOW-001: Console Logging in Production
**Severity:** LOW

Multiple `console.log` and `console.error` statements throughout codebase.

**Fix:** Implement structured logging with a library like `pino` or `winston`.

---

### LOW-002: No Health Check Authentication
**File:** `backend/src/routes/health.ts`
**Severity:** LOW

Health endpoint is public.

**Risk:** Information disclosure about service status.

**Fix:** Consider adding basic auth or IP restrictions for health endpoints.

---

### LOW-003: Missing Test Coverage
**Severity:** LOW

No test files found in the codebase.

**Risk:** Regressions and security issues may not be caught.

**Fix:** Implement comprehensive test suite covering security-critical paths.

---

### LOW-004: No Security Headers for Extension
**File:** `extension/public/manifest.json`
**Severity:** LOW

No Content Security Policy defined for extension.

**Fix:** Add CSP to manifest.json.

---

### LOW-005: Dependency Audit Required
**Severity:** LOW

No automated dependency vulnerability scanning configured.

**Fix:** Add `npm audit` or `snyk` to CI pipeline.

---

## Compliance Checklist (HIPAA)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Access Controls | PARTIAL | Missing MFA, account lockout |
| Audit Controls | PARTIAL | Missing user-agent, incomplete events |
| Transmission Security | PASS | TLS enforced |
| PHI Storage | PASS | No PHI stored |
| Unique User IDs | PASS | UUID-based |
| Automatic Logoff | FAIL | No session timeout |
| Encryption | PARTIAL | Tokens not encrypted at rest |

---

## Recommended Remediation Priority

### Immediate (Before Production)
1. CRITICAL-001: Remove credential logging
2. CRITICAL-002: Add refresh rate limiting
3. CRITICAL-003: Specify JWT algorithm
4. CRITICAL-004: Move API key to header
5. HIGH-008: Block mock AI in production

### Short-term (Within 2 Weeks)
1. HIGH-001: Password reset flow
2. HIGH-002: CSRF protection
3. HIGH-003: Content Security Policy
4. HIGH-004: Fix Stripe webhook
5. HIGH-007: Email verification

### Medium-term (Within 1 Month)
1. HIGH-005: Account lockout
2. HIGH-006: Device binding
3. HIGH-009: Complete audit logging
4. All MEDIUM issues

### Ongoing
1. Security testing automation
2. Dependency updates
3. Penetration testing
4. Security training

---

## Summary

This codebase has solid foundational security practices but requires significant hardening before handling real patient data. The critical issues identified could lead to credential theft, unauthorized access, or HIPAA violations.

**Recommended Action:** Address all CRITICAL and HIGH issues before any production deployment. Consider engaging a third-party security firm for penetration testing after remediation.
