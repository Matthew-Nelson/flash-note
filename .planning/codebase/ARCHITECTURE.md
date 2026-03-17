# Architecture

**Analysis Date:** 2026-03-16

## Pattern Overview

**Overall:** Integrated Next.js monolith with a strict layered architecture

**Key Characteristics:**
- Single Next.js 16 App Router application — no separate API server
- All DB access is funneled through a centralized Data Access Layer (DAL) as the sole HIPAA enforcement boundary
- Server Components handle data fetching; Client Components handle interactivity; Server Actions handle mutations
- Cookie-based opaque session tokens with SHA-256 hashing; session state lives entirely in the `sessions` DB table
- Every security-critical operation is wrapped in a PostgreSQL transaction to guarantee atomicity

## Layers

**Proxy (Middleware):**
- Purpose: Fast UX pre-flight on every matched request — CSP nonce injection + optimistic auth redirects
- Location: `web/src/proxy.ts`
- Contains: CSP header generation, session cookie existence check, redirect logic
- Depends on: Nothing (no DB queries, no service imports)
- Used by: Next.js middleware config; runs before every page and layout render
- **Not a security boundary** — full auth validation happens in Server Components via `getSession()`

**App Router (Pages and Layouts):**
- Purpose: Route definitions, server-side rendering, auth enforcement, streaming
- Location: `web/src/app/`
- Contains: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`, `route.ts`
- Depends on: DAL (via `getSession()`), components, server actions
- Used by: End users via browser

**Server Actions:**
- Purpose: Thin mutation handlers — validate input, call services, set cookies, return discriminated-union results
- Location: `web/src/actions/` (`auth.ts`, `notes.ts`, `billing.ts`)
- Contains: `'use server'` files grouped by domain
- Depends on: Zod schemas (`lib/schemas`), services (`server/services`), DAL (`server/dal`), server utilities (`server/lib`)
- Used by: Client Components (form submissions)
- Pattern: Validate → Rate-limit → Auth check → Business logic → Audit → Return `ActionResult<T>`

**Components:**
- Purpose: React UI — Server Components for display, Client Components for interaction
- Location: `web/src/components/`
- Contains: `ui/` primitives, `auth/` auth-specific UI, `notes/` note generation UI, shared layout components at root level
- Depends on: `lib/` for shared types and utilities; Server Actions for mutations
- Used by: Pages and layouts in `app/`

**Server Services:**
- Purpose: Business logic — orchestrate multi-step operations, enforce security rules
- Location: `web/src/server/services/`
- Contains: `auth.ts`, `billing.ts`, `email.ts`, `note-generation.ts`, `subscription.ts`, `token.ts`, `lockout.ts`, `audit.ts`, `llm/` (provider abstraction)
- Depends on: DAL (`server/dal`), server utilities (`server/lib`), external SDKs
- Used by: Server Actions and Route Handlers exclusively
- **Not called from Client Components** — `server-only` import enforces this at build time

**Data Access Layer (DAL):**
- Purpose: Single authorization enforcement point for all DB access — the HIPAA compliance boundary
- Location: `web/src/server/dal/` (`users.ts`, `sessions.ts`, `audit-logs.ts`, `usage.ts`, `email-tokens.ts`, `organizations.ts`, `organization-members.ts`, `legal-acceptances.ts`, `invite-codes.ts`, `webhooks.ts`, `health.ts`)
- Contains: All SQL queries, row-to-domain-type transforms, authorization checks
- Depends on: `server/db` (connection pool), `lib/types/database` (row types), `server/types` (domain types)
- Used by: Services and Server Actions; never imported directly by pages or components
- Pattern: `import 'server-only'` at top of every file; snake_case DB rows transform to camelCase domain types

**Database:**
- Purpose: PostgreSQL connection pool singleton and migration runner
- Location: `web/src/server/db/` (`index.ts`, `config.ts`, `migrate.ts`, `migrations/`)
- Contains: `pg.Pool` singleton, `getPoolClient()` for transactions, Zod-validated env config, SQL migration files
- Depends on: `pg` driver, environment variables
- Used by: DAL only

**Shared Utilities:**
- Purpose: Code shared between client and server — no Node.js APIs, no DB imports
- Location: `web/src/lib/`
- Contains: Zod schemas (`lib/schemas/`), TypeScript types (`lib/types/`), pure utilities (`lib/utils/`), Sentry sanitization
- Used by: Both server code and Client Components

**Server Utilities:**
- Purpose: Server-only cross-cutting concerns
- Location: `web/src/server/lib/`
- Contains: `get-session.ts`, `session-cookie.ts`, `rate-limit.ts`, `redis.ts`, `request-context.ts`, `request-utils.ts`, `validation.ts`, `prompt-sanitization.ts`, `invite-code-format.ts`
- Depends on: `server/db/config`, `server/dal/sessions`, external services (Redis)
- Used by: Services, Server Actions, layouts, pages

## Data Flow

**Authentication (Login):**

1. User submits login form (Client Component) → `loginAction` Server Action (`actions/auth.ts`)
2. Action validates input with Zod `loginSchema`
3. Action checks Redis rate limit via `checkRateLimit()` (`server/lib/rate-limit.ts`)
4. Action calls `login()` service (`server/services/auth.ts`)
5. Service calls `findUserByEmail()` DAL function; always runs `bcrypt.compare()` for timing safety
6. Service calls lockout checks via `lockout` service
7. Service calls `createSession()` DAL function — generates opaque UUID token, stores SHA-256 hash in DB
8. Action calls `setSessionCookie()` — writes opaque token to `httpOnly` cookie
9. Action fires audit log via `auditService.log()`
10. Action returns `ActionResult<{ user: SanitizedUser; emailVerificationRequired: boolean }>`
11. Client Component reads discriminated union result and maps error codes to display strings

**Note Generation:**

1. User submits form (Client Component) → `generateNoteAction` Server Action (`actions/notes.ts`)
2. Action validates input with Zod `generateNoteSchema`
3. Action calls `getSession()` — reads cookie, hashes token, looks up session+user in DB (deduped by `React.cache()`)
4. Action checks subscription access via `checkSubscriptionAccess()` (`server/services/subscription.ts`)
5. Action checks rate limit (IP:userId compound key)
6. Action calls `generateNote()` service (`server/services/note-generation.ts`)
7. Service detects prompt injection patterns, builds prompts, calls `getConfiguredProvider()` (cached singleton)
8. LLM provider (`GeminiProvider` or `ClaudeProvider`) makes API call with retry/backoff
9. Action calls `incrementUsage()` DAL function for token tracking
10. Action fires audit log (never logging note content — HIPAA)
11. Action strips model/token metadata from response before returning to client

**Session Validation (Every Protected Request):**

1. Page or layout renders (Server Component) → calls `getSession()` (`server/lib/get-session.ts`)
2. `getSession()` is `React.cache()`-wrapped — called multiple times per request, runs DB query only once
3. Reads raw token from cookie via `getSessionToken()`
4. SHA-256 hashes the token
5. Calls `findSessionByTokenHash()` DAL — JOIN sessions+users, checks expiry and soft-delete
6. Performs sliding window refresh if session is >50% elapsed
7. Returns `SessionData` (safe subset: no password hash, no lockout state) or `null`
8. Page redirects to `/login?reason=session_expired` if null

**Stripe Webhook:**

1. Stripe POSTs to `/api/webhooks/stripe` Route Handler
2. Handler reads raw body as `ArrayBuffer` (required for signature verification)
3. Handler calls `getBillingService().handleWebhook(body, signature)`
4. Billing service verifies Stripe signature
5. Service checks idempotency via `webhooks` DAL before processing
6. Service calls DAL to update subscription state, fires audit log
7. Handler returns 400 on signature failure (no retry), 500 on processing failure (Stripe retries)

**State Management:**
- All persistent state lives in PostgreSQL; no client-side state store
- Session state is in the `sessions` table — no JWT claims in cookies
- Client Components hold only ephemeral UI state (form input, loading flags, note display content)
- Rule 4: PHI (note content) must be cleared from client state on logout

## Key Abstractions

**`ActionResult<T>`:**
- Purpose: Discriminated union return type for all Server Actions
- Definition: `web/src/lib/types/actions.ts`
- Pattern: `{ success: true; data: T }` or `{ success: false; error: string; fieldErrors?: ... }`
- Never throw expected errors from Server Actions — return error codes. Unexpected errors throw to `error.tsx`

**`SessionData`:**
- Purpose: Safe session payload returned by `getSession()` — no sensitive fields
- Definition: `web/src/server/types.ts`
- Contains: `sessionId`, `userId`, `email`, `subscriptionStatus`, `trialEndsAt`, `emailVerified`, `organizationId`
- Pattern: Every protected Server Component and Server Action calls `getSession()` and redirects on null

**`LLMProvider` Interface:**
- Purpose: Unified interface for LLM providers with built-in retry/backoff
- Definition: `web/src/server/services/llm/provider.ts`
- Implementations: `GeminiProvider` (`llm/gemini-provider.ts`), `ClaudeProvider` (`llm/claude-provider.ts`)
- Pattern: `getConfiguredProvider()` in `llm/provider-factory.ts` returns a cached singleton

**DAL Row Transforms:**
- Purpose: Convert snake_case DB rows to camelCase domain types at the DAL boundary
- Pattern: Each DAL file defines a private `rowToX()` function; DB columns are never exposed outside the DAL
- Example: `web/src/server/dal/users.ts:25` — `rowToUser(row: UserRow): User`

**Database Transactions:**
- Purpose: Atomicity for multi-step security operations (Rule 1)
- Pattern: `getPoolClient()` → `BEGIN` → operations → `COMMIT`/`ROLLBACK` → `client.release()`
- Used for: Registration, password reset, email verification, session creation with limit enforcement
- DAL functions accept optional `pg.PoolClient` parameter to participate in caller-owned transactions

## Entry Points

**Next.js Application:**
- Location: `web/src/app/layout.tsx`
- Triggers: All web requests
- Responsibilities: Root HTML shell, Plus Jakarta Sans font, CSP nonce via `headers()`, skip-nav link, `ErrorBoundary`

**Proxy (Middleware):**
- Location: `web/src/proxy.ts`
- Triggers: All non-static, non-API requests (configured via `config.matcher`)
- Responsibilities: CSP nonce generation + header injection, optimistic auth redirects, stale cookie clearing on `?reason=` params

**Dashboard Layout:**
- Location: `web/src/app/dashboard/layout.tsx`
- Triggers: Any request to `/dashboard/*`
- Responsibilities: Session validation (real security gate), email verification gate, renders `DashboardShell`

**Stripe Webhook:**
- Location: `web/src/app/api/webhooks/stripe/route.ts`
- Triggers: POST from Stripe
- Responsibilities: Raw body preservation, signature verification delegation, HTTP status mapping

**Cleanup Job:**
- Location: `web/src/app/api/cleanup/webhook-events/route.ts`
- Triggers: Cloud Scheduler (authenticated with `CLEANUP_SECRET`)
- Responsibilities: Expired session and stale webhook event cleanup

**Instrumentation:**
- Location: `web/src/instrumentation.ts`
- Triggers: Next.js startup
- Responsibilities: Sentry initialization for Node.js and edge runtimes; `onRequestError` hook for unhandled Server Component/Action errors

## Error Handling

**Strategy:** Fail-closed. DB errors → null session → redirect to login. Expected errors return codes, not messages. Unexpected errors throw to `error.tsx` boundaries.

**Patterns:**
- Server Actions return `{ success: false, error: 'error_code' }` for expected errors (validation, auth, rate limits)
- Server Actions only `throw` for genuinely unexpected errors (these surface via `error.tsx`)
- `getSession()` fails closed — any exception returns `null`, user redirected to login
- LLM errors are caught in `generateNoteAction` and mapped to client-safe error codes via `mapLLMErrorCode()`
- `auditService.log()` swallows errors (fire-and-forget) so audit failures never break operations
- `auditService.logWithClient()` propagates errors (transactional — part of the same commit)
- Client Components map error codes to curated display strings — never display `err.message` (Rule 2)

## Cross-Cutting Concerns

**Logging:** `console.error()` / `console.warn()` currently; Pino migration planned but not yet implemented. Structured context fields used in all log calls. PHI is never logged.

**Validation:** Zod schemas in `web/src/lib/schemas/` (shared client+server). Server Actions call `.safeParse()` on all `FormData` before any DB access. Route Handlers validate webhook payloads after signature verification. Never use TypeScript `as` casts on external data.

**Authentication:** `getSession()` is the single auth gate. Wraps cookie read → hash → DB lookup → sliding-window refresh. `React.cache()` deduplicates within a request. Every protected page and layout calls it; every Server Action calls it before doing anything sensitive.

**HIPAA Audit:** `auditService` (`web/src/server/services/audit.ts`) wraps `insertAuditLog`/`insertAuditLogWithClient` from the DAL. All auth events, note generation, subscription changes, and access denials are logged. Note content is never in audit metadata.

**Rate Limiting:** Upstash Redis (`@upstash/ratelimit`) sliding window limiters defined in `web/src/server/lib/rate-limit.ts`. Compound keys (IP:email for login, IP:userId for generation) prevent bypass. No-ops gracefully when Redis is unavailable (dev/test).

---

*Architecture analysis: 2026-03-16*
