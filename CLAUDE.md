# FlashNote - Claude Code Instructions

## ⚠️ CRITICAL: Healthcare Software Standards

**This is healthcare software. Patient safety and data protection are non-negotiable.**

FlashNote operates in clinical environments where code quality directly impacts patient care and privacy. Every line of code must meet the highest standards:

- **HIPAA compliance is mandatory** - Violations carry penalties up to $1.5M per incident and potential criminal charges
- **MVP-quality code is NOT acceptable** - We do not ship "good enough" code. All code must be production-ready, thoroughly tested, and security-hardened
- **Protect patient data at all costs** - PHI (Protected Health Information) exposure is catastrophic for patients and the business
- **When in doubt, be more secure** - Always err on the side of caution with security decisions
- **No shortcuts on validation or sanitization** - Every input is potentially malicious; treat it accordingly
- **Audit everything security-relevant** - If it touches auth, PHI, or access control, it gets logged

**Before writing any code, ask yourself:**
1. Could this leak PHI in logs, errors, or responses?
2. Is every input validated and sanitized?
3. Are authentication and authorization properly enforced?
4. Would this code survive a security audit?
5. Is this defensive enough for a healthcare environment?

---

## Working Relationship

- Be matter-of-fact, straightforward, and concise. No filler, no hand-waving.
- Challenge my assumptions. I am sometimes wrong — say so directly with evidence.
- When there's a tradeoff, present the options with pros/cons and let me decide. Don't silently pick the easier path.
- Don't provide timeline estimates for any work.
---

## Code Discipline

### Verify Before You Act

- **Read the code before changing it.** Never propose changes to code you haven't read. Understand what exists and why before modifying anything.
- **Never assume — always verify.** Don't trust comments, variable names, plans, or your own intuition. Read the actual implementation. Compare expected behavior against actual behavior.
- **Cite your evidence.** Reference specific locations as `file_path:line_number` when discussing code. Context is lost between sessions — specificity is the only antidote.

### Fix It Now

- **Fix bugs when you find them.** If you encounter a bug in code you're working on, fix it. Don't defer it, don't call it "out of scope," don't suggest a follow-up task. The only exception is if the fix requires genuinely unrelated infrastructure changes.
- **Take the correct approach, not the easy one.** Technical debt compounds. A shortcut today becomes a multi-file refactoring problem next month. Choose the solution that's right long-term.
- **"Good enough" is not good enough.** If there's a known issue, raise it. Figure it out. Fix it. Don't say "acceptable for now" or "close enough." This is healthcare software — that bar applies to everything, not just security.

### Stay Focused

- **Only change what's needed.** Don't refactor adjacent code, add docstrings to untouched functions, or "improve" things beyond the task. A bug fix doesn't need surrounding code cleaned up.
- **Don't over-engineer.** No premature abstractions, no feature flags for single-use paths, no helpers for one-off operations. Three similar lines of code is better than a premature abstraction.
- **Don't add dead code.** No commented-out alternatives, no unused imports, no backwards-compatibility shims for code that was just written. If it's not used, it doesn't exist.

### Verify After You Act

- **Run the relevant tests** after making changes. Don't assume your changes work — confirm it.
- **Re-read your diff** before considering work done. Catch accidental regressions, leftover debugging code, or unintended scope creep.

---

## Project Overview

FlashNote is an AI-powered browser extension that helps Physical Therapists generate SOAP notes from shorthand input. The architecture consists of three main components:

1. **Backend API** (`/backend`) - Node.js + Express REST API
2. **Browser Extension** (`/extension`) - Chrome extension with React + Vite
3. **Web App** (`/web`) - Next.js landing page and dashboard

## Key Architecture Decisions

- **LLM Provider**: Google Gemini (gemini-2.5-flash) - chosen for cost efficiency
- **Auth**: Custom JWT implementation (third-party OAuth under review - see [docs/OAUTH_ANALYSIS.md](docs/OAUTH_ANALYSIS.md))
- **Database**: PostgreSQL with raw SQL queries (no ORM)
- **EMR Integration**: Copy/paste only (v1) - no direct EMR integrations
- **PHI Storage**: We do NOT store patient notes - pass-through to LLM only

## Tech Stack

### Backend
- Node.js 20+ with TypeScript (strict mode)
- Express for routing
- PostgreSQL with `pg` driver (raw SQL, no ORM)
- Zod for validation
- bcryptjs for password hashing
- jsonwebtoken for JWT

### Extension
- React 18+ with TypeScript
- Vite for bundling
- Tailwind CSS for styling
- Chrome Extension Manifest V3
- chrome.storage.local for token persistence

### Web
- Next.js 14+ with App Router
- Tailwind CSS
- Deployed to Vercel

## Database Schema

Only 4 tables needed:
- `users` - User accounts and subscription info
- `sessions` - Refresh token storage
- `audit_logs` - HIPAA-required action logging
- `usage` - Monthly usage tracking for billing

## Important Patterns

### API Responses
Use consistent response structure:
```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: { code: string, message: string } }
```

### Validation
Always use Zod schemas for input validation:
```typescript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
```

### HIPAA Compliance (MANDATORY)

**PHI Protection:**
- NEVER log PHI (patient names, dates of birth, medical record numbers, note content, diagnosis, treatment details)
- NEVER include PHI in error messages, stack traces, or API responses beyond what's necessary
- NEVER store PHI in local storage, cookies, or client-side state longer than the active session
- NEVER transmit PHI without TLS encryption
- ALWAYS sanitize data before logging - assume any user-provided content may contain PHI

**Audit Requirements:**
- Log ALL authentication events (login, logout, token refresh, failed attempts)
- Log ALL authorization failures (access denied events)
- Log note generation metadata (timestamp, user ID, success/failure) but NEVER content
- Audit logs must be immutable and retained per HIPAA requirements

**Security Controls:**
- All connections MUST use TLS 1.2+
- Implement proper session timeout and invalidation
- Enforce principle of least privilege on all data access
- Validate and sanitize ALL inputs without exception

### Error Codes
Standard error codes:
- `missing_token` - No auth header
- `invalid_token` - Token expired/malformed
- `invalid_credentials` - Wrong email/password
- `trial_expired` - Free trial ended
- `subscription_required` - Payment needed
- `rate_limit_exceeded` - Too many requests

## File Naming Conventions

- TypeScript files: `kebab-case.ts`
- React components: `PascalCase.tsx`
- Test files: `*.test.ts` or `*.spec.ts`

## Commands

### Backend
```bash
cd backend
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm test         # Run tests
pnpm db:migrate   # Run migrations
```

### Extension
```bash
cd extension
pnpm dev          # Start dev with hot reload
pnpm build        # Build for production
pnpm package      # Create .zip for Chrome Web Store
```

### Web
```bash
cd web
pnpm dev          # Start Next.js dev server
pnpm build        # Build for production
pnpm start        # Start production server
```

## Security Requirements

- Passwords: bcrypt with 12 rounds minimum
- JWT access tokens: 1 hour expiry
- JWT refresh tokens: 7 days expiry, stored hashed in DB
- Rate limiting: 5 login attempts per 15 minutes
- All endpoints require authentication except /auth/* and /health

### Password Policy (Source of Truth: `backend/src/routes/auth.ts`)

Password requirements are enforced by Zod schemas in the backend:
- Minimum 8 characters
- At least one uppercase letter (`/[A-Z]/`)
- At least one lowercase letter (`/[a-z]/`)
- At least one number (`/[0-9]/`)

**When updating password policy, sync changes to:**
1. `backend/src/routes/auth.ts` - `registerSchema` and `resetPasswordSchema` (SOURCE OF TRUTH)
2. `web/src/app/reset-password/page.tsx` - client-side validation
3. `extension/src/shared/schemas.ts` - client-side validation

## Code Quality Standards

**This is not an MVP. We do not accept shortcuts.**

- **Type Safety**: TypeScript strict mode is mandatory. No `any` types without explicit justification
- **Input Validation**: Every external input (API requests, user input, URL params) must be validated with Zod schemas
- **Error Handling**: All errors must be caught and handled appropriately. No unhandled promise rejections. No leaked stack traces to clients
- **SQL Injection Prevention**: Always use parameterized queries. Never concatenate user input into SQL
- **XSS Prevention**: Sanitize all user-provided content before rendering. Use appropriate encoding
- **Testing**: Security-critical code paths require tests. Auth, authorization, and data handling must have coverage
- **Code Review Mindset**: Write code as if it will be audited by a security firm and reviewed by regulators
- **Fail Secure**: When something goes wrong, fail closed. Deny access by default. Never expose data in error states

## Mandatory Engineering Rules

The following rules address specific patterns that have caused issues in this codebase. They are not guidelines — they are requirements. Violating them introduces security vulnerabilities or data integrity risks.

### Rule 1: Multi-Step Security Operations MUST Use Database Transactions

Any operation that performs multiple database writes that must succeed or fail together MUST use a dedicated `PoolClient` with `BEGIN`/`COMMIT`/`ROLLBACK`. Never rely on sequential `db.query()` calls on the pool — they may go to different connections and provide zero transactional guarantees.

**This applies to:**
- Password reset (update password + invalidate tokens + delete sessions + reset lockout)
- Token rotation (revoke old token + create new token)
- Session creation (insert session + update token hash)
- Any multi-table write operation

```typescript
// CORRECT: Dedicated client with transaction
const client = await db.connect();
try {
  await client.query('BEGIN');
  await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
  await client.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [userId]);
  await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}

// WRONG: Sequential pool queries (no transaction isolation)
await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
await db.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [userId]);
// If the process crashes here, password is changed but tokens are still valid
```

### Rule 2: Never Display Backend Error Messages to Users

All user-facing error messages MUST be curated client-side strings mapped from error codes. Never pass `err.message` or `error.message` from API responses directly into UI state. Backend error messages are for developers, not clinicians.

```typescript
// CORRECT: Map error codes to curated messages
switch (err.code) {
  case 'invalid_credentials': setError('Invalid email or password.'); break;
  case 'trial_expired': setError('Your free trial has ended.'); break;
  default: setError('Something went wrong. Please try again.');
}

// WRONG: Display backend message directly
setError(err.message || 'Failed to sign in');
```

**This applies to:** Every `catch` block in the extension and web app that displays errors to users.

### Rule 3: Always Validate Data from External Sources at Runtime

Use Zod `.parse()` or `.safeParse()` to validate:
- **API responses** before using them (both in extension and web app)
- **Data read from storage** (sessionStorage, chrome.storage.local) before trusting it
- **Webhook payloads** after signature verification
- **URL query parameters** (reset tokens, verification tokens)

Never use `as SomeType` to cast external data. TypeScript type assertions provide zero runtime safety.

```typescript
// CORRECT: Runtime validation
const result = apiResponseSchema.safeParse(await response.json());
if (!result.success) {
  throw new Error('Invalid API response');
}
return result.data;

// WRONG: Trust-casting external data
const result = (await response.json()) as ApiResponse<User>;
```

### Rule 4: Clear PHI from Client State on Logout

When a user logs out (extension or web), ALL of the following must be explicitly cleared:
- Auth tokens (access, refresh, CSRF)
- Generated note content (SOAP notes)
- User input fields (quickNotes, patientContext)
- System clipboard (if SOAP content was copied)
- Any in-flight API requests must be aborted

Do not rely on garbage collection. Set state variables to empty/null explicitly before unmounting.

### Rule 5: Use the Centralized API Client for ALL Backend Calls

Both the extension (`extension/src/shared/api.ts`) and web app (`web/src/lib/api.ts`) have centralized API clients that handle auth headers, CSRF tokens, token refresh, and error handling. **All pages and components must use these clients.** Never use raw `fetch()` to call the backend — it bypasses CSRF protection, retry logic, and consistent error handling.

### Rule 6: Tests Must Exercise Real Security Mechanisms

Tests for security features must validate actual security behavior, not just verify that functions exist or return values. Specifically:

- **Rate limit tests** must verify that requests are actually blocked after the limit
- **Webhook tests** must verify signature validation rejects invalid signatures (don't mock `constructEvent` to always succeed)
- **Auth tests** must verify that `algorithm: 'none'` JWTs are rejected
- **Middleware tests** must include integration tests of the full chain (auth → CSRF → subscription)
- **Never mock the exact mechanism you're testing** — if the test is "does CSRF work?", the CSRF logic must run, not be mocked

```typescript
// CORRECT: Test actual rate limiting behavior
it('blocks requests after limit exceeded', async () => {
  for (let i = 0; i < 5; i++) {
    await request(app).post('/auth/login').send(creds).expect(200);
  }
  await request(app).post('/auth/login').send(creds).expect(429);
});

// WRONG: Test that rate limiter exists
it('exports a rate limiter', () => {
  expect(typeof loginRateLimit).toBe('function');
});
```

### Rule 7: Error Messages MUST Be Generic in All Environments

Never return raw `err.message` in API error responses, even in development or staging. Error details belong in server-side logs, not in HTTP responses. Staging environments may contain realistic test data that includes PHI.

```typescript
// CORRECT: Always generic
res.status(500).json({
  success: false,
  error: { code: 'internal_error', message: 'An unexpected error occurred' }
});

// WRONG: Leaking details in non-production
message: config.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
```

### Rule 8: Server-Side Authorization Is Mandatory (Never Client-Only)

Every protected resource must be enforced on the server. Client-side auth checks (ProtectedRoute, useAuth) are UX conveniences, not security controls. Specifically:

- Backend: Every endpoint except `/auth/*` and `/health` must use `requireAuth` middleware
- Backend: State-changing endpoints must use `requireCsrf` middleware
- Backend: Billing/subscription features must check subscription status server-side
- Web: Protected Next.js routes should have server-side middleware validation (not just client-side `useAuth()`)

### Rule 9: Audit Logs Must Be in the Same Transaction as the Action

When an operation requires a HIPAA audit log entry, the audit write should be part of the same database transaction as the action it documents. If that's not possible (e.g., fire-and-forget for performance), the failure must be captured to Sentry with `Sentry.captureException()`.

### Rule 10: Database Query Results Must Be Defensively Checked

Never use TypeScript non-null assertion (`!`) on `result.rows[0]` from database queries without first checking that rows exist. This applies to all queries, including `INSERT ... RETURNING` and `UPDATE ... RETURNING`.

```typescript
// CORRECT: Check before access
const result = await client.query('UPDATE users SET ... WHERE id = $1 RETURNING *', [id]);
if (result.rows.length === 0) {
  throw new AppError(404, 'user_not_found', 'User not found');
}
return result.rows[0];

// WRONG: Blind non-null assertion
return result.rows[0]!;
```

## Error Monitoring (Sentry)

**Visibility into production errors is critical.** If an error is caught and handled gracefully, it becomes invisible unless explicitly captured to Sentry. Silent failures in healthcare software are unacceptable.

### When to Add Sentry Monitoring

Add `Sentry.captureException()` when implementing or modifying:

1. **Revenue-critical operations** - Payment processing, checkout, subscription management, billing webhooks
2. **HIPAA compliance features** - Audit logging, authentication events, authorization failures
3. **Core product functionality** - LLM/AI service calls, note generation, any feature users pay for
4. **Security controls** - Account lockout, rate limiting, token validation, webhook signature verification
5. **External service integrations** - Email delivery, Stripe API, Gemini API
6. **Graceful error handling** - Any `catch` block that doesn't re-throw (errors that would otherwise be invisible)

**Rule of thumb:** If you write `console.error()` without re-throwing, you probably need `Sentry.captureException()` too.

### What NOT to Capture

- **Expected client errors (4xx)** - Invalid input, missing auth, rate limits hit by users
- **Transient background operations** - Polling failures, optional refreshes that retry automatically
- **High-frequency expected conditions** - Rate limiting during normal operation (e.g., `rate_limited` from LLM)

### How to Add Monitoring

**Backend (`@sentry/node`):**
```typescript
import * as Sentry from '@sentry/node';

try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    extra: {
      source: 'service_name',        // Which service/module
      errorType: 'descriptive_type', // What kind of failure
      // Add relevant IDs for debugging (never PHI)
      userId: user.id,
      subscriptionId: sub.id,
    },
  });
  console.error('Operation failed:', error);
  // Handle gracefully or re-throw
}
```

**Web App (`@sentry/nextjs`):**
```typescript
import * as Sentry from '@sentry/nextjs';

// Same pattern as backend
Sentry.captureException(error, {
  extra: { source: 'checkout', plan: 'monthly' },
});
```

**Extension (custom wrapper):**
```typescript
import { captureException } from '@/shared/sentry';

// Uses our HIPAA-safe wrapper that sanitizes extras
captureException(error, { source: 'extension_storage', errorType: 'read_failed' });
```

### Safe Extras (Include)

| Safe to Include | Examples |
|-----------------|----------|
| Source identifier | `source: 'billing_service'` |
| Error type/code | `errorType: 'webhook_failed'` |
| User ID | `userId: user.id` |
| Resource IDs | `subscriptionId`, `sessionId` |
| Status codes | `statusCode: 500` |
| Durations | `durationMs: 1234` |
| Counts | `retryCount: 3` |

### Source Naming Convention

Use consistent `snake_case` naming for `source` values:

| Component Type | Pattern | Examples |
|----------------|---------|----------|
| Backend services | `{name}_service` | `auth_service`, `billing_service`, `ai_service` |
| Backend middleware | `{name}_handler` | `error_handler` |
| Backend webhooks | `{name}_webhook` | `billing_webhook` |
| Web pages | `{name}_page` | `pricing_page`, `dashboard_page` |
| Web/Extension libs | `{name}_storage`, `api_client` | `session_storage`, `extension_storage` |

Use `errorType` to specify the specific failure within a source (e.g., `source: 'auth_service', errorType: 'verification_email_failed'`).

### Unsafe Extras (NEVER Include)

| Never Include | Why |
|---------------|-----|
| Patient names | PHI |
| Note content | PHI |
| Diagnosis/treatment | PHI |
| Email addresses | PII (use userId instead) |
| Request/response bodies | May contain PHI |
| Full error messages from user input | May contain PHI |

### Existing Sentry Configuration

- **Backend**: `src/instrument.ts` with PHI sanitization in `beforeSend`
- **Extension**: `src/shared/sentry.ts` using BrowserClient (not `Sentry.init()` - required for extensions)
- **Web**: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`

All components have `beforeSend` hooks that strip PHI-sensitive fields. See `docs/planning/MONITORING_SETUP.md` for full configuration details.

### Logging Gaps Audit

A comprehensive audit identified all catch blocks in the codebase. See `docs/planning/SENTRY_LOGGING_GAPS.md` for:
- The full list of what's monitored
- Decisions on what should remain silent
- The rationale for each monitoring decision

## Reference Document

See `docs/reference/FLASHNOTE_HANDOFF.md` for complete project specification including:
- Full API documentation
- Database schema details
- PT-specific AI prompts
- HIPAA compliance checklist
- Deployment strategy

## Documentation Guidelines

**Before starting a task:**
1. Check `docs/ROADMAP.md` to understand current priorities
2. Review relevant docs in `docs/` that may inform your approach:
   - `docs/guides/` - API reference and operational procedures
   - `docs/planning/` - Future feature designs (don't implement unless asked)
   - `docs/compliance/` - Security and testing requirements
   - `docs/reference/` - Project specifications

**After completing a task:**
1. Update documentation that was affected by your changes
2. Mark completed items in `docs/ROADMAP.md` or `docs/SUCCESS_METRICS.md`
3. Move fully-implemented planning docs to `docs/archive/`
4. Update `docs/guides/API.md` if you added/changed endpoints

**Documentation principles:**
- Keep docs current - outdated docs are worse than no docs
- Don't over-document - only document what provides ongoing value
- Single source of truth - information should live in one place
- Prefer updating existing docs over creating new ones
- Archive completed work rather than deleting (for historical reference)

**What NOT to document:**
- Trivial implementation details obvious from the code
- Temporary debugging notes
- Duplicate information already in another doc
- Speculative features not discussed with the user

## Additional Rules
- Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.