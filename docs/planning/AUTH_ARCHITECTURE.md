# Auth Architecture: Closing the Gap

**Status:** Planning
**Last Updated:** 2026-02-15
**Related:**
- [CLERK_ANALYSIS.md](./CLERK_ANALYSIS.md) — Why we're not adopting Clerk
- [OAUTH_ANALYSIS.md](./OAUTH_ANALYSIS.md) — Google OAuth implementation plan
- [HIPAA_SECURITY_REQUIREMENTS_2026.md](../compliance/HIPAA_SECURITY_REQUIREMENTS_2026.md) — Regulatory requirements driving this work

---

## Context

We evaluated Clerk and concluded it's not the right move ([CLERK_ANALYSIS.md](./CLERK_ANALYSIS.md)). Our custom JWT system is mature, HIPAA-compliant, and costs $0. But Clerk exposed gaps between what we have and what a production healthcare auth system needs.

This document defines what we need to build to close those gaps while keeping auth in-house.

---

## Table of Contents

1. [The Gaps](#the-gaps)
2. [httpOnly Cookie Auth (Bridge + Persistence)](#1-httponly-cookie-auth)
3. [TOTP Multi-Factor Authentication](#2-totp-multi-factor-authentication)
4. [Session Idle Timeout](#3-session-idle-timeout)
5. [Missing UI Components](#4-missing-ui-components)
6. [HIPAA Compliance Gaps](#5-hipaa-compliance-gaps-beyond-auth)
7. [Researching HIPAA Yourself](#6-researching-hipaa-yourself)

---

## The Gaps

| Gap | What Clerk Would Give Us | What We'll Build | Priority |
|-----|--------------------------|------------------|----------|
| Auth bridge (extension ↔ web) | Sync Host SDK | httpOnly cookie shared auth | P0 |
| Session persistence | Automatic background refresh | Cookie-based refresh tokens | P0 |
| MFA | SMS, TOTP, hardware keys | TOTP with recovery codes | P0 (HIPAA NPRM) |
| Session idle timeout | Built-in | Client-side activity tracking | P0 (HIPAA NPRM) |
| Social login | Google, Apple, Microsoft | Google OAuth (per OAUTH_ANALYSIS) | P1 |
| Change password in-session | Built-in settings widget | Custom settings UI | P2 |
| Active session management | Device tracking dashboard | Sessions list with revoke | P2 |
| Account deletion | Self-service | Self-service with audit trail | P2 |

---

## 1. httpOnly Cookie Auth

**This single change solves two problems:** the extension ↔ web auth bridge AND session persistence across tab closes.

### Current State (Broken)

- **Web app** stores refresh token in `sessionStorage` → dies on tab close → 7-day token lifetime is wasted
- **Extension** stores tokens in `chrome.storage.local` → persists correctly, but no connection to web session
- **No shared state** → user must log in separately to web and extension

### Target State

| Token | Storage | Lifetime | Access |
|-------|---------|----------|--------|
| Access token | JS memory (module variable) | 1 hour | Both web + extension |
| Refresh token | `httpOnly; Secure; SameSite=Lax` cookie on API domain | 7 days (persistent) or session (no "Remember me") | Browser sends automatically; extension reads via `chrome.cookies.get()` |
| CSRF token | JS memory | Per-session | Both web + extension |

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     api.flashnote.co                         │
│                                                              │
│  POST /auth/login                                            │
│    → Response body: { accessToken, csrfToken, user }         │
│    → Set-Cookie: refresh_token=<token>; HttpOnly; Secure;    │
│                  SameSite=Lax; Path=/auth; Max-Age=604800    │
│                                                              │
│  POST /auth/refresh                                          │
│    → Cookie: refresh_token=<token>  (browser sends auto)     │
│    → Response body: { accessToken, csrfToken }               │
│    → Set-Cookie: refresh_token=<new_token>; ...              │
│                                                              │
│  POST /auth/logout                                           │
│    → Set-Cookie: refresh_token=; Max-Age=0  (clears cookie)  │
└─────────────────────────────────────────────────────────────┘

Web App (flashnote.co):
  - fetch('/auth/refresh', { credentials: 'include' })
  - Browser automatically sends the cookie
  - On tab open/reload → silent refresh → get access token → user is logged in

Extension:
  - chrome.cookies.get({ url: 'https://api.flashnote.co', name: 'refresh_token' })
  - Falls back to chrome.storage.local if cookie unavailable
  - Sends refresh token in request body (extension can't rely on cookie auto-send for cross-origin)

Shared Session:
  - Login in web → cookie set → extension reads cookie → both logged in
  - Login in extension → API sets cookie → web reads cookie on next load → both logged in
  - Logout anywhere → cookie cleared → both logged out
```

### Backend Changes

1. **`POST /auth/login`** — Set `refresh_token` as httpOnly cookie in addition to response body
2. **`POST /auth/refresh`** — Accept refresh token from cookie OR request body (extension fallback)
3. **`POST /auth/logout`** — Clear the cookie (`Max-Age=0`)
4. **`POST /auth/register`** — Same cookie behavior as login
5. **CORS** — Add `credentials: true` for web app origin
6. **Cookie options:**
   ```
   HttpOnly: true        // JS can't read it (XSS protection)
   Secure: true          // HTTPS only
   SameSite: 'Lax'       // Sent on top-level navigations + same-site requests
   Path: '/auth'         // Only sent to auth endpoints (not every API call)
   Domain: api.flashnote.co
   Max-Age: 604800       // 7 days (or omit for session cookie when no "Remember me")
   ```

### Web App Changes

1. **Remove `sessionStorage` usage for tokens** — access token goes in a module-level variable
2. **On page load / new tab** — call `/auth/refresh` with `credentials: 'include'` → get access token silently
3. **Add "Remember me" checkbox** to login form:
   - Checked (default): backend sets persistent cookie (7 days)
   - Unchecked: backend sets session cookie (cleared on browser close)
4. **Update `web/src/lib/api.ts`** — add `credentials: 'include'` to auth-related fetch calls

### Extension Changes

1. **Add `"cookies"` permission** to `manifest.json` for `api.flashnote.co`
2. **On extension open** — try `chrome.cookies.get()` first, fall back to `chrome.storage.local`
3. **Update `extension/src/shared/api.ts`** — send refresh token in body (extension can't rely on auto cookie send for cross-origin)
4. **Keep `chrome.storage.local` as fallback** for access token caching between popup opens

### Security Analysis

This is **more secure** than the current implementation:

| Property | Current (sessionStorage) | Proposed (httpOnly cookie) |
|----------|--------------------------|----------------------------|
| XSS access to refresh token | Yes (JS can read sessionStorage) | No (httpOnly blocks JS access) |
| CSRF risk | N/A (no cookies) | Mitigated by existing CSRF token + SameSite=Lax |
| Survives tab close | No | Yes (persistent) or No (session cookie) |
| Cross-client sync | No | Yes |

---

## 2. TOTP Multi-Factor Authentication

### Why Now

The 2025 HIPAA Security Rule NPRM eliminates "addressable" safeguards — MFA becomes **mandatory** for all systems accessing ePHI. Expected final rule May 2026, compliance deadline ~November 2026. Even if delayed, MFA is the single strongest protection against credential compromise.

### Approach: TOTP Only (No SMS)

- **TOTP** (Time-based One-Time Password) via authenticator apps
- **No SMS** — vulnerable to SIM swapping, not recommended for HIPAA
- **No WebAuthn/FIDO2 yet** — can add later as enhancement
- **Library:** `otplib` — TypeScript-native, security-audited, zero dependencies

### How TOTP Works

```
TOTP = Truncate(HMAC-SHA1(shared_secret, floor(unix_time / 30))) mod 10^6
```

- Server generates a random shared secret during enrollment
- Secret encoded as QR code URI: `otpauth://totp/FlashNote:user@email?secret=...&issuer=FlashNote`
- User scans QR with authenticator app (Google Authenticator, Microsoft Authenticator, 1Password)
- Both server and app independently compute the same 6-digit code every 30 seconds
- Server validates with ±1 time step window (90s total) for clock drift

### Database Changes

```sql
-- Migration: add_mfa_totp.sql

-- MFA state on users table
ALTER TABLE users ADD COLUMN mfa_totp_secret VARCHAR(64);          -- encrypted Base32 secret
ALTER TABLE users ADD COLUMN mfa_totp_enabled BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE users ADD COLUMN mfa_totp_enrolled_at TIMESTAMPTZ;

-- Single-use recovery codes (10 per user)
CREATE TABLE mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(255) NOT NULL,    -- bcrypt hash
  used_at TIMESTAMPTZ,                -- NULL = unused
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recovery_codes_user ON mfa_recovery_codes(user_id);
CREATE INDEX idx_recovery_codes_unused ON mfa_recovery_codes(user_id, used_at) WHERE used_at IS NULL;
```

**Important:** `mfa_totp_secret` must be encrypted at rest (application-level encryption with a key from environment, or `pgcrypto`). The raw secret is equivalent to a password — if the database is breached, an attacker with the unencrypted secret can generate valid TOTP codes.

### API Endpoints

| Endpoint | Auth | CSRF | Purpose |
|----------|------|------|---------|
| `POST /auth/mfa/enroll` | Required | Required | Generate secret + QR URI + 10 recovery codes |
| `POST /auth/mfa/verify-enrollment` | Required | Required | Verify first TOTP code, enable MFA |
| `GET /auth/mfa/status` | Required | — | Check if enabled, recovery codes remaining |
| `POST /auth/mfa/disable` | Required | Required | Requires password + TOTP. Clears secret + codes |
| `POST /auth/mfa/regenerate-recovery-codes` | Required | Required | Requires TOTP. Returns 10 new codes |
| `POST /auth/login` (modified) | — | — | Returns `mfa_required` error if MFA enabled; accepts optional `mfaCode` |
| `POST /auth/login/recovery` | — | — | Login with recovery code instead of TOTP |

### Login Flow (with MFA)

```
User enters email + password
         │
         ▼
  Server validates credentials
         │
         ▼
  MFA enabled? ──── No ───► Issue tokens (existing flow)
         │
        Yes
         │
         ▼
  mfaCode provided? ──── No ───► Return { error: { code: 'mfa_required' } }
         │                                    │
        Yes                                   ▼
         │                        Client shows TOTP input
         ▼                        User enters 6-digit code
  Verify TOTP code                Client re-submits with mfaCode
         │
    Valid? ──── No ───► Log attempt, check rate limit, return error
         │
        Yes
         │
         ▼
  Issue tokens (existing flow)
```

### Recovery Codes

- **10 codes** generated during enrollment, format: `XXXX-XXXX-XXXX` (12 hex chars)
- **bcrypt-hashed** before storage (same as passwords)
- **Single-use** — marked with `used_at` timestamp after consumption
- **Shown once** — only displayed at enrollment and regeneration, never retrievable
- User must confirm they've saved codes before enrollment completes
- **Email notification** sent when a recovery code is used (security alert)
- When all codes are exhausted → user must contact support for manual identity verification

### Rate Limiting

| Action | Limit | Window | Why |
|--------|-------|--------|-----|
| TOTP verification | 5 failed attempts | 15 minutes | 6-digit code = 1M combinations. 5/15min → brute force takes ~6 years |
| Recovery code attempts | 3 failed attempts | 15 minutes | Fewer codes exist, tighter limit |
| Account lockout | 10 total failed MFA attempts | 24 hours | Lock account, email user, require email verification to unlock |

### Audit Events

All MFA actions get audit log entries (same transaction as the action per Rule 9):
- `MFA_ENROLLMENT_STARTED`, `MFA_ENABLED`, `MFA_DISABLED`
- `MFA_VERIFICATION_SUCCESS`, `MFA_VERIFICATION_FAILED`
- `MFA_RECOVERY_CODE_USED`
- `MFA_RECOVERY_CODES_REGENERATED`
- `MFA_ACCOUNT_LOCKED`

**Never log:** TOTP codes, recovery codes (plaintext or hashed), authenticator app names, QR code contents.

### Recommended Authenticator Apps (for user documentation)

1. **Microsoft Authenticator** — most clinicians already use Microsoft 365
2. **Google Authenticator** — simple, free, widely known
3. **1Password / Bitwarden** — for users who already use a password manager

---

## 3. Session Idle Timeout

### HIPAA Requirement

§164.312(a)(2)(iii) — Automatic Logoff. Currently "addressable," will become **required** under the NPRM. EHR systems like Epic MyChart use 15-minute timeouts. We should match that standard.

### Implementation

**Timeout:** 15 minutes of inactivity.

**Activity signals:** Mouse movement, keyboard input, touch events, scroll, focus/blur.

**Flow:**
1. Track `lastActivityTimestamp` in a module variable (NOT in storage — no PHI leakage risk)
2. Check every 60 seconds against the 15-minute threshold
3. At 13 minutes idle → show warning modal: "Your session will expire in 2 minutes due to inactivity"
4. Modal has "Stay Logged In" button (resets timer) and countdown
5. At 15 minutes → auto-logout:
   - Clear access token from memory
   - Clear all PHI from component state (Rule 4)
   - Clear clipboard if SOAP content was copied
   - Abort in-flight API requests
   - Redirect to login with `?reason=idle_timeout` (for UX messaging)
   - Cookie persists (user can re-authenticate without re-entering credentials if "Remember me" was checked — they just need to enter password/MFA again)

**Where:**
- Web app: React context provider wrapping the app
- Extension: Background service worker monitors popup activity; popup checks on open

### Important Distinction

The idle timeout is a **client-side UX control**, not a server-side session kill. The server already enforces token expiry (1-hour access tokens). The idle timeout exists to protect the unattended screen — if a PT walks away from their computer, we clear PHI from the display within 15 minutes.

---

## 4. Missing UI Components

### P0 — Ship with Auth Changes

| Component | Where | Notes |
|-----------|-------|-------|
| MFA enrollment wizard (QR + recovery codes + verify) | Web settings, Extension settings | Multi-step flow. Must force user to confirm codes saved |
| MFA verification input on login | Web login, Extension login | 6-digit code input. "Use recovery code" link |
| Recovery code login form | Web, Extension | Alternative to TOTP when authenticator is unavailable |
| "Remember me" checkbox | Web login | Controls persistent vs session cookie |
| Idle timeout warning modal | Web | Countdown + "Stay Logged In" button |
| MFA status + management in settings | Web settings, Extension settings | Enable/disable, view codes remaining, regenerate |

### P1 — Next Sprint

| Component | Where | Notes |
|-----------|-------|-------|
| Google OAuth button | Web login/register, Extension login/register | Per [OAUTH_ANALYSIS.md](./OAUTH_ANALYSIS.md) |
| Change password form (in-session) | Web settings | Requires current password. Invalidates all sessions |

### P2 — Before Production

| Component | Where | Notes |
|-----------|-------|-------|
| Active sessions list with revoke | Web settings | Shows device, IP, last active. "Revoke" button per session |
| Change email (with re-verification) | Web settings | Requires password. Sends verification to new email |
| Self-service account deletion | Web settings | Requires password + confirmation. Soft-delete with 30-day grace period |

---

## 5. HIPAA Compliance Gaps Beyond Auth

The auth work above addresses MFA and session timeout. But the [HIPAA_SECURITY_REQUIREMENTS_2026.md](../compliance/HIPAA_SECURITY_REQUIREMENTS_2026.md) research identified additional gaps that aren't auth-specific:

### Current Requirements (Must Fix Before Production)

| Gap | CFR Section | Status |
|-----|-------------|--------|
| Sign Google Cloud Vertex AI BAA | §164.308(b)(1) | ❌ Not done |
| Sign Vercel BAA (Pro plan required) | §164.308(b)(1) | ❌ Not done |
| Sign database provider BAA | §164.308(b)(1) | ❌ Not done |
| Database encryption at rest (AES-256) | §164.312(a)(2)(iv) | ❌ Not deployed |
| Audit log retention automation (6 years) | §164.316(b)(2)(i) | ❌ Not implemented |
| Audit log tamper-proofing (WORM or hashing) | §164.312(b) | ❌ Not implemented |
| Formal risk analysis | §164.308(a)(1)(ii)(A) | ❌ Not documented |
| Incident response plan | §164.308(a)(6) | ❌ Not documented |
| Fix clipboard copy failure handling | UI Audit 2.1 | ❌ Not done |
| Clear clipboard on logout | Rule 4 | ❌ Not done |

### NPRM Requirements (Due ~November 2026 if finalized)

| Gap | Status |
|-----|--------|
| Multi-factor authentication | Addressed in this document (Section 2) |
| Automatic session timeout (15 min) | Addressed in this document (Section 3) |
| Vulnerability scanning (every 6 months) | ❌ Not configured |
| Annual penetration testing | ❌ Not scheduled |
| 72-hour system recovery procedures | ❌ Not documented |
| Annual compliance audit process | ❌ Not documented |
| ePHI integrity verification (checksums/signatures) | ❌ Not implemented |

### BAA Status Summary

| Vendor | ePHI Exposure | BAA Available | BAA Signed |
|--------|---------------|---------------|------------|
| Google Cloud (Vertex AI) | Yes — processes SOAP notes | Yes (Vertex AI only, NOT consumer Gemini) | ❌ No |
| Vercel | Possible — error logs, sessions | Yes (Pro/Enterprise plans) | ❌ No |
| Database provider | Possible — audit logs | Vendor-dependent | ❌ No |
| Sentry | Possible — if errors leak PHI | Yes (Business/Enterprise) | ❌ No |
| Stripe | No — billing only | No (not offered, not needed) | N/A |

**Critical:** Verify we're using **Vertex AI** (Google Cloud enterprise endpoint), not the consumer Gemini API. The consumer API is NOT HIPAA-compliant and Google will NOT sign a BAA for it.

---

## 6. Researching HIPAA Yourself

### Start Here (Official Sources)

| Resource | What It Is |
|----------|------------|
| [HHS HIPAA Security Rule Summary](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html) | Plain-language overview of the Security Rule from HHS |
| [45 CFR Part 164 Subpart C](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C) | The actual regulation text (Technical Safeguards) |
| [45 CFR § 164.308](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.308) | Administrative Safeguards (risk analysis, incident response, BAAs) |
| [45 CFR § 164.312](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.312) | Technical Safeguards (access control, audit, encryption, auth) |

### The 2025 NPRM (Proposed Changes)

| Resource | What It Is |
|----------|------------|
| [Federal Register: Full NPRM Text](https://www.federalregister.gov/documents/2025/01/06/2024-30983/hipaa-security-rule-to-strengthen-the-cybersecurity-of-electronic-protected-health-information) | The complete proposed rule — dense but authoritative |
| [HHS NPRM Fact Sheet](https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html) | Executive summary from HHS — start here for the NPRM |
| [HHS NPRM Summary Page](https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/index.html) | OCR's overview page with key changes |

### Practical Guides (Developer-Focused)

| Resource | What It Is |
|----------|------------|
| [HIPAA Security Rule Standards Map (AccountableHQ)](https://www.accountablehq.com/post/hipaa-security-rule-standards-map-linking-45-cfr-164-308-164-310-164-312-and-164-316-to-real-world-controls) | Maps CFR sections to actual technical controls — best single resource for implementation |
| [HIPAA Compliance for SaaS (Drata)](https://drata.com/blog/hipaa-compliance-saas-guide) | SaaS-focused guide |
| [HIPAA Audit Logs Developer Guide (Pangea)](https://pangea.cloud/blog/hipaa-audit-log-requirements/) | Detailed audit logging implementation guide |
| [HIPAA Compliance with LLMs (Cloudticity)](https://blog.cloudticity.com/hipaa-compliance-llms-best-practices) | AI/LLM-specific HIPAA guidance — directly relevant to FlashNote |

### NIST Standards (Referenced by HIPAA)

| Standard | Topic |
|----------|-------|
| [NIST SP 800-111](https://csrc.nist.gov/publications/detail/sp/800-111/final) | Storage encryption (data at rest) |
| [NIST SP 800-52 Rev. 2](https://csrc.nist.gov/publications/detail/sp/800-52/rev-2/final) | TLS configuration (data in transit) |
| [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework) | General cybersecurity framework (not HIPAA-specific but widely adopted) |

### Tools

| Tool | Purpose | Cost |
|------|---------|------|
| [HHS Security Risk Assessment Tool](https://www.healthit.gov/topic/privacy-security-and-hipaa/security-risk-assessment-tool) | Official risk analysis tool from HHS | Free |
| [OWASP ZAP](https://www.zaproxy.org/) | Web app vulnerability scanner (DAST) | Free |
| [Nessus Essentials](https://www.tenable.com/products/nessus/nessus-essentials) | Infrastructure vulnerability scanner | Free (16 IPs) |

### Key Regulatory Dates

| Date | Event | Impact |
|------|-------|--------|
| Jan 6, 2025 | NPRM published in Federal Register | Comment period opened |
| Mar 7, 2025 | Comment period closed | 4,000+ comments received |
| ~May 2026 | Expected final rule publication | Starts 180-day compliance clock |
| ~Nov 2026 | Expected compliance deadline | MFA, encryption, vuln scanning all mandatory |

**Caveat:** The Trump administration's regulatory freeze executive order creates uncertainty. The timeline could slip. But the direction is clear — these requirements are coming. Building for them now is not optional.

---

## Implementation Order

The httpOnly cookie change and MFA are the two biggest pieces. Recommended sequence:

1. **httpOnly cookie auth** — Solves bridge + persistence. Foundation for everything else. Must be done before MFA (MFA login flow depends on cookie-based refresh).
2. **Idle timeout** — Small, self-contained. Can ship with or right after cookie auth.
3. **TOTP MFA** — Largest piece. Depends on cookie auth being stable. Includes enrollment UI, login flow changes, recovery codes, rate limiting.
4. **Google OAuth** — Independent of the above. Can be parallelized with MFA if bandwidth allows.
5. **Settings UI** (change password, sessions, account deletion) — Polish. Ship when ready.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-15 | Initial document — httpOnly cookie auth, TOTP MFA, idle timeout, HIPAA gap analysis |
