# Codebase Structure

**Analysis Date:** 2026-03-16

## Directory Layout

```
flash-note/
├── web/                        # The entire application (Next.js)
│   ├── src/
│   │   ├── app/                # Next.js App Router — pages, layouts, API routes
│   │   ├── actions/            # Server Actions grouped by domain
│   │   ├── components/         # React components (shared UI)
│   │   ├── lib/                # Shared utilities (client + server safe)
│   │   ├── server/             # Server-only code (enforced by 'server-only')
│   │   ├── test/               # Test setup, helpers, factories, integration tests
│   │   ├── proxy.ts            # Next.js middleware (CSP + optimistic auth)
│   │   ├── proxy.test.ts       # Proxy unit tests
│   │   ├── instrumentation.ts  # Sentry initialization hook
│   │   └── instrumentation-client.ts  # Sentry client-side init
│   ├── scripts/                # Build/dev utility scripts
│   ├── public/                 # Static assets (favicon, icons)
│   ├── design-system/          # Tailwind preset and design tokens
│   └── package.json
├── docs/                       # Project documentation
│   ├── ROADMAP.md              # Single source of truth for task status
│   ├── planning/               # Design specs and research
│   ├── compliance/             # Security and HIPAA requirements
│   ├── guides/                 # API reference and operational procedures
│   ├── reference/              # Project specifications (FLASHNOTE_HANDOFF.md)
│   └── archive/                # Completed planning docs
└── .planning/                  # GSD planning documents (this directory)
    └── codebase/
```

## Directory Purposes

**`web/src/app/`:**
- Purpose: All Next.js App Router routes — pages, layouts, error boundaries, API handlers
- Contains: `page.tsx` (Server Components), `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts` (API)
- Key files:
  - `web/src/app/layout.tsx` — root layout (font, CSP, skip-nav, ErrorBoundary)
  - `web/src/app/global-error.tsx` — fatal error boundary (outside root layout)
  - `web/src/app/error.tsx` — root error boundary
  - `web/src/app/dashboard/layout.tsx` — session gate + email verification gate
  - `web/src/app/dashboard/page.tsx` — KPI dashboard (usage stats, trial banner)
  - `web/src/app/dashboard/notes/new/page.tsx` — note generation page
  - `web/src/app/api/webhooks/stripe/route.ts` — Stripe webhook handler
  - `web/src/app/api/health/route.ts` — health check endpoint
  - `web/src/app/api/cleanup/webhook-events/route.ts` — Cloud Scheduler cleanup job

**`web/src/app/` Route Groups:**
- `app/login/`, `app/signup/`, `app/forgot-password/`, `app/reset-password/`, `app/verify-email/`, `app/resend-verification/`, `app/check-email/` — Auth pages (flat, no route group prefix)
- `app/pricing/`, `app/terms/`, `app/privacy/`, `app/baa/` — Public marketing/legal pages
- `app/dashboard/` — All protected routes; layout enforces session
- `app/dashboard/settings/` — User settings, password reset, account deletion
- `app/dashboard/notes/new/` — Note generation form
- `app/dashboard/patients/`, `app/dashboard/templates/` — Stub pages (roadmap items)

**`web/src/actions/`:**
- Purpose: Server Actions (`'use server'`) grouped by domain; thin wrappers around services
- Key files:
  - `web/src/actions/auth.ts` — login, register, logout, password reset, email verification, invite code validation
  - `web/src/actions/notes.ts` — `generateNoteAction` (auth → subscription → rate limit → LLM → usage → audit)
  - `web/src/actions/billing.ts` — Stripe checkout, billing portal

**`web/src/components/`:**
- Purpose: Shared React components; co-located `.test.tsx` files
- Key files:
  - `web/src/components/DashboardShell.tsx` — Client Component; provides `SidebarContext` so TopBar hamburger works across Server/Client boundary
  - `web/src/components/Sidebar.tsx` — Nav sidebar with active state via `usePathname()`
  - `web/src/components/TopBar.tsx` — Page-level top bar with hamburger trigger
  - `web/src/components/MarketingNav.tsx` — Public site nav with mobile hamburger
  - `web/src/components/Footer.tsx` — Marketing footer
  - `web/src/components/BetaBadge.tsx` — Beta badge shared between marketing and auth pages
  - `web/src/components/ErrorBoundary.tsx` — React error boundary component

**`web/src/components/ui/`:**
- Purpose: Primitive UI components — no business logic
- Contains: `Button.tsx`, `Card.tsx`, `Input.tsx`, `Alert.tsx`, `Badge.tsx`, `Spinner.tsx`, `SubscriptionBadge` (via `index.ts`)
- Export pattern: barrel file at `web/src/components/ui/index.ts`

**`web/src/components/auth/`:**
- Purpose: Auth-specific UI components
- Contains: `AuthLayout.tsx`, `LogoutButton.tsx`, `PasswordResetSection.tsx`, `SessionAlert.tsx`
- Export pattern: barrel file at `web/src/components/auth/index.ts`

**`web/src/components/notes/`:**
- Purpose: Note generation UI
- Contains: `NoteGenerationForm.tsx` (step indicator, modality/duration, patient stub), `GeneratedNote.tsx` (SOAP cards, inline editing, rating widget, Copy All)
- Export pattern: barrel file at `web/src/components/notes/index.ts`

**`web/src/lib/`:**
- Purpose: Client-and-server-safe code — no DB imports, no Node.js-only APIs
- Key files:
  - `web/src/lib/schemas/auth.ts` — Zod schemas for all auth forms (source of truth for password policy)
  - `web/src/lib/schemas/notes.ts` — Zod schema for note generation form
  - `web/src/lib/schemas/index.ts` — barrel export
  - `web/src/lib/types/actions.ts` — `ActionResult<T>` discriminated union
  - `web/src/lib/types/database.ts` — DB row interfaces (snake_case, matching PostgreSQL columns exactly)
  - `web/src/lib/types/client.ts` — Client-safe type definitions
  - `web/src/lib/types/index.ts` — Shared type definitions (`SubscriptionStatus`, `OrgRole`, `NoteType`, etc.)
  - `web/src/lib/utils/redirect-validation.ts` — Safe redirect URL validation
  - `web/src/lib/sentry-sanitization.ts` — PHI scrubbing for Sentry event data

**`web/src/server/`:**
- Purpose: Everything server-only; all files start with `import 'server-only'`
- Importing any file from this directory in a Client Component is a build error

**`web/src/server/dal/`:**
- Purpose: All SQL — the HIPAA compliance boundary and sole authorization enforcement point
- Key files:
  - `web/src/server/dal/users.ts` — User CRUD, lockout management, soft-delete
  - `web/src/server/dal/sessions.ts` — Session lifecycle (create, lookup, refresh, delete, cleanup, device binding)
  - `web/src/server/dal/audit-logs.ts` — Immutable audit log inserts
  - `web/src/server/dal/usage.ts` — Monthly token/note usage tracking
  - `web/src/server/dal/email-tokens.ts` — Email verification and password reset tokens
  - `web/src/server/dal/invite-codes.ts` — Invite code lookup and redemption
  - `web/src/server/dal/organizations.ts` — Clinic/team management
  - `web/src/server/dal/organization-members.ts` — Org membership with soft-delete
  - `web/src/server/dal/legal-acceptances.ts` — ToS/BAA consent records
  - `web/src/server/dal/webhooks.ts` — Stripe webhook idempotency
  - `web/src/server/dal/health.ts` — DB health check query
  - `web/src/server/dal/index.ts` — Barrel export

**`web/src/server/db/`:**
- Purpose: Database infrastructure
- Key files:
  - `web/src/server/db/index.ts` — Singleton `pg.Pool` with HMR-safe caching, graceful SIGTERM drain, `getPoolClient()`
  - `web/src/server/db/config.ts` — Zod-validated env config (all env vars parsed here at startup), security constants, session timing constants
  - `web/src/server/db/migrate.ts` — Migration runner
  - `web/src/server/db/migrations/001_initial_schema.sql` — All 11 tables

**`web/src/server/services/`:**
- Purpose: Business logic layer between actions and DAL
- Key files:
  - `web/src/server/services/auth.ts` — `login()`, `register()` (transaction), `verifyEmail()`, `completePasswordReset()`
  - `web/src/server/services/note-generation.ts` — Prompt building, injection detection, LLM orchestration, mock support
  - `web/src/server/services/billing.ts` — Stripe checkout, portal, webhook event handling
  - `web/src/server/services/email.ts` — Email delivery (Resend SDK; dev-mode logs to console)
  - `web/src/server/services/token.ts` — Email verification and password reset token lifecycle
  - `web/src/server/services/lockout.ts` — Account lockout status checks and failed attempt recording
  - `web/src/server/services/subscription.ts` — `checkSubscriptionAccess()` — validates trial/active status
  - `web/src/server/services/audit.ts` — `AuditService` with `log()` (fire-and-forget) and `logWithClient()` (transactional)

**`web/src/server/services/llm/`:**
- Purpose: LLM provider abstraction with retry logic
- Key files:
  - `web/src/server/services/llm/provider.ts` — `LLMProvider` interface and `BaseLLMProvider` abstract class (retry/backoff)
  - `web/src/server/services/llm/provider-factory.ts` — `getConfiguredProvider()` (cached singleton), `createLLMProvider()`
  - `web/src/server/services/llm/gemini-provider.ts` — Google Gemini/Vertex AI implementation
  - `web/src/server/services/llm/claude-provider.ts` — Anthropic Claude implementation (dev/test only)
  - `web/src/server/services/llm/schemas.ts` — Zod schemas for LLM structured output validation
  - `web/src/server/services/llm/errors.ts` — `LLMError` hierarchy (`RateLimitError`, `ContentBlockedError`, `TimeoutError`, `NetworkError`)
  - `web/src/server/services/llm/types.ts` — `PTNoteResult`, `LLMRequestConfig`, `LLMRetryConfig`
  - `web/src/server/services/llm/index.ts` — Barrel export

**`web/src/server/lib/`:**
- Purpose: Server-only cross-cutting utilities
- Key files:
  - `web/src/server/lib/get-session.ts` — `getSession()` (React.cache-wrapped); reads cookie → hash → DB lookup → sliding refresh
  - `web/src/server/lib/session-cookie.ts` — `setSessionCookie()`, `getSessionToken()`, `clearSessionCookie()`, `hashSessionToken()`
  - `web/src/server/lib/rate-limit.ts` — All rate limiter instances (login, register, generate, checkout, etc.)
  - `web/src/server/lib/redis.ts` — Upstash Redis client singleton
  - `web/src/server/lib/request-context.ts` — `getRequestContext()` — IP extraction (TRUSTED_PROXY_COUNT-aware) and User-Agent
  - `web/src/server/lib/request-utils.ts` — IP address sanitization
  - `web/src/server/lib/validation.ts` — `sanitizeFieldErrors()` — strips PHI from Zod field errors before returning to client
  - `web/src/server/lib/prompt-sanitization.ts` — Injection pattern detection and XML delimiter wrapping for prompts
  - `web/src/server/lib/invite-code-format.ts` — Invite code formatting utilities

**`web/src/server/prompts/`:**
- Purpose: LLM prompt templates for PT SOAP note generation
- Key files:
  - `web/src/server/prompts/pt-prompts.ts` — `getSystemPrompt()`, `buildUserPrompt()`; includes PT shorthand disambiguation, structured output instructions

**`web/src/test/`:**
- Purpose: Shared test infrastructure
- Key files:
  - `web/src/test/setup.ts` — Vitest global setup (mocks, cleanup)
  - `web/src/test/helpers.ts` — General test utilities
  - `web/src/test/dal-helpers.ts` — `mockDbQuery`, `mockClientQuery`, `setupMockClient`, `createMockUserRow`, `createMockEmailTokenRow`
  - `web/src/test/integration/auth-lifecycle.test.ts` — Full auth flow integration tests
  - `web/src/test/integration/note-generation-access.test.ts` — Note generation access control tests

## Key File Locations

**Entry Points:**
- `web/src/proxy.ts` — Middleware (runs first on every request)
- `web/src/app/layout.tsx` — Root HTML document
- `web/src/app/dashboard/layout.tsx` — Session gate for all dashboard routes
- `web/src/instrumentation.ts` — Sentry initialization at startup

**Configuration:**
- `web/src/server/db/config.ts` — All environment variables (Zod-validated, fails fast on startup)
- `web/package.json` — Dependencies and scripts
- `web/tsconfig.json` — TypeScript config (strict mode)
- `web/vitest.config.ts` — Test runner config

**Core Business Logic:**
- `web/src/server/services/auth.ts` — Login, register, password reset (all with transactions)
- `web/src/server/services/note-generation.ts` — SOAP note generation pipeline
- `web/src/server/services/billing.ts` — Stripe integration

**Session Lifecycle:**
- `web/src/server/lib/get-session.ts` — Session validation (called by every protected page/action)
- `web/src/server/lib/session-cookie.ts` — Cookie I/O (set, get, clear, hash)
- `web/src/server/dal/sessions.ts` — DB-level session operations

**Type Definitions:**
- `web/src/server/types.ts` — Server-side domain types (`User`, `SessionData`, `AuditAction`, `AuditLogEntry`)
- `web/src/lib/types/database.ts` — DB row types (snake_case, exact column mapping)
- `web/src/lib/types/actions.ts` — `ActionResult<T>` discriminated union

**Testing:**
- `web/src/test/dal-helpers.ts` — DAL mock factory functions
- `web/src/test/setup.ts` — Test environment setup

## Naming Conventions

**Files:**
- TypeScript source: `kebab-case.ts` (e.g., `get-session.ts`, `rate-limit.ts`, `note-generation.ts`)
- React components: `PascalCase.tsx` (e.g., `DashboardShell.tsx`, `NoteGenerationForm.tsx`)
- Test files: `*.test.ts` or `*.test.tsx` (co-located with the file under test)
- App Router: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts` (Next.js convention)

**Directories:**
- Lowercase kebab-case for all directories (e.g., `note-generation/`, `dal/`, `llm/`)
- No route groups in App Router (flat auth pages, not grouped under `(auth)/`)

**TypeScript:**
- Domain types: camelCase fields (e.g., `userId`, `subscriptionStatus`, `trialEndsAt`)
- DB row types: snake_case fields matching column names exactly (e.g., `user_id`, `subscription_status`)
- Enums: SCREAMING_SNAKE_CASE for values (`AuditAction.LOGIN_FAILED`)
- Interfaces: PascalCase names (`SessionData`, `ActionResult`, `LLMProvider`)

**Path Aliases:**
- `@/` maps to `web/src/` (configured in `tsconfig.json`)
- Always use `@/` aliases, never relative paths for cross-directory imports

## Where to Add New Code

**New Protected Page:**
- Implementation: `web/src/app/dashboard/{route-name}/page.tsx` (Server Component)
- Test: `web/src/app/dashboard/{route-name}/page.test.tsx`
- Add `loading.tsx` for streaming skeleton if the page has async data fetching

**New Server Action:**
- If auth domain: `web/src/actions/auth.ts`
- If notes domain: `web/src/actions/notes.ts`
- If billing domain: `web/src/actions/billing.ts`
- New domain: `web/src/actions/{domain}.ts`
- Test: `web/src/actions/{domain}.test.ts`

**New DAL Function:**
- Add to the relevant existing DAL file (e.g., user queries → `web/src/server/dal/users.ts`)
- New table: create `web/src/server/dal/{table-name}.ts`, add `export *` to `web/src/server/dal/index.ts`
- Add row type to `web/src/lib/types/database.ts`
- Test: co-located `web/src/server/dal/{table-name}.test.ts`

**New Service:**
- Location: `web/src/server/services/{service-name}.ts`
- Test: `web/src/server/services/{service-name}.test.ts`
- Services must `import 'server-only'` at the top

**New Shared Component:**
- UI primitive: `web/src/components/ui/{ComponentName}.tsx` + export from `web/src/components/ui/index.ts`
- Auth component: `web/src/components/auth/{ComponentName}.tsx`
- Notes component: `web/src/components/notes/{ComponentName}.tsx`
- Shared layout component: `web/src/components/{ComponentName}.tsx`

**New Shared Type:**
- Client-safe type: `web/src/lib/types/index.ts` or `web/src/lib/types/client.ts`
- Server-only type: `web/src/server/types.ts`
- DB row type: `web/src/lib/types/database.ts`

**New Zod Schema:**
- Auth-related: `web/src/lib/schemas/auth.ts`
- Notes-related: `web/src/lib/schemas/notes.ts`
- New domain: `web/src/lib/schemas/{domain}.ts` + re-export from `web/src/lib/schemas/index.ts`

**New Database Migration:**
- Location: `web/src/server/db/migrations/` with sequentially numbered prefix (e.g., `002_add_patients.sql`)
- Update `web/src/lib/types/database.ts` with new row types

**New Environment Variable:**
- Add to `envSchema` in `web/src/server/db/config.ts` with Zod validation
- Add production constraints if needed (see existing `superRefine` checks)

## Special Directories

**`web/.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No

**`web/coverage/`:**
- Purpose: Vitest coverage reports
- Generated: Yes
- Committed: No

**`web/design-system/`:**
- Purpose: Tailwind CSS preset and design tokens (`fn-` prefixed design system)
- Generated: No
- Committed: Yes

**`web/public/`:**
- Purpose: Static files served at root (favicon, icons, apple-touch-icon)
- Generated: No
- Committed: Yes

**`docs/archive/`:**
- Purpose: Fully-implemented planning documents moved here after completion
- Generated: No
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: GSD codebase mapping documents consumed by `/gsd:plan-phase` and `/gsd:execute-phase`
- Generated: By `/gsd:map-codebase` agent
- Committed: Yes

---

*Structure analysis: 2026-03-16*
