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

### Work in Phases, Not Marathons

Large tasks degrade in quality when tackled in a single long session. Context fills up, details get lost, and shortcuts creep in. Fight this:

- **Break multi-file work into phases where each phase is independently testable and committable.** "Port the lockout service to the DAL" is a phase. "Migrate auth" is not — it's a project.
- **Start each session by re-reading the actual code you'll modify.** Don't trust summaries, prior conversation context, or your own memory. Read the files. Every time.
- **Verify the current phase before starting the next.** Tests pass, no regressions, diff reviewed, committed. If phase N is broken, phase N+1 will compound the damage.
- **When providing context across sessions, be specific.** Reference `file_path:line_number`, not "the auth service." Quote the actual code under discussion. Abstractions drift; code doesn't.

---

## Project Overview

FlashNote is an AI-powered web application that helps Physical Therapists generate SOAP notes from shorthand input. It is a single Next.js application with an integrated server-side backend using the App Router, Server Components, Server Actions, and Route Handlers.

## Architecture Decision Record

These decisions are the result of deliberate analysis. Don't re-litigate them without new information.

- **Single-app architecture**: Pure Next.js with integrated backend. Chosen because there is one web client and no API-as-a-service requirement. If we later offer API access to note generation for third-party platforms, this decision should be revisited — that would require extracting a standalone API server.
- **All-Google infrastructure**: Next.js deployed on Cloud Run (not Vercel). One BAA covers Cloud Run + Cloud SQL + Vertex AI. Eliminates serverless connection pooling concerns — Cloud Run runs the app as a long-lived container where `pg.Pool` works normally. See [docs/planning/NEXTJS_MIGRATION_PLAN.md](docs/planning/NEXTJS_MIGRATION_PLAN.md) for the full infrastructure analysis.
- **Auth**: Cookie-based sessions with opaque session tokens. The session ID is stored in an httpOnly cookie; all session state lives in the `sessions` DB table. Opaque tokens were chosen over JWT-in-cookie because every request requires a DB roundtrip for session validation anyway (token revocation, lockout checks), making JWT's "stateless" benefit moot. Opaque tokens are smaller (~36 bytes vs ~500 bytes) and simpler.
- **Data Access Layer (DAL)**: All database access goes through a centralized DAL. This is the single authorization enforcement layer — the one codebase to audit for HIPAA compliance. See [Rule 5](#rule-5-all-data-access-must-go-through-the-dal).
- **LLM Provider**: Google Gemini (gemini-2.5-flash) via Vertex AI — chosen for cost efficiency. Vertex AI (not direct Gemini API) for production because it's covered under the Google Cloud BAA.
- **Database**: PostgreSQL on Cloud SQL with raw SQL queries (no ORM)
- **EMR Integration**: Copy/paste only (v1) — no direct EMR integrations
- **PHI Storage**: Currently pass-through only (no stored notes). PHI storage for patients, clinical notes, and versioning is designed and on the roadmap — see [docs/planning/PHI_STORAGE_PLAN.md](docs/planning/PHI_STORAGE_PLAN.md)

## Tech Stack

- Next.js 16 with App Router
- TypeScript (strict mode)
- PostgreSQL with `pg` driver (raw SQL, no ORM) on Google Cloud SQL
- Zod for validation
- bcryptjs for password hashing
- Upstash Redis for rate limiting (`@upstash/ratelimit`)
- Pino structured logger + `@google-cloud/pino-logging-gcp-config` (Cloud Logging integration)
- Tailwind CSS for styling
- Stripe for billing
- Google Vertex AI for LLM (Gemini 2.5 Flash)
- Deployed to Google Cloud Run

## Project Structure

```
web/src/
  app/                    # Next.js App Router
    (auth)/               # Auth route group (login, signup, reset, verify)
    (marketing)/          # Public pages (landing, pricing, terms, privacy, baa)
    dashboard/            # Protected routes
      settings/
      loading.tsx         # Streaming fallback
      error.tsx           # Error boundary
    api/
      webhooks/stripe/    # Stripe webhook Route Handler
      telemetry/          # Client-side error reporting endpoint
    layout.tsx            # Root layout
    loading.tsx           # Global loading
    error.tsx             # Global error boundary
    not-found.tsx         # 404 page
  components/             # React components (shared UI)
    ui/                   # Primitives (Button, Card, Spinner, etc.)
    auth/                 # Auth-related UI (login form, etc.)
  lib/                    # Shared utilities (client + server safe)
    schemas/              # Zod validation schemas (auth, notes, billing, config)
    types/                # TypeScript type definitions
    utils/                # Pure utility functions
  server/                 # Server-only code (enforced by 'server-only' package)
    dal/                  # Data Access Layer (DB queries, row transforms)
    services/             # Business logic (auth, billing, email, AI, lockout, token, usage, audit)
    db/                   # Database connection pool + migration runner
    lib/                  # Server utilities (logger, etc.)
    prompts/              # LLM prompt templates
  actions/                # Server Actions (grouped by domain: auth, notes, billing)
  test/                   # Test setup, helpers, factories
```

**Key conventions:**
- `server/` imports are forbidden from Client Components. Enforced by the `server-only` npm package — importing it from a Client Component is a build error.
- `lib/` is shared code that may be used on either client or server. No DB imports, no Node.js-only APIs.
- `actions/` contains Server Actions (`'use server'` files). Each action calls `server/` for business logic — actions are thin wrappers that handle cookie I/O, call services, and return results.
- `loading.tsx` and `error.tsx` at each route level provide streaming fallbacks and error boundaries.
- Route groups `(auth)` and `(marketing)` share layouts without affecting URL structure.

## Database Schema

11 tables:
- `users` - User accounts, subscription info, org membership, email verification, lockout state
- `sessions` - Session storage (hashed tokens, device binding)
- `audit_logs` - HIPAA-required action logging (immutable)
- `usage` - Monthly usage tracking (input/output token split)
- `email_tokens` - Email verification and password reset tokens (hashed, typed, with expiry)
- `organizations` - Clinic/team management with seat limits
- `organization_members` - Membership records with soft-delete
- `legal_acceptances` - Terms of Service / BAA consent tracking (per document version)
- `invite_codes` - Personal or clinic-based invitation codes with expiry
- `processed_webhook_events` - Stripe webhook deduplication (idempotency)
- `migrations` - Migration tracking (auto-managed)

## Important Patterns

### Server Components vs Client Components

**Default to Server Components.** Only add `'use client'` when the component needs browser APIs, event handlers, or `useState`/`useEffect`.

- Pages that display data should be Server Components (read cookie → call DAL → render)
- Forms should be Client Components that submit to Server Actions
- Never fetch data client-side when it can be fetched server-side
- Layout components should be Server Components unless they manage client-side state (e.g., toast notifications)

### Server Actions for Mutations

All state-changing operations use Server Actions:

```typescript
'use server';

import { getSession } from '@/server/dal/session';
import { z } from 'zod';

const schema = z.object({ /* ... */ });

export async function updateProfile(formData: FormData) {
  const session = await getSession();
  if (!session) throw new AuthError('unauthenticated');

  const input = schema.parse(Object.fromEntries(formData));
  // DAL call with session.userId
}
```

- Validate with Zod before any DB access
- Read and validate the session cookie via the DAL
- Return a discriminated union — `{ success: true, data: T }` or `{ success: false, error: string }` where `error` is an error code, not a raw message (Rule 2 still applies)
- Never `throw` from Server Actions for expected errors (validation failures, auth errors) — return error codes. Only throw for truly unexpected errors (these surface via `error.tsx` boundaries).
- Server Actions that touch security-critical paths need audit logging
- Next.js Server Actions have built-in CSRF protection — no additional CSRF handling needed for Server Actions

### Route Handlers for Webhooks and External Integrations

Use Next.js Route Handlers (`app/api/.../route.ts`) for:
- Stripe webhooks (need raw body access for signature verification)
- Any endpoint that external services call directly

Route Handlers that accept external input must implement their own CSRF protection or signature verification. Server Action CSRF does not apply to Route Handlers.

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
- NEVER store PHI in cookies, client-side state, or browser storage longer than the active session
- NEVER transmit PHI without TLS encryption
- ALWAYS sanitize data before logging — assume any user-provided content may contain PHI

**Audit Requirements:**
- Log ALL authentication events (login, logout, session refresh, failed attempts)
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
- `unauthenticated` - No valid session
- `session_expired` - Session timed out or was revoked
- `invalid_credentials` - Wrong email/password
- `trial_expired` - Free trial ended
- `subscription_required` - Payment needed
- `rate_limit_exceeded` - Too many requests

## File Naming Conventions

- TypeScript files: `kebab-case.ts`
- React components: `PascalCase.tsx`
- Test files: `*.test.ts` or `*.spec.ts`
- Next.js App Router: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`
- Server Actions: centralized in `actions/` directory, grouped by domain (e.g., `actions/auth.ts`, `actions/notes.ts`, `actions/billing.ts`)

## Commands

```bash
cd web
pnpm dev          # Start Next.js dev server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm test         # Run tests
pnpm db:migrate   # Run migrations
```

### Deployment (Cloud Run)

```bash
# Build and deploy (typically handled by CI/CD pipeline)
docker build -t flashnote-web .
gcloud run deploy flashnote-web --image=<artifact-registry-url>/flashnote-web --region=<region>
```

## Security Requirements

- Passwords: bcrypt with 12 rounds minimum
- Session cookies: `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`
- Session expiry: 7 days (configurable), validated against DB on every request
- Rate limiting: Redis-backed (Upstash) — no in-memory rate limiters (serverless = no persistent memory)
- Rate limit rules: 5 login attempts per 15 minutes (see rate limit config for full list)
- All data access requires a valid session except public pages and auth flows

### Cookie Security

- Session cookie contains ONLY an opaque session ID (UUID). Never store PHI, user data, or tokens in cookies.
- `httpOnly` prevents JavaScript access — XSS cannot steal session identifiers
- `Secure` ensures cookies are only sent over HTTPS
- `SameSite=Lax` prevents CSRF on state-changing requests from cross-origin contexts
- Cookie size budget: ~36 bytes for the session ID. Well under the 4KB limit.
- On logout: delete the session cookie server-side AND delete the session row from the database

### Password Policy (Source of Truth: server-side Zod schema)

Password requirements are enforced by Zod schemas:
- Minimum 8 characters
- At least one uppercase letter (`/[A-Z]/`)
- At least one lowercase letter (`/[a-z]/`)
- At least one number (`/[0-9]/`)

**When updating password policy, sync changes to:**
1. Server-side Zod schema in the DAL/auth module (SOURCE OF TRUTH)
2. Client-side validation in the relevant form components

## Code Quality Standards

**This is not an MVP. We do not accept shortcuts.**

- **Type Safety**: TypeScript strict mode is mandatory. No `any` types without explicit justification
- **Input Validation**: Every external input (form data, URL params, webhook payloads, cookie values) must be validated with Zod schemas
- **Error Handling**: All errors must be caught and handled appropriately. No unhandled promise rejections. No leaked stack traces to clients
- **SQL Injection Prevention**: Always use parameterized queries. Never concatenate user input into SQL
- **XSS Prevention**: Sanitize all user-provided content before rendering. Use appropriate encoding
- **Testing**: Security-critical code paths require tests. Auth, authorization, and data handling must have coverage
- **Code Review Mindset**: Write code as if it will be audited by a security firm and reviewed by regulators
- **Fail Secure**: When something goes wrong, fail closed. Deny access by default. Never expose data in error states

## Mandatory Engineering Rules

The following rules address specific patterns that have caused issues in this codebase. They are not guidelines — they are requirements. Violating them introduces security vulnerabilities or data integrity risks.

### Rule 1: Multi-Step Security Operations MUST Use Database Transactions

Any operation that performs multiple database writes that must succeed or fail together MUST use a dedicated `PoolClient` with `BEGIN`/`COMMIT`/`ROLLBACK`. Never rely on sequential `pool.query()` calls — they may go to different connections and provide zero transactional guarantees.

**This applies to:**
- Password reset (update password + invalidate sessions + reset lockout)
- Session rotation (revoke old session + create new session)
- Registration (create user + record legal consent + redeem invite code)
- Any multi-table write operation

```typescript
// CORRECT: Dedicated client with transaction
const client = await getPoolClient();
try {
  await client.query('BEGIN');
  await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
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
await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
// If the process crashes here, password is changed but sessions are still valid
```

### Rule 2: Never Display Server Error Messages to Users

All user-facing error messages MUST be curated client-side strings mapped from error codes. Never pass `err.message` or `error.message` from server responses directly into UI state. Server error messages are for developers, not clinicians.

```typescript
// CORRECT: Map error codes to curated messages
switch (err.code) {
  case 'invalid_credentials': setError('Invalid email or password.'); break;
  case 'trial_expired': setError('Your free trial has ended.'); break;
  default: setError('Something went wrong. Please try again.');
}

// WRONG: Display server message directly
setError(err.message || 'Failed to sign in');
```

**This applies to:** Every `catch` block in Client Components that displays errors to users, and every Server Action that returns error state.

### Rule 3: Always Validate Data from External Sources at Runtime

Use Zod `.parse()` or `.safeParse()` to validate:
- **Form data** in Server Actions before any DB access
- **URL query parameters** (reset tokens, verification tokens)
- **Webhook payloads** after signature verification
- **Cookie values** before trusting them
- **Data read from browser storage** before trusting it

Never use `as SomeType` to cast external data. TypeScript type assertions provide zero runtime safety.

```typescript
// CORRECT: Runtime validation
const result = schema.safeParse(Object.fromEntries(formData));
if (!result.success) {
  return { error: 'validation_error', fields: result.error.flatten().fieldErrors };
}

// WRONG: Trust-casting external data
const data = Object.fromEntries(formData) as UserInput;
```

### Rule 4: Clear PHI from Client State on Logout

When a user logs out, ALL of the following must occur:
- **Server-side**: Delete the session row from the database, clear the session cookie
- **Client-side**: Clear generated note content (SOAP notes), clear user input fields (quickNotes, patientContext), clear system clipboard (if SOAP content was copied), abort any in-flight requests

Do not rely on garbage collection. Set state variables to empty/null explicitly before unmounting.

### Rule 5: All Data Access MUST Go Through the DAL

The Data Access Layer (DAL) is the single point of authorization enforcement. This is the core HIPAA compliance mechanism — "which code path can access data?" has exactly one answer: the DAL.

**Requirements:**
- Server Components and Server Actions call DAL functions. Never import `db` or `pool` directly in pages, components, actions, or Route Handlers.
- Every DAL function that returns user-specific data takes a `sessionId` or `userId` and validates access. No "trust the caller" patterns.
- The DAL enforces authorization (does this user have access to this resource?) not just authentication (is there a valid session?).
- All SQL lives in the DAL layer. Pages and actions never construct queries.

```typescript
// CORRECT: Server Component calls DAL
import { getUser } from '@/server/dal/users';
import { getSession } from '@/server/dal/session';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = await getUser(session.userId);
  return <Dashboard user={user} />;
}

// WRONG: Page queries database directly
import { db } from '@/server/db';

export default async function DashboardPage() {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  // No session validation, no authorization, no audit trail
}
```

### Rule 6: Tests Must Exercise Real Security Mechanisms

Tests for security features must validate actual security behavior, not just verify that functions exist or return values. Specifically:

- **Rate limit tests** must verify that requests are actually blocked after the limit
- **Webhook tests** must verify signature validation rejects invalid signatures (don't mock `constructEvent` to always succeed)
- **Auth tests** must verify that invalid/expired sessions are rejected
- **DAL tests** must verify authorization — that user A cannot access user B's data
- **Never mock the exact mechanism you're testing** — if the test is "does session validation work?", the session logic must run, not be mocked

```typescript
// CORRECT: Test actual rate limiting behavior
it('blocks requests after limit exceeded', async () => {
  for (let i = 0; i < 5; i++) {
    await postLogin(creds);
  }
  const response = await postLogin(creds);
  expect(response.status).toBe(429);
});

// WRONG: Test that rate limiter exists
it('exports a rate limiter', () => {
  expect(typeof loginRateLimit).toBe('function');
});
```

### Rule 7: Error Messages MUST Be Generic in All Environments

Never return raw `err.message` in server responses, even in development or staging. Error details belong in server-side logs, not in HTTP responses or Server Action return values. Staging environments may contain realistic test data that includes PHI.

```typescript
// CORRECT: Always generic
return { success: false, error: { code: 'internal_error', message: 'An unexpected error occurred' } };

// WRONG: Leaking details in non-production
message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
```

### Rule 8: Server-Side Authorization Is Mandatory (Never Client-Only)

Every protected resource must be enforced on the server. Client-side auth checks are UX conveniences, not security controls.

**Authorization layers (in order of execution):**
1. **Next.js Proxy (`proxy.ts`)**: Reads session cookie, redirects unauthenticated users away from protected routes. This is an *optimistic UX check*, not a security boundary. The proxy intentionally avoids DB queries to stay fast.
2. **Server Components / Server Actions**: Call `getSession()` from the DAL, which validates the session against the database. This is the *real security gate*.
3. **DAL functions**: Enforce resource-level authorization (e.g., user can only access their own data, org members can only access their org's data).

**Specifically:**
- Protected pages must call `getSession()` and redirect if null — don't rely solely on the proxy
- Server Actions must validate the session before performing any operation
- Subscription-gated features must check subscription status server-side via the DAL
- Client-side `useAuth()` or similar hooks are for UI state only — never for security decisions

### Rule 9: Audit Logs Must Be in the Same Transaction as the Action

When an operation requires a HIPAA audit log entry, the audit write should be part of the same database transaction as the action it documents. If that's not possible (e.g., fire-and-forget for performance), the failure must be logged at `error` level with structured context so it surfaces in Cloud Error Reporting.

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

## Cloud Run Runtime Constraints

Next.js runs on Google Cloud Run as a containerized Node.js process. This is NOT a serverless-function-per-request model (like Vercel) — Cloud Run maintains long-lived container instances. However, some constraints still apply:

- **`pg.Pool` works normally.** Cloud Run containers are persistent processes. The singleton pool pattern from Express transfers unchanged. No serverless driver or connection pooler needed.
- **In-memory state is per-instance and ephemeral.** Cloud Run can scale to multiple instances and restart containers at any time. Never use module-level `Map`s or variables for state that must be shared across instances or survive restarts (e.g., rate limiting). Use Redis (Upstash) for shared ephemeral state.
- **Rate limiting must be Redis-backed.** Use Upstash `@upstash/ratelimit`. In-memory rate limiters would only apply to the single instance that receives the request — ineffective when scaled to multiple instances.
- **Proxy runs on Node.js runtime.** Next.js 16's `proxy.ts` runs on the Node.js runtime (not Edge). While Node.js modules like `pg` and `bcryptjs` are technically available, the proxy intentionally avoids DB queries — it only checks cookie existence for fast optimistic redirects. Full session validation (DB lookup, lockout check) happens in Server Components and Server Actions via the DAL.
- **Plan for container restarts.** Cloud Run may restart containers for updates, scaling, or health checks. Don't store durable state in memory. The database is the source of truth for all persistent state.

## Next.js Proxy Responsibilities

The proxy (`proxy.ts`) runs on every matched request on the Node.js runtime. Keep it fast and focused:

**Proxy DOES:**
- Generate CSP nonces and set `Content-Security-Policy` headers
- Read the session cookie and redirect unauthenticated users away from `/dashboard/*` (optimistic check — cookie exists and isn't expired)
- Allow public routes (`/`, `/login`, `/signup`, `/pricing`, `/terms`, `/privacy`, `/baa`, etc.) without auth checks

**Proxy does NOT:**
- Query the database (intentional — keeps proxy fast)
- Perform full session validation (that's the DAL's job)
- Act as a security boundary (it's a UX optimization layer)
- Handle CSRF (Server Actions handle this automatically; Route Handlers need explicit protection)

## Error Monitoring (GCP-Native)

**Visibility into production errors is critical.** Silent failures in healthcare software are unacceptable. All error monitoring uses GCP-native tooling: Pino structured logger → Cloud Logging → Cloud Error Reporting. No third-party error monitoring vendors.

Full setup plan: [docs/planning/MONITORING_SETUP.md](docs/planning/MONITORING_SETUP.md)

### Logging Stack

- **Server-side**: Pino structured logger with `@google-cloud/pino-logging-gcp-config`. Logs flow automatically to Cloud Logging. Cloud Error Reporting groups errors from structured `error`-level log entries.
- **Client-side**: `POST /api/telemetry` endpoint receives client errors, logs them server-side through the same Pino pipeline.
- **Next.js instrumentation**: `onRequestError` hook in `instrumentation.ts` captures unhandled Server Component/Action errors.

### When to Log at Error Level

Log at `error` level (which surfaces in Cloud Error Reporting) when:

1. **Revenue-critical operations fail** - Payment processing, checkout, subscription management, billing webhooks
2. **HIPAA compliance features fail** - Audit logging, authentication events, authorization failures
3. **Core product functionality fails** - LLM/AI service calls, note generation
4. **Security controls fail** - Account lockout, rate limiting, session validation, webhook signature verification
5. **External service integrations fail** - Email delivery, Stripe API, Gemini API
6. **Graceful error handling** - Any `catch` block that doesn't re-throw (errors that would otherwise be invisible)

**Rule of thumb:** If you catch an error and don't re-throw, log it at `error` level with structured context.

### What NOT to Log at Error Level

- **Expected client errors (4xx)** - Invalid input, missing auth, rate limits hit by users → `warn` level
- **Transient background operations** - Polling failures, optional refreshes that retry automatically → `warn` level
- **High-frequency expected conditions** - Rate limiting during normal operation → `info` level

### How to Log Errors

```typescript
import { logger } from '@/server/lib/logger';

try {
  await riskyOperation();
} catch (error) {
  logger.error({
    err: error,
    source: 'service_name',
    errorType: 'descriptive_type',
    userId: session.userId,           // Safe context (never PHI)
  }, 'Operation failed');
  // Handle gracefully or re-throw
}
```

### Structured Context Fields

**Safe to include:**

| Field | Examples |
|-------|----------|
| `source` | `'dal_auth'`, `'action_login'`, `'route_webhook'` |
| `errorType` | `'session_validation_failed'`, `'webhook_signature_invalid'` |
| `userId` | UUID |
| Resource IDs | `subscriptionId`, `sessionId` |
| `statusCode` | `500` |
| `durationMs` | `1234` |
| `retryCount` | `3` |

**Source naming convention** — `snake_case`:

| Component Type | Pattern | Examples |
|----------------|---------|----------|
| DAL modules | `dal_{name}` | `dal_auth`, `dal_users`, `dal_billing` |
| Server Actions | `action_{name}` | `action_login`, `action_generate_note` |
| Route Handlers | `route_{name}` | `route_webhook`, `route_health` |
| Proxy | `proxy` | `proxy` |
| Client libs | `client_{name}` | `client_auth_context` |

**NEVER include (PHI/PII):**

| Field | Why |
|-------|-----|
| Patient names, note content, diagnosis/treatment | PHI |
| Email addresses | PII (use `userId` instead) |
| Request/response bodies | May contain PHI |
| Full error messages from user input | May contain PHI |

### HIPAA Audit Log Retention

Cloud Logging log sink exports `audit_logs`-tagged entries to Cloud Storage with a 6-year locked retention policy (HIPAA requirement). This is separate from application-level `audit_logs` table — it's a defense-in-depth backup of the structured log stream.

## Reference Document

See `docs/reference/FLASHNOTE_HANDOFF.md` for complete project specification including:
- Full API documentation
- Database schema details
- PT-specific AI prompts
- HIPAA compliance checklist
- Deployment strategy

## Work Priorities

`docs/ROADMAP.md` is the single source of truth for what to work on and in what order. Work is organized into **dependency-ordered phases**:

- **Phase 0** (pre-migration foundations): HIPAA infrastructure, database schema hardening, prompt engineering, security audit triage
- **Phase 1** (Next.js migration): Infrastructure scaffold → DAL → sessions → auth → proxy → notes → billing → integration tests
- **Phase 2** (PHI storage): Patients, clinical notes, templates, versioning. Blocked on Phase 1 + HIPAA infra.
- **Phase 3** (quality & features): UI quality, testing, accessibility, monitoring, clinic features

When picking up work, start from the lowest incomplete phase. Don't jump to a later phase unless earlier phases are done or explicitly blocked on non-code dependencies (e.g., BAA signing).

## Documentation Guidelines

**Status tracking convention:**
- `docs/ROADMAP.md` — **single source of truth** for all code/technical task status
- `docs/PRE_LAUNCH_CHECKLIST.md` — business, legal, and ops tasks
- `docs/SUCCESS_METRICS.md` — quality gate criteria (pass/fail definitions, not task tracking)
- **Planning docs never track status** — they describe *what* to build; ROADMAP tracks *is it done*

**Before starting a task:**
1. Check `docs/ROADMAP.md` to understand current phase and priorities
2. Review relevant docs in `docs/` that may inform your approach:
   - `docs/guides/` - API reference and operational procedures
   - `docs/planning/` - Design specs and research (don't implement unless asked)
   - `docs/compliance/` - Security and testing requirements
   - `docs/reference/` - Project specifications

**After completing a task:**
1. Update `docs/ROADMAP.md` to mark the item done
2. Update any other docs affected by the changes
3. Move fully-implemented planning docs to `docs/archive/`

**Documentation principles:**
- Keep docs current — outdated docs are worse than no docs
- Single source of truth — task status lives in ROADMAP.md, not in planning docs
- Don't over-document — only document what provides ongoing value
- Prefer updating existing docs over creating new ones
- Archive completed work rather than deleting (for historical reference)

**What NOT to document:**
- Trivial implementation details obvious from the code
- Temporary debugging notes
- Duplicate information already in another doc
- Speculative features not discussed with the user

## Additional Rules
- Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
