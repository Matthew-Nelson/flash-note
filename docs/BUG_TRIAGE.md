# Post-Migration Bug Triage

Systematic audit of bugs introduced or exposed during the Next.js migration.
Two rounds of parallel audits covering 17 areas: auth flows, cookies, sessions, proxy,
redirects, DAL, Server Actions, client-side state, rate limiting, webhooks, env vars,
LLM prompt injection, streaming/Suspense, DB connection pool, email/token URLs, and CSP.

**Status**: Fixing in progress (BUG-1, BUG-2, BUG-3, BUG-4, BUG-5, BUG-6, BUG-7, BUG-8, BUG-9 fixed)

---

## Checklist

### P0 — Fix Immediately

- [x] **BUG-1**: `expireSessionAction` throws in Server Component render — user lockout
  - Blocks: BUG-2, BUG-5

### P1 — Fix Before Production

- [x] **BUG-2**: Dashboard page redirects missing `?reason=` — latent redirect loop
  - Blocked by: BUG-1
- [x] **BUG-3**: X-Forwarded-For spoofing bypasses all rate limiting in production
  - Compounds: BUG-4

### P2 — Fix Soon

- [x] **BUG-4**: Login timing side-channel enables email enumeration
- [x] **BUG-5**: Dashboard error boundary links back to dashboard (UX dead end)
  - Blocked by: BUG-1
- [x] **BUG-6**: Locked-account audit log failure is silent (Rule 9 violation)
- [x] **BUG-7**: DB pool leaks connections on every HMR reload in dev mode
- [x] **BUG-8**: No graceful shutdown handler — dirty Cloud Run container stops

### P3 — Track for Later

- [x] **BUG-9**: Missing rate limit on billing checkout action
- [x] **BUG-10**: Unknown Stripe webhook event types silently dropped
- [ ] **BUG-11**: Prompt sanitization regex doesn't catch unclosed delimiter tags

---

## Bug Details

### BUG-1 (P0): `expireSessionAction` throws in Server Component render context

**Location**: `web/src/app/dashboard/layout.tsx:20`
**Symptom**: `GET /dashboard` returns 500 when session is expired in DB but cookie still exists.
**Root cause**: `expireSessionAction()` is called directly during Server Component render.
Despite being defined in a `'use server'` file, direct function calls from render execute in
the Server Component context — NOT as a Server Action invocation. `cookieStore.delete()` throws
because cookie mutation is forbidden during render.

**Impact**: User with an expired DB session is **locked out of the entire app for up to 7 days**
(cookie maxAge). The designed fallback (proxy clears stale cookie on `/login?reason=`) is
unreachable because the redirect that carries the reason parameter never fires. User sees
"Something went wrong" error page (`dashboard/error.tsx`) with a "Try Again" button that
re-triggers the same 500.

**Cascade**: This bug renders BUG-5 (error boundary links to dashboard) actively harmful,
and BUG-2 (pages redirect without reason) a ticking time bomb.

**Fix**:
1. Replace `expireSessionAction()` call in `layout.tsx:20` with `redirect('/login?reason=session_expired')`
2. The proxy already handles cookie clearing when it sees a valid `?reason=` param on `/login` (`proxy.ts:67-73`)
3. Remove or update the comment block at `layout.tsx:15-19` explaining the old pattern
4. Update `layout.test.tsx` to verify the new redirect behavior
5. Verify `expireSessionAction` has no other callers (if none, consider removing it)

**Verify**: Hit `/dashboard` with an expired session cookie — should redirect to `/login?reason=session_expired` with no 500.

---

### BUG-2 (P1): Dashboard page redirects missing `?reason=` — latent redirect loop

**Location**: `web/src/app/dashboard/page.tsx:101`, `web/src/app/dashboard/settings/page.tsx:11`
**Symptom**: Not currently triggerable (layout catches null session first and hits BUG-1).
Would cause an infinite redirect loop if the layout check is removed or bypassed.

**Root cause**: Both pages do `redirect('/login')` with no `?reason=` parameter when
`getSession()` returns null. The proxy sees session cookie + `/login` + no reason →
redirects back to `/dashboard` (`proxy.ts:75`) → layout/page gets null session again → loop.

**Impact**: Latent. Activates if:
- BUG-1 fix removes the layout-level session check instead of fixing it
- Next.js error recovery causes the page to render independently of its layout
- A new dashboard sub-route is added without the layout wrapping it

**Fix**:
1. Change `page.tsx:101` from `redirect('/login')` to `redirect('/login?reason=session_expired')`
2. Change `settings/page.tsx:11` from `redirect('/login')` to `redirect('/login?reason=session_expired')`
3. Update tests for both pages
4. Search for any other `redirect('/login')` calls in dashboard routes and fix those too

**Verify**: Manually confirm no redirect loop by simulating a stale cookie with layout check bypassed.

---

### BUG-3 (P1): X-Forwarded-For spoofing bypasses all rate limiting in production

**Location**: `web/src/server/lib/request-context.ts:17-20`
**Symptom**: An attacker can bypass every IP-based rate limit by setting a custom
`X-Forwarded-For` header on each request.

**Root cause**: The code extracts the **leftmost** (first) IP from `x-forwarded-for`:

```typescript
const forwarded = headerStore.get('x-forwarded-for');
const rawIp = forwarded?.split(',')[0]?.trim() ?? ...
```

Google Cloud Run's load balancer **appends** the real client IP to `x-forwarded-for` but
does NOT strip client-supplied values. The resulting header for a spoofed request looks like:
`<attacker-supplied-fake-ip>, <real-client-ip>, <load-balancer-ip>`. Taking `[0]` gives
the attacker-controlled value.

**Impact**: Every rate limiter keyed on IP address is bypassed in production:
- Login: 5 attempts/15 min → unlimited
- Registration: 3 attempts/hr → unlimited
- Password reset: 3 attempts/hr → unlimited
- Email verification: 5 attempts/15 min → unlimited
- Note generation: 30 attempts/min → unlimited

Enables brute-force attacks against login, credential stuffing, and abuse of LLM generation.

**Fix**:
1. Research Cloud Run's exact `x-forwarded-for` format (verify: `<client-supplied>, <real-ip>, <lb-ip>`)
2. Add a `TRUSTED_PROXY_COUNT` env var (default: 1 for Cloud Run's single LB hop)
3. Extract the IP at position `parts.length - 1 - TRUSTED_PROXY_COUNT` (second-to-last for Cloud Run)
4. Fall back to rightmost IP if index is out of bounds
5. Update `request-context.test.ts` with spoofing scenarios
6. Document the trusted proxy configuration in `CLAUDE.md` or config

**Verify**: Send requests with spoofed `X-Forwarded-For` and confirm rate limiting still activates.

**Note**: Only affects production (Cloud Run). Local dev has no proxy chain.

---

### BUG-4 (P2): Login timing side-channel enables email enumeration

**Location**: `web/src/server/services/auth.ts:74-86`
**Symptom**: An attacker can determine whether an email address is registered by measuring
login response times.

**Root cause**: The login flow uses a DUMMY_HASH for bcrypt comparison when the user doesn't
exist (`auth.ts:71`), which equalizes the bcrypt cost. However, after the bcrypt comparison,
the code paths diverge:

- **No user**: bcrypt(DUMMY_HASH) → return immediately
- **User exists + wrong password**: bcrypt(realHash) → `recordFailedAttempt()` (DB write, ~5ms) → return
- **User exists + correct password**: bcrypt(realHash) → `getAccountLockoutStatus()` (DB read) → session creation → return

The `recordFailedAttempt()` DB write on line 78 only executes when the user exists, creating
a measurable ~5ms timing difference after the ~200ms bcrypt operation.

**Mitigating factors**:
- Rate limiting (5 attempts / 15 min) severely limits sampling — but see BUG-3 which
  defeats rate limiting in production
- Network jitter (~20-100ms) generally dwarfs the 5ms delta
- Statistical detection requires many samples per email

**Impact**: With BUG-3 unfixed, an attacker could enumerate registered emails at scale by
bypassing rate limits and collecting timing samples. With BUG-3 fixed, the risk drops
significantly but remains theoretically exploitable.

**Fix**:
1. In the `!user` path (line 74-85), add a dummy DB query that takes roughly the same time as `recordFailedAttempt()` — e.g., `SELECT 1` or a no-op write
2. Alternatively, restructure to always call `recordFailedAttempt()` but make it a no-op when userId is null
3. Add a test that confirms both paths take similar time (within tolerance)

**Verify**: Measure response times for existing vs non-existing emails — delta should be within network noise.

---

### BUG-5 (P2): Dashboard error boundary links back to dashboard

**Location**: `web/src/app/dashboard/error.tsx:35`
**Symptom**: When the error is auth-related (BUG-1), the "Return to Dashboard" link
re-triggers the same 500 error in an infinite loop.

**Root cause**: The error boundary is generic — it doesn't distinguish auth errors from
other errors. The "Return to Dashboard" link and "Try Again" button both send the user
right back into the broken auth check.

**Impact**: UX dead end. Compounds BUG-1 impact — even if the user finds the error page,
both escape routes lead back to the same error.

**Fix**:
1. Change the "Return to Dashboard" link to point at `/login` with text "Return to sign in"
2. Keep "Try Again" as-is (it's useful for non-auth errors)
3. Update the test for the error boundary

**Verify**: Trigger a dashboard error and confirm the link escapes the error loop.

---

### BUG-6 (P2): Locked-account audit log failure is silent (Rule 9 violation)

**Location**: `web/src/server/services/auth.ts:104`
**Symptom**: If the audit log for a locked-account login attempt fails, no error surfaces
anywhere.

**Root cause**: The audit call at line 104 uses `auditService.log()` (fire-and-forget),
which catches errors internally and logs to `console.error` (`audit.ts:35`). This means:
1. The audit write fails silently
2. The console.error is unstructured (no source, errorType, userId)
3. Cloud Error Reporting won't group or alert on it

A locked account receiving a correct-password login attempt is suspicious activity that
HIPAA requires to be audited. Silent failure of this audit entry is a compliance gap.

**Impact**: Potential HIPAA audit trail gap for security-critical events. Low probability
(requires DB failure during audit write), but high consequence if audited.

**Fix**:
1. Wrap the audit call at `auth.ts:104` in a try/catch
2. In the catch, log at `error` level with structured context: `source: 'service_auth'`, `errorType: 'locked_account_audit_failed'`, `userId: user.id`
3. Currently uses `console.error` (Pino migration is pending) — use the same pattern but with structured fields so it's easy to migrate later
4. Add a test that verifies the error is logged when audit fails

**Verify**: Mock `auditService.log` to throw and confirm the error is logged with structured context.

---

### BUG-7 (P2): DB pool leaks connections on every HMR reload in dev mode

**Location**: `web/src/server/db/index.ts:15`
**Symptom**: After several code changes in dev mode, database connections are exhausted.
Queries start timing out and the app becomes unresponsive until the dev server is restarted.

**Root cause**: The pool is a module-level singleton with no `globalThis` protection:

```typescript
export const db = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  ...
});
```

In Next.js dev mode, Hot Module Reloading re-evaluates modules on code changes. Each
re-evaluation creates a **new** `Pool` instance (up to 20 connections) while the old instance
remains open. After 5-10 code changes, the app has consumed 100-200 connections — well
beyond typical Cloud SQL or local PostgreSQL limits.

This is a well-known Next.js + pg issue with a standard 3-line fix.

**Impact**: Dev mode becomes unusable after a few code changes. Requires restarting the dev
server to reclaim connections. Does NOT affect production (Cloud Run doesn't do HMR).

**Fix**:
1. Add `globalThis` caching pattern to `web/src/server/db/index.ts`:
   ```typescript
   const globalForDb = globalThis as unknown as { db?: pg.Pool };
   export const db = globalForDb.db ?? new Pool({ ... });
   if (process.env.NODE_ENV !== 'production') globalForDb.db = db;
   ```
2. Keep the pool error handler attached (it's idempotent)
3. Update tests if the import pattern changes

**Verify**: Make 10+ code changes with `pnpm dev` running — DB queries should continue working without restart.

---

### BUG-8 (P2): No graceful shutdown handler — dirty Cloud Run container stops

**Location**: `web/src/server/db/index.ts` (missing handler)
**Symptom**: On Cloud Run container shutdown (deploy, scale-down, health check failure),
in-flight database queries may be abandoned and connections left dangling.

**Root cause**: Cloud Run sends `SIGTERM` before terminating a container (10-second grace
period by default). The app has no signal handler to drain the pool. This means:
- In-flight queries may fail mid-execution
- Connections aren't closed cleanly, leaving dangling resources on Cloud SQL
- Audit log writes in progress may be lost (HIPAA concern)

**Impact**: Production risk during deploys and auto-scaling events. In-flight requests fail
ungracefully. Audit log entries could be lost if the container stops mid-write.

**Fix**:
1. Add a `SIGTERM` handler in `web/src/server/db/index.ts` (or in a dedicated shutdown module):
   ```typescript
   process.on('SIGTERM', async () => {
     await db.end();
     process.exit(0);
   });
   ```
2. Consider also handling `SIGINT` for local dev (Ctrl+C)
3. Add a timeout so shutdown doesn't hang if pool drain takes too long

**Verify**: Deploy to Cloud Run, trigger a container restart, confirm no connection errors in Cloud SQL logs.

---

### BUG-9 (P3): Missing rate limit on billing checkout action

**Location**: `web/src/actions/billing.ts:36-66`
**Symptom**: An authenticated user can spam unlimited Stripe checkout session creation.

**Root cause**: `createCheckoutAction` has no rate limit check. Every other sensitive action
(login, register, password reset, note generation) is rate-limited, but checkout was missed.

**Mitigating factors**:
- Requires authentication (attacker needs a valid session)
- Stripe itself rate-limits API calls at the account level
- No direct security impact — just API cost and potential Stripe rate limit errors

**Fix**:
1. Add a `checkoutRateLimit` in the rate limit config (e.g., 5 requests per hour)
2. Key by userId (authenticated endpoint, IP is less relevant)
3. Add the check before `getBillingService().createCheckoutSession()`
4. Return `rate_limit_exceeded` error code on limit hit
5. Add a test

**Verify**: Confirm checkout is blocked after exceeding the limit.

---

### BUG-10 (P3): Unknown Stripe webhook event types silently dropped

**Location**: `web/src/server/services/billing.ts:199-224`
**Symptom**: If Stripe sends an event type not in the switch statement, it's accepted (200 OK),
marked as processed in the idempotency table, and silently ignored.

**Root cause**: No `default` case in the event type switch. Unknown events pass through
without logging or alerting.

**Impact**: If Stripe adds a new event type relevant to billing (e.g., `charge.dispute.created`,
`payment_intent.payment_failed`), the app will silently ignore it. The idempotency mark
means even if we later add a handler, the event won't be reprocessed.

**Fix**:
1. Add a `default` case to the switch at `billing.ts:199-224`
2. Log at `warn` level with event type and event ID
3. Do NOT return 500 (that would trigger Stripe retries for events we'll never handle)
4. Add a test for an unknown event type

**Verify**: Send a test webhook with an unknown event type — confirm it's logged, returns 200, and doesn't throw.

---

### BUG-11 (P3): Prompt sanitization regex doesn't catch unclosed delimiter tags

**Location**: `web/src/server/lib/prompt-sanitization.ts:82`
**Symptom**: An attacker can inject a delimiter-like string that bypasses the tag stripper.

**Root cause**: `escapeDelimiterTags` uses a regex that requires a closing `>`:
```typescript
sanitized = sanitized.replace(new RegExp(`<\\s*/?\\s*${tagName}[^>]*>`, 'gi'), '');
```

An input like `</clinician_notes` (no closing `>`) won't match the regex. After wrapping,
this becomes:
```xml
<clinician_notes>
...user content...
</clinician_notes
</clinician_notes>
```

A forgiving XML parser (or LLM) might interpret `</clinician_notes` as a closing tag,
allowing content after it to escape the delimiter boundary.

**Mitigating factors**:
- The system prompt instructs the LLM to treat delimited content as data only
- `detectSuspiciousPatterns` would flag this in monitoring
- Only affects the user's own note generation (no privilege escalation)
- LLM interpretation of malformed XML is unpredictable — attack is unreliable

**Fix**:
1. Add an additional regex pass that strips `</tagName` at end-of-string (no closing `>` required)
2. Or broaden the regex to also match `<\s*/?\s*tagName[^>]*$` (tag-like string at end of input)
3. Update `prompt-sanitization.test.ts` with unclosed tag test cases

**Verify**: Input `</clinician_notes` and confirm it's stripped before wrapping.

---

## Audit Scope (Complete)

### Round 1 — Core Auth & Data Access
- [x] Cookie mutation context (Server Action vs Server Component)
- [x] Auth flows (login, register, logout, password reset, email verification)
- [x] Session lifecycle (creation, validation, refresh, expiry, revocation)
- [x] Proxy redirect logic and edge cases
- [x] Server Action error handling and return patterns
- [x] DAL authorization enforcement
- [x] Rate limiting integration
- [x] Webhook signature verification
- [x] CSRF protection coverage
- [x] Client-side auth state and PHI cleanup
- [x] Error boundary behavior under auth failures

### Round 2 — Migration-Specific Risks
- [x] Environment variable exposure (NEXT_PUBLIC_ leaks)
- [x] LLM prompt injection and response handling
- [x] Streaming/Suspense auth race conditions
- [x] Database connection pool under Next.js HMR
- [x] Email/token URL construction (host header injection)
- [x] Content Security Policy completeness

---

## Areas Confirmed Clean

The following areas were audited and found to be correctly implemented:

- **DAL authorization enforcement (Rule 5)**: All functions validate access. Parameterized queries only. Row existence checks on all results. Transactions with proper ROLLBACK/release.
- **Cookie security attributes**: httpOnly, Secure (production), SameSite=Lax, proper maxAge.
- **Logout flow**: Session deleted from DB, cookie cleared, PHI cleared from client state (clipboard, component state, custom event dispatch). Correct ordering.
- **Password reset flow**: Transactional (password update + session revocation + lockout reset in single transaction). All sessions invalidated on password change.
- **Registration flow**: Transactional (user creation + legal consent + invite code + org join). Unique constraint handles race conditions. Email enumeration prevented by generic error.
- **Session validation**: Fail-closed. React.cache() deduplication. Sliding window refresh is best-effort. Soft-deleted users filtered.
- **Webhook signature verification**: Raw body used. Signature checked before any business logic. Invalid signatures return 400.
- **Client-side PHI cleanup (Rule 4)**: LogoutButton dispatches event, NoteGenerationForm clears all PHI state. Clipboard cleared. No PHI in localStorage/sessionStorage.
- **XSS prevention**: All user content rendered as text (React auto-escape). No unsafe HTML injection patterns. Generated SOAP notes use whitespace-pre-wrap, not HTML.
- **Accessibility (Rules 11-14)**: aria-labels on icon buttons, aria-live regions on dynamic content, form labels present, error boundaries log digest only.
- **Server Action patterns**: All have 'use server' directive, Zod validation before DB access, discriminated union returns, no leaked error messages.
- **CSRF**: Server Actions have built-in protection. Webhook Route Handler uses signature verification instead.
- **Environment variable exposure**: All server secrets protected by `server-only` imports. No NEXT_PUBLIC_ leaks. Centralized Zod-validated config. Shared `lib/` has zero process.env references.
- **Email/token URL construction**: Base URL from env config (not request headers — immune to host header injection). Tokens are cryptographically random (32 bytes), SHA-256 hashed for storage, single-use via atomic DB update, time-limited (24h verification, 15m reset). URLs properly encoded with `encodeURIComponent`.
- **Streaming/Suspense auth**: Layout `await getSession()` blocks streaming until auth completes. No protected content leaks before redirect. Error boundaries render inside layout shell only for authenticated users.
- **CSP policy**: Nonce generation and propagation correct. `strict-dynamic` + nonce for scripts. `font-src 'self'` is correct (`next/font/google` self-hosts at build time). No external script/connect/font requirements. No inline event handlers or eval. `frame-ancestors 'none'` prevents clickjacking.
- **LLM prompt structure**: System instructions use dedicated API fields (Gemini `systemInstruction`, Claude `system`). User input wrapped in XML delimiters. Output validated against Zod schema. Suspicious patterns detected and logged. Error responses sanitized (no raw LLM errors to client).
