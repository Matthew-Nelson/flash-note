# Code Review: auth-hardening Branch

**Reviewed:** 2026-01-29
**Reviewer:** Claude Code
**Branch:** `auth-hardening`
**Commits:** 3 (86178d6, 18abff2, 1f8e68b)
**Files Changed:** 43
**Lines Added:** ~5,400

## Overview

This PR implements email verification (HIGH-007), password reset (HIGH-001), token versioning for immediate session invalidation, and progressive account lockout (HIGH-005).

---

## High Priority Issues

### H1: SQL Template Literal Pattern in Lockout Service

**File:** `backend/src/services/lockout-service.ts:94-109`
**Status:** RESOLVED

**Problem:** The lockout service interpolated JavaScript values directly into SQL using template literals. While values came from a const array (not user input), this pattern was inconsistent with the codebase's strict parameterized query usage and could flag in security audits.

**Resolution:** Removed the dev/prod threshold split entirely. The SQL now uses static literal values that match the constant `LOCKOUT_THRESHOLDS` array. Thresholds are documented in comments above the query for maintainability.

---

### H2: Missing Index on email_tokens.token_hash

**File:** `backend/src/db/migrations/003_email_verification.sql`
**Status:** RESOLVED

**Problem:** Token validation queries filter by `token_hash` with no index, causing full table scans.

**Resolution:** Created migration `005_token_hash_index.sql` adding:
```sql
CREATE INDEX IF NOT EXISTS idx_email_tokens_token_hash ON email_tokens(token_hash);
```

---

## Medium Priority Issues

### M1: Email Logged in Audit Metadata

**File:** `backend/src/routes/auth.ts:117`

**Problem:** Failed login audit logs include the user's email:

```typescript
await auditService.log({
  userId: null,
  action: AuditAction.LOGIN_FAILED,
  metadata: { email },  // PII logged
  ...
});
```

While email isn't PHI, it is PII. Other audit logs avoid logging identifiable data directly.

**Recommendation:** Either hash the email, omit it, or document as intentional for security monitoring purposes.

---

### M2: Development Lockout Thresholds Too Permissive

**File:** `backend/src/services/lockout-service.ts:12-17`
**Status:** RESOLVED (with H1)

**Problem:** Development thresholds were 10x production values, meaning lockout behavior was never exercised during normal development.

**Resolution:** Removed the dev/prod threshold split. All environments now use production thresholds (5/10/15/20 attempts). This ensures consistent security behavior and proper testing of lockout functionality. An admin unlock system is documented for future implementation when needed (see SECURITY_AUDIT.md "Admin Role System and Account Management").

---

### M3: No Rate Limit on /auth/verify-email

**File:** `backend/src/routes/auth.ts:189`
**Status:** RESOLVED

**Problem:** The `/auth/verify-email` endpoint had no rate limiting.

**Resolution:** Added `verificationCompleteRateLimit` (10 attempts per 15 minutes per IP in production). This provides defense-in-depth against token brute force attempts, even though 256-bit token entropy makes such attacks infeasible.

---

### M4: Reset Token Validation Uses GET with Query Params

**File:** `backend/src/routes/auth.ts:318`

**Problem:** Token validation endpoint uses GET:

```typescript
authRouter.get('/validate-reset-token', async (req, res, next) => {
  const { token } = validateResetTokenSchema.parse(req.query);
```

Tokens in GET query params appear in:
- Server access logs
- Browser history
- Referrer headers

**Recommendation:** Consider POST for token validation, or document the tradeoff (better UX/caching vs. token exposure in logs).

---

## Low Priority Issues

### L1: Duplicate BCRYPT_ROUNDS Constant

**Files:**
- `backend/src/services/auth-service.ts:13`
- `backend/src/routes/auth.ts:71`

**Status:** RESOLVED

Both files defined `const BCRYPT_ROUNDS = 12`.

**Resolution:** Extracted to `backend/src/config.ts` as an exported constant with security documentation explaining the choice of 12 rounds.

---

### L2: Email Service Logs Full Content in Development

**File:** `backend/src/services/email-service.ts:136-143`
**Status:** ACCEPTED TECH DEBT

```typescript
console.log(`To: ${to}`);
console.log(`Subject: ${subject}`);
console.log(text);  // Contains verification/reset URLs with tokens
```

Tokens appear in console logs during development.

**Rationale for Acceptance:**
- Only occurs when `RESEND_API_KEY` is not configured (development only)
- Useful for local development and testing email flows
- No risk in production (Resend API is used, no console logging)
- Fix would require a separate development email viewer or log redaction

**Future Consideration:** If shared development environments are used, consider:
- Redacting tokens from console output
- Using a local email viewer like Mailhog
- Adding a config flag to suppress email content logging

---

### L3: No Scheduled Token Cleanup

**File:** `backend/src/services/token-service.ts:166-174`
**Status:** ACCEPTED TECH DEBT

`cleanupExpiredTokens()` exists but is never called. Tokens accumulate indefinitely.

**Rationale for Deferral:**
- Low immediate impact (tokens are small, table growth is slow)
- Function already implemented, just needs scheduling
- Can be addressed when setting up production infrastructure

**Future Implementation:**
- Add cron job or platform scheduler to call cleanup daily
- Create admin endpoint: `POST /admin/cleanup-tokens`
- Consider pg_cron extension for database-level scheduling

---

### L4: Frontend Password Validation Duplicated

Password validation rules exist in:
- `backend/src/routes/auth.ts:28-33` (Zod schema)
- `web/src/app/reset-password/page.tsx:46-61` (inline JS)
- `extension/src/shared/schemas.ts`

**Status:** DOCUMENTED

Rules must be kept in sync manually.

**Resolution:** Documented backend as source of truth in `CLAUDE.md` under "Password Policy". Lists all files that must be updated when password policy changes.

---

### L5: Extension API Error Handling Order

**File:** `extension/src/shared/api.ts:104-110`
**Status:** RESOLVED

If `storage.clearAuth()` throws, the `AUTH_INVALIDATED_EVENT` wouldn't fire.

**Resolution:** Reordered operations to dispatch the event first (ensuring UI updates), then clear storage with try-catch (non-critical if it fails since user sees login prompt anyway).

---

### L6: Test Setup Doesn't Centralize Config Mocking

**File:** `backend/src/test/setup.ts`
**Status:** RESOLVED

Config was mocked separately in each test file.

**Resolution:** Added `TEST_CONFIG_DEFAULTS` to `backend/src/test/setup.ts` with standard test values. Updated existing tests to use these defaults. Added documentation explaining when to mock config vs use real values.

---

## Security Strengths (No Action Required)

1. **Atomic token operations** - `validateAndConsumeToken` prevents race conditions
2. **Timing-safe password comparison** - Dummy hash comparison prevents timing attacks
3. **Token versioning** - Immediate session invalidation on password reset
4. **No PHI in logs/errors** - Carefully sanitized output
5. **Atomic lockout** - Single query prevents race conditions
6. **Comprehensive audit logging** - All security events tracked
7. **Algorithm pinning** - JWT verification specifies `['HS256']`
8. **Email enumeration prevention** - Constant success responses

---

## Test Coverage Gaps

- Auth routes integration tests
- Email service unit tests
- Password reset end-to-end flow
- Frontend component tests

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | - |
| High | 2 | 2 resolved (H1, H2) |
| Medium | 4 | 2 resolved (M2, M3), 2 accepted (M1, M4) |
| Low | 6 | 6 resolved/documented (L1, L2, L3, L4, L5, L6) |

**All issues addressed.** This PR is ready for merge.

## Change Log

| Date | Changes |
|------|---------|
| 2026-01-29 | Initial review |
| 2026-01-29 | Resolved H1 (SQL template literals) and M2 (dev thresholds) by using static production thresholds. Added admin role system roadmap to SECURITY_AUDIT.md. |
| 2026-01-29 | Resolved M3 (added rate limiting to verify-email), L1 (extracted BCRYPT_ROUNDS to config), L2 (documented as accepted tech debt), L6 (centralized test config defaults). |
| 2026-01-29 | Resolved H2 (added token_hash index via migration 005). Resolved L5 (fixed extension error handling order). Documented L3 (token cleanup) as tech debt, L4 (password validation) in CLAUDE.md. Accepted M1, M4 as-is after discussion. |
