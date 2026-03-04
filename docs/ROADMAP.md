# FlashNote Development Roadmap

**Last Updated:** March 3, 2026

This is the **single source of truth** for all technical work status.

- Each task appears in exactly one place — here for code/technical work, [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) for business/legal/ops.
- Quality gate criteria (pass/fail definitions) live in [SUCCESS_METRICS.md](./SUCCESS_METRICS.md).
- Planning specs and reference docs never track status — they describe *what* to build, this doc tracks *is it done*.

---

## Dashboard

Work is organized into phases by dependency order. Complete each phase before starting the next; items within a phase can be parallelized.

| Phase | Track | Progress | Next Action |
|-------|-------|----------|-------------|
| **0** | [Pre-Migration Foundations](#phase-0-pre-migration-foundations) | 20/20 | All code items done; HIPAA ops (encryption, TLS) verified at provisioning |
| **1** | [Next.js Migration](#phase-1-nextjs-migration) | 9/9 sub-phases | All sub-phases complete |
| **—** | [UI Overhaul](#ui-overhaul-refined-teal) | 1/5 sub-phases | UI-2: Layout Shell + Sidebar |
| **—** | [Deployment Readiness](#deployment-readiness) | 0/7 steps | Monitoring PR 1 (Pino Logger) |
| **2** | [PHI Storage](#phase-2-phi-storage) | Designed, 0/3 PRs | Blocked on deployment readiness + HIPAA infra |
| **3** | [Quality & Features](#phase-3-quality--features) | Partial | Post-launch (testing, accessibility, clinic features) |
| — | [Business / Legal / Ops](./PRE_LAUNCH_CHECKLIST.md) | ~20% | Form LLC |

**Why this order:**
- **Phase 0** handles infrastructure and framework-agnostic fixes that apply regardless of the migration. Unblocks the Google Cloud BAA and hardens the database schema. No wasted work — everything here transfers.
- **Phase 1** is the architectural pivot. Express backend and Chrome extension are removed; everything consolidates into a single Next.js app on Cloud Run. This is the largest body of work and the foundation for everything after.
- **UI Overhaul** happens before deployment so beta users see the professional Refined Teal design from day one. Design system migration, sidebar layout, WCAG AA compliance. Features stubbed as "coming soon" until Phase 2 backend lands.
- **Deployment Readiness** is the bridge between "code passes tests locally" and "app is live and accepting users." Monitoring, pipeline hardening, infrastructure provisioning, staging verification, and Stripe live mode — everything needed to go from code-complete to production.
- **Phase 2** is the competitive pivot — patients, notes, templates. Blocked on deployment readiness and HIPAA infrastructure.
- **Phase 3** is important but non-differentiating. Testing, accessibility, clinic features — all scoped to the new architecture and sequenced after the app is live.

### Architecture Decision

FlashNote is consolidating from three components (Express backend + Chrome extension + Next.js web app) to a **single Next.js application** deployed on Google Cloud Run. Full analysis and rationale: [planning/NEXTJS_MIGRATION_PLAN.md](./archive/planning/NEXTJS_MIGRATION_PLAN.md)

**Key decisions:**
- Pure Next.js with Data Access Layer (DAL) — single codebase, single authorization point
- All-Google infrastructure (Cloud Run + Cloud SQL + Vertex AI) — one BAA, one vendor
- Opaque session tokens in httpOnly cookies (not JWT)
- Extension sunset — web app is the only client

---

## Phase 0: Pre-Migration Foundations

Framework-agnostic work that applies regardless of the migration. Do this now.

### HIPAA Infrastructure (Ops)

> **Regulatory Context:** The HITECH Act makes FlashNote directly liable for HIPAA violations as a Business Associate, with penalties up to $2.1M/year per violation category.

| # | Item | Type | Status |
|---|------|------|--------|
| 1 | **Sign Google Cloud BAA** — covers Cloud Run, Cloud SQL, Vertex AI | Ops | ✅ Done |
| 2 | **Database encryption at rest** — Cloud SQL default; verify during Phase 1.0 provisioning | Ops | ⏳ Pending provisioning (Cloud SQL encrypts at rest by default) |
| 3 | **TLS 1.2+ enforced on all connections** — set `require_ssl = true` during Phase 1.0 Cloud SQL provisioning | Ops | ⏳ Pending provisioning (configure at provisioning) |
| 4 | **Audit log immutability protections** — database triggers prevent UPDATE/DELETE/TRUNCATE on `audit_logs` (migration 012) | Code | ✅ Done |
| 5 | **Breach notification / incident response procedure** — [INCIDENT_RESPONSE_PLAN.md](./compliance/INCIDENT_RESPONSE_PLAN.md) | Docs | ✅ Done |
| 6 | BAA acceptance in signup flow (backend) | Code | ✅ Done |

> Items that require new code in the Next.js architecture (audit retention automation, `/baa` page, legal re-acceptance flow) are deferred to Phase 1 where they'll be built on the new stack.

### Database Schema Hardening

Surviving HIGH findings from the security audit. These are pure SQL migrations — apply to the current database, transfer unchanged.

| ID | Finding | Fix | Status |
|----|---------|-----|--------|
| H-11 | `subscription_status` missing CHECK constraint on `users` table | Add CHECK constraint matching `organizations` pattern | ✅ Done (migration 013) |
| H-13 | `markCodeAsUsed` doesn't set `is_active = FALSE` | Add `is_active = FALSE` to UPDATE | ✅ Done (migration 014) |
| H-18 | CASCADE DELETE on `sessions` and `usage` — HIPAA data retention risk | Change to ON DELETE RESTRICT, implement soft-delete for users | ✅ Done (migration 015) |

### Prompt Engineering

Full research: [planning/PROMPT_ENGINEERING_RESEARCH.md](./planning/PROMPT_ENGINEERING_RESEARCH.md)

Framework-agnostic changes — prompt templates and LLM config transfer directly to the new architecture.

#### P0 — Do Now

| Change | Effort | Status |
|--------|--------|--------|
| Lower temperature from 0.7 → 0.2 | Config change | ✅ Done |
| Move system prompt to `systemInstruction` (Gemini) / `system` (Claude) field | Moderate refactor | ✅ Done |
| Fix H-16: Escape XML delimiter tags in user content (prompt injection) | Code change | ✅ Done |

#### P1 — Do Soon

| Change | Effort | Status |
|--------|--------|--------|
| Add sandwich defense (repeat security rules after user content) | Small prompt edit | ✅ Done (included in systemInstruction refactor) |
| Inject PT abbreviation reference into prompts | Prompt addition | ✅ Done |
| Add `uncertainAreas` to output schema | Schema + prompt update | ✅ Done |

#### P2-P3 — Defer to Post-Migration

| Change | Effort | Status |
|--------|--------|--------|
| Configure Gemini safety settings explicitly | Small API change | ❌ |
| Post-generation validation for hallucinated numbers | New validation fn | ❌ |
| Template-level style preferences (concise/narrative/detailed) | Feature work | ❌ |

> Note: "Add input length limits" (already enforced by Zod — `quickNotes` max 5000, `patientContext` max 500) and "Structured input hints in extension UI" (extension removed) are dropped from the roadmap.

### Security Audit Triage

Full audit: [compliance/CONSOLIDATED_AUDIT_2026_02.md](./compliance/CONSOLIDATED_AUDIT_2026_02.md) — 69 findings across 7 planned remediation PRs.

#### CRITICALs (All Resolved)

| ID | Finding | Status |
|----|---------|--------|
| CR-1 | Webhook idempotency marks before processing | ✅ Done (`63b3d10`) |
| CR-2 | Refresh token rotation race condition | ✅ Done (`af50b29`) |
| CR-3 | Missing `trust proxy` | ✅ Done (`44319a8`) |
| CR-4 | No security headers in web app | ✅ Done (`81e6988`) |
| CR-5 | Password reset not atomic | ✅ Done (`af50b29`) |

#### HIGH Findings — Post-Migration Disposition

| ID | Finding | Disposition |
|----|---------|-------------|
| H-1 | Stripe price validation bypass | ✅ Done (`63b3d10`) |
| H-2 | No server-side duplicate subscription check | ✅ Done (`63b3d10`) |
| H-3 | Webhook out-of-order reactivation | ✅ Done (`63b3d10`) |
| H-4 | Email logged in audit metadata | ✅ Done (`af50b29`) |
| H-5 | API responses not validated (extension + web) | 🔄 Extension: moot. Web: resolved by architecture (DAL validation) |
| H-6 | Storage data read without validation (extension + web) | 🔄 Extension: moot. Web: resolved by architecture (cookies, not sessionStorage) |
| H-7 | Token creation non-atomic | ✅ Done (`af50b29`) |
| H-8 | PHI not cleared on logout (extension) | 🗑️ Moot — extension removed |
| H-9 | Token refresh race condition (extension) | 🗑️ Moot — no client-side token refresh in new architecture |
| H-10 | Error handler returns raw err.message | ✅ Done (`44319a8`) |
| H-11 | Missing CHECK constraint on subscription_status | ✅ Done (migration 013) |
| H-12 | Non-null assertions on query results | ❌ Fix during Phase 1.1 (DAL foundation) |
| H-13 | Invite code doesn't deactivate | ✅ Done (migration 014) |
| H-14 | No graceful shutdown | ✅ Done. SIGTERM/SIGINT handler drains DB pool with 5s timeout. `NEXT_MANUAL_SIG_HANDLE=true` in Dockerfile. |
| H-15 | No process-level error handlers | ✅ Done (`44319a8`). Next.js instrumentation hook (`onRequestError`) handles this. |
| H-16 | XML delimiter not escaped (prompt injection) | ✅ Done (escapeDelimiterTags + detection patterns) |
| H-17 | Backend errors displayed to users (extension) | 🗑️ Moot — extension removed |
| H-18 | CASCADE DELETE on sessions/usage | ✅ Done (migration 015) |

#### MEDIUM/LOW Findings

Previously resolved: M-2, M-26 (`af50b29`), M-3 (`44319a8`), M-5, M-6 (`63b3d10`), M-7, M-8, M-10, M-11, M-23 (`81e6988`).

##### Resolved by Removal — Extension Removed (10 findings)

| ID | Finding | Notes |
|----|---------|-------|
| M-12 | PHI persists in clipboard | Extension sidepanel component |
| M-13 | No React error boundary in extension | Extension UI |
| M-14 | Content script monkey-patches history API | Extension content script |
| M-15 | Service worker state loss on restart | Extension service worker |
| M-16 | Missing origin validation on runtime messages | Extension service worker |
| M-17 | `web_accessible_resources` enables fingerprinting | Extension manifest |
| M-18 | No AbortController for in-flight requests on logout | Extension component |
| L-9 | Dev CORS allows any Chrome extension | No extension, no extension CORS |
| L-16 | Extension localhost in production content_scripts | Extension manifest |
| L-17 | Extension hardcoded version string | Extension UI |

##### Resolved by Migration — Express/Sentry/CI Replaced (11 findings)

| ID | Finding | Why Resolved |
|----|---------|-------------|
| M-1 | Rate limiting IP-only | Upstash compound keying (IP + email/userId) in Phase 1.2 |
| M-4 | Email verification middleware bypasses error handler | Express middleware → Server Actions with standard error handling |
| M-21 | Migration 009 not idempotent | Migrations squashed into single schema in Phase 1.1 |
| M-24 | PHI sanitization relies on field-name heuristics | Sentry removed → GCP Cloud Logging with allowlist approach |
| M-28 | E2E workflow exposes secrets at global `env` level | CI workflows rewritten for Cloud Run deployment |
| L-1 | Missing rate limit on validate-reset-token | Upstash rate limiting on all auth endpoints (Phase 1.2) |
| L-2 | Auth middleware discards JWT error details | JWT auth eliminated → opaque session tokens |
| L-4 | NaN passes CSRF timestamp check | Express CSRF middleware → Next.js Server Action CSRF |
| L-6 | GEMINI_API_KEY optional in schema | Direct Gemini API → Vertex AI; config schema rewritten |
| L-10 | No explicit request body size limit | Express → Next.js/Cloud Run with built-in body limits |
| L-12 | Legacy refresh token O(n) bcrypt comparisons | Refresh tokens eliminated (opaque sessions, no legacy path) |

##### Already Mitigated (1 finding)

| ID | Finding | Mitigation |
|----|---------|-----------|
| M-9 | Reset/verification tokens in URL query parameters | Referrer-Policy header added via CR-4 (`81e6988`). POST-based validation is a nice-to-have, not required. |

##### Carry Forward — Fix During Phase 1 (14 findings)

| ID | Finding | Phase | Notes |
|----|---------|-------|-------|
| M-19 | Migration script uses pool-level transactions | 1.1 | Use dedicated PoolClient in ported migration runner |
| M-20 | Migration script lacks advisory locks | 1.1 | Add `pg_advisory_lock` to ported migration runner |
| M-22 | `findMemberByOrgAndUser` returns stale membership | 1.1 | Add `WHERE removed_at IS NULL` when porting query |
| M-25 | `removeMember` doesn't verify row was updated | 1.1 | Return rowCount when porting query |
| M-27 | `cleanupExpiredTokens()` never called | 1.2 | ⚠️ Partial — `cleanupExpiredSessions()` exists + tested (PR #80), but invocation trigger deferred (Cloud Scheduler → Route Handler) |
| L-5 | Unsafe type cast of database role value | 1.1 | Zod-validate role from DB result |
| L-13 | `email_tokens.token_hash` lacks UNIQUE constraint | 1.1 | Fix in squashed `001_initial_schema.sql` |
| L-14 | Redundant `idx_users_email` index | 1.1 | Drop in squashed schema (UNIQUE already creates index) |
| L-15 | `invite_codes.created_by` nullable — TS mismatch | 1.1 | Fix in squashed schema + align types |
| L-18 | `NOT NULL` missing on `created_at`/`updated_at` | 1.1 | Fix in squashed schema |
| L-7 | DATABASE_URL validated as generic URL | 1.0 | Validate as `postgres://` or `postgresql://` in new config |
| L-8 | Database URL partially logged in non-prod | 1.0 | Sanitize or remove from env logging |
| L-3 | Zod validation details reveal schema info | 1.5 | Strip field names from validation errors in error handler. Deferred from 1.4 — no current UI exposure (client components map error codes, don't display fieldErrors), but raw Zod field names are in Server Action responses. |
| L-11 | Audit action reuse (`SUBSCRIPTION_CANCELLED`) | 1.6 | ✅ Done — `PAYMENT_FAILED` + `SUBSCRIPTION_RENEWED` added to `AuditAction` enum |

---

## Phase 1: Next.js Migration

Full plan: [planning/NEXTJS_MIGRATION_PLAN.md](./archive/planning/NEXTJS_MIGRATION_PLAN.md) (archived — migration complete)

Each sub-phase is independently testable and committable. **Tests are written alongside each phase, not retrofitted at the end.** Verify the current phase before starting the next.

### 1.0 — Infrastructure Scaffold

Stand up the deployment pipeline before writing business logic. Validates Cloud Run + Next.js compatibility early.

> **CI scope change:** CI is narrowed to web-only from this phase forward. Backend and extension CI jobs are removed — those components are being sunset by the migration. Their test suites remain runnable locally (`cd backend && pnpm test`, `cd extension && pnpm test`) until the directories are deleted in Migration Cleanup.

- Configure `output: 'standalone'` in `next.config.js`
- Write multi-stage Dockerfile (build → slim production image with standalone output)
- Set up GitHub Actions → Artifact Registry → Cloud Run pipeline
- Provision Cloud Run service with `min-instances=0` (pre-launch cost savings; increase to 1 before production traffic)
- Provision Cloud SQL PostgreSQL with HIPAA-required config: encryption at rest (default), `require_ssl = true`, automatic backups enabled
- Provision Upstash Redis
- Deploy hello-world Next.js page to verify full pipeline
- **Verify**: Push to `main` triggers build → deploy → live page on Cloud Run. Cloud SQL reachable over SSL. Redis reachable.

| Status |
|--------|
| ✅ Done — PR #78 |

### 1.1 — DAL Foundation

- Squash 12 incremental migrations into a single `001_initial_schema.sql` — clean schema definition with opaque session tokens and `token_version` dropped (no prod data to migrate; git history preserves originals)
- Create `server/` directory structure (see migration plan [Project Structure](#project-structure))
- Set up `pg` pool (singleton, same pattern as current)
- Copy query functions from `backend/src/db/queries/*`, adapt imports to `server/dal/`
- Copy types (minus Express-specific interfaces), row transforms
- Copy audit service
- Fix H-12 (non-null assertions) while porting queries
- Port query unit tests alongside code
- **Verify**: Query functions work, types compile, audit logging writes to DB, tests pass

| Status |
|--------|
| ✅ Done — PR #79 |

### 1.2 — Session System + Auth Rate Limiting

Rate limiting is co-located with sessions — auth endpoints must never be exposed without brute-force protection.

- Implement opaque session token generation + hashing (SHA-256)
- Session creation: insert into `sessions` table, set httpOnly cookie
- Session validation: read cookie → hash → lookup → validate idle + absolute expiry
- Sliding window refresh (debounced — extend only if >50% of 24h idle TTL elapsed, 7-day absolute max)
- Session revocation: delete session row + clear cookie
- Port device binding and session limit enforcement (`MAX_SESSIONS_PER_USER`)
- Port `SELECT ... FOR UPDATE` race condition protection
- Set up Upstash `@upstash/ratelimit` for all 9 auth rate limiters with compound keying (IP + email/userId — fixes M-1)
- Port session tests + write rate limit tests (must verify actual blocking — Rule 6)
- **Verify**: Sessions work end-to-end. Rate limits block after threshold. Race condition protection works. Tests pass.

| Status |
|--------|
| ✅ Done — PR #80 |

### 1.3 — Auth Server Actions

- Login: validate credentials → check lockout → create session → set cookie
- Register: validate input → create user (transaction with legal consent, invite code, org membership) → create session → set cookie
- Logout: delete session → clear cookie → client clears PHI state
- Password reset: request + complete flows (transaction: update password + delete all sessions + reset lockout)
- Email verification: send + verify flows (port token service + email service)
- Port progressive lockout service (atomic SQL with CASE WHEN thresholds)
- Port Zod schemas for all auth inputs
- Fix H-4 pattern (no email in audit metadata) in all new audit calls
- Port auth service tests, lockout tests, token service tests
- **Verify**: Full auth lifecycle works. Lockout triggers correctly. Password reset is transactional. No PHI in audit metadata. Tests pass.

| Status |
|--------|
| ✅ Done — PR #81 |

**Follow-up items from 1.3** (non-blocking, tracked for future phases):

| # | Item | Blocked By | Notes |
|---|------|-----------|-------|
| 1 | Replace `console.error` with Pino `logger.error` in auth actions/services | Phase 3 Monitoring (Pino logger) | All auth catch blocks use `console.error` with TODOs. CLAUDE.md Rule 9 requires structured `error`-level logging for audit failures to surface in Cloud Error Reporting. Fix when Pino infrastructure lands. |
| 2 | Lockout audit gap: locked accounts with correct password don't record failed attempts | — | ✅ Done (Phase 1.7) — Added `LOGIN_FAILED` audit in `auth.ts` when locked account with correct password bypasses `recordFailedAttempt()` path. |
| 3 | Audit test suite for mocks that violate production contracts | — | ✅ Partial (Phase 1.7) — Dead `.catch()` blocks on `auditService.log()` in `billing.ts` removed (Fix 4). No test files mock `auditService.log` to reject. Broader codebase sweep deferred to a future cleanup PR if needed. |

### 1.4 — Proxy + Protected Pages + Error Boundaries

- Update Next.js proxy: CSP nonces + cookie-based auth redirect for `/dashboard/*`
- Create usage DAL function (`getUsageForUser`)
- Convert dashboard to Server Component (call `getSession()` → call DAL → render)
- Convert settings to Server Component
- Create `loading.tsx`, `error.tsx`, `not-found.tsx` for protected routes
- Create `LogoutButton`, `PasswordResetSection`, `DeleteAccountSection` client components
- Remove Sentry/API URL from proxy connect-src (GCP-native monitoring, no separate API)
- Update Getting Started content for web-only flow
- Port/rewrite proxy tests + page tests
- **Verify**: Unauthenticated users redirected. Pages render with server-provided data. Error boundaries handle failures gracefully. Tests pass.

| Status |
|--------|
| ✅ Done — PR #82 |

**Follow-up items from 1.4** (non-blocking, tracked for future phases):

| # | Item | Blocked By | Notes |
|---|------|-----------|-------|
| 1 | `/baa` web page | — | ⚠️ Live but showing "PENDING LEGAL REVIEW" — awaiting legal counsel to finalize content. |
| 2 | Billing portal buttons (Manage subscription, Update payment) | Phase 1.6 (Billing) | ✅ Done — `ManageSubscriptionButton` Client Component added; portal action wired up |
| 3 | Checkout success polling | Phase 1.6 (Billing) | ✅ Done — `CheckoutSuccessAlert` Client Component added to dashboard |

### 1.4.5 — Auth Page Rewiring (Gap Audit)

> **Critical gap identified:** The migration plan built all backend machinery but never scoped when the 6 auth pages get rewired from the old Express API client to Server Actions. This phase fills that gap.

- Convert 6 auth pages (login, signup, forgot-password, reset-password, verify-email, resend-verification) from `api.ts`/`useAuth()` to Server Actions
- Convert `SessionAlert` from `useAuth()` context to URL query params
- Add proxy redirect for authenticated users on `/login` and `/signup`
- Rewrite all page tests + SessionAlert tests + proxy tests
- **Not included**: pricing page (deferred to 1.6), old auth infrastructure deletion (deferred to 1.6)
- **Verify**: All 6 auth pages call Server Actions. Auth redirects work. SessionAlert uses URL params. Pricing unchanged. Tests pass. Coverage maintained.

| Status |
|--------|
| ✅ Done |

**Gap audit findings** (documented in migration plan):

| # | Gap | Severity | Resolution |
|---|-----|----------|------------|
| 1 | Auth page rewiring never scoped | Critical | This phase |
| 2 | `AuthProvider`/`api.ts`/`storage.ts` deletion never scoped | Critical | Phase 1.6 |
| 3 | Authenticated user redirect on auth pages | Medium | Middleware (this phase) |
| 4 | Auth page error boundaries | Low | Deferred — root `error.tsx` sufficient |
| 5 | Frontend test rewrite strategy | Medium | Rewrote all 6 page tests (this phase) |
| 6 | Pricing page split dependency | Low | Noted for Phase 1.6 |

**Follow-up items from 1.4.5** (non-blocking, tracked for future phases):

| # | Item | Blocked By | Status | Notes |
|---|------|-----------|--------|-------|
| 1 | Server-side enforcement for unverified email users | — | ✅ Done | Dashboard layout checks `session.emailVerified` and redirects to `/resend-verification`. |
| 2 | Middleware `?reason` param validation | — | ✅ Done | Middleware now validates against `SessionEndReason` allowlist before clearing session cookie. |
| 3 | Make `ActionResult<T>` data required on success branch | — | ✅ Done | Fixed in A3 — `ActionResult<T>` extracted to `lib/types/actions.ts` with conditional type: `data: T` required when `T ≠ void`. |

**Auth security test gaps** (identified during code review, non-blocking for Phase 1.5):

| # | Item | Severity | Notes |
|---|------|----------|-------|
| 1 | `secure: true` cookie flag never tested in production mode | Critical | `session-cookie.test.ts` always mocks `isProduction: false`. Need a test with `isProduction: true` asserting `secure: true`. |
| 2 | Rate limiting never exercises actual blocking (Rule 6) | Critical | All tests mock `checkRateLimit` to return a fixed value. Need end-to-end test where N+1 requests are rejected. |
| 3 | No max-length on password schema (bcrypt DoS vector) | Critical | A 10,000+ character password hitting bcrypt is a CPU DoS. Add `z.string().max()` to password schema. |
| 4 | Rate limit `rate_limit_exceeded` path untested for register, requestPasswordReset, resendVerification | Important | Only `loginAction` and `validateResetTokenAction` test this path. |
| 5 | Token type confusion untested | Important | No test submits a `password_reset` token to the `email_verification` endpoint to verify rejection. |
| 6 | Lockout SQL threshold values only tested via mocks | Important | Tests mock DB results with expected lockout durations rather than exercising the actual SQL that computes them. |
| 7 | No test for expired session rows specifically | Important | `findSessionByTokenHash` WHERE clause tested textually but no test constructs an expired row scenario. |

### 1.5 — Note Generation

**A1+A2: LLM Provider Layer** ✅ Done
- LLM providers (Gemini + Claude), factory, schemas, errors, retry logic: `server/services/llm/*`
- Rate limiters (`generateRateLimit`, `apiRateLimit`) added to Upstash config
- Env var validation for LLM config (`server/db/config.ts`)
- Full test coverage (errors, schemas, provider-factory)

**A3: Note Generation Backend** ✅ Done
- Prompt sanitization ported: `server/lib/prompt-sanitization.ts`
- PT prompt templates ported: `server/prompts/pt-prompts.ts`
- Usage tracking write side (`incrementUsage`): `server/dal/usage.ts`
- Subscription check service: `server/services/subscription.ts`
- Input validation schema: `lib/schemas/notes.ts`
- Note generation orchestration: `server/services/note-generation.ts`
- `generateNoteAction` Server Action: `actions/notes.ts`
- `ActionResult<T>` extracted to `lib/types/actions.ts` (shared across action domains)
- 98 new tests across 8 files, all passing. PHI audit clean. No error message leaks.

**Follow-up items from A3** (Phase 1.5 C critical bugs — fixed):

| # | Item | Severity | Status |
|---|------|----------|--------|
| 1 | Add `.trim()` to `quickNotes` and `patientContext` in `generateNoteSchema` | Important | ✅ FIXED — `z.string().trim().min(10)` added to both fields. `lib/schemas/notes.ts` |
| 2 | Add `ACCESS_DENIED` audit logging for subscription denials | Important | ✅ Done (Phase 1.7) — `getRequestContext()` moved before subscription check; `ACCESS_DENIED` audit fires on denial. `actions/notes.ts`. |
| 3 | Include error object in `generateNoteAction` catch block logging | Moderate | ✅ FIXED — `err: error` added to structured log context. `actions/notes.ts` |

**Phase 1.5 C additions (critical bug fixes):**
- ✅ `server/lib/validation.ts` with `sanitizeFieldErrors()` helper — prevents Zod field name leaks to client (Rule L-3)
- ✅ Field error sanitization in `actions/notes.ts:45` — returns generic 'Validation failed' messages per Rule 2
- ✅ 8 new tests for `sanitizeFieldErrors()`, 3 new tests in `notes.test.ts` — 41 total new tests (1113 passing)

**A4: Note Generation UI Page** ✅ Done
- Dashboard note generation page with form + SOAP output display
- Client-side error code mapping (Rule 2)
- Loading states with up-to-30s indication
- PHI cleared from clipboard on logout (Rule 4)
- Copy-to-clipboard with fallback textarea on failure (UI Rule 5)
- Field-level validation error display with aria-describedby wiring

| Status |
|--------|
| ✅ Done — A1+A2+A3+C+A4 complete |

### 1.6 — Billing

- Copy billing service (Stripe integration — framework-agnostic)
- Rewrite webhook Route Handler: raw body parsing + signature verification + idempotency (replaces current proxy pattern)
- Checkout and portal Server Actions
- Port subscription check to DAL (used by note generation gate)
- Convert pricing page from `api.ts`/`useAuth()` to Server Actions
- **Delete old auth infrastructure**: `lib/api.ts`, `lib/auth-context.tsx`, `lib/storage.ts`, `components/Providers.tsx` + their test files (last consumer is pricing page)
- Webhook event cleanup job
- Port billing service tests, rewrite webhook integration tests
- **Verify**: Webhooks process correctly. Checkout works. Subscription status enforced. Old auth files deleted. Cleanup job runs. Tests pass.

| Status |
|--------|
| ✅ Done |

**Follow-up items from 1.6** (non-blocking, tracked for future phases):

| # | Item | Blocked By | Notes |
|---|------|-----------|-------|
| 1 | Enforce `CLEANUP_SECRET` in production `superRefine` block | — | ✅ Done (Phase 1.7) — Added to `superRefine` in `server/db/config.ts` alongside Stripe secrets. |
| 2 | Add `emailVerified` check to `createPortalAction` | — | ✅ Done (Phase 1.7) — Added to `actions/billing.ts` for defense-in-depth parity with `createCheckoutAction`. |
| 3 | Zod-validate webhook event data after `constructEvent` | — | ✅ Done (Phase 1.7) — `validateMetadataUserId` private helper added to `BillingService`; applied to all 5 webhook handlers. Dead `.catch()` blocks on `auditService.log()` removed. |

### 1.7 — Integration Tests + Production Verification

Unit tests already passing from 1.1-1.6. This phase adds cross-cutting integration tests and validates the complete system.

- Integration tests: full auth lifecycle (register → verify → login → generate note → logout)
- Integration tests: billing webhooks (checkout → webhook → subscription active → notes unlocked)
- Integration tests: rate limiting across endpoints (verify compound keying)
- Integration tests: concurrent session handling (multiple tabs, session limit enforcement)
- Performance baseline: auth flow latency, note generation latency, page load times
- Staging deployment with synthetic data — full smoke test
- Security-critical path coverage audit (per Rule 6)
- **Verify**: All integration tests pass. Performance acceptable. No regressions. Coverage meets standards.

| Status |
|--------|
| ✅ Done |

### Migration Technical Debt — Consolidated Cleanup

Accumulated follow-up items from Phases 1.3–1.6 code reviews. None are blocking for Phase 1.7 or launch, but all should be resolved before production traffic. Candidates for a single "migration cleanup" PR after 1.7.

| # | Item | Source | Priority | Notes |
|---|------|--------|----------|-------|
| 1 | Replace `console.*` with Pino structured logging across all server code | 1.3 #1 | P1 | ~44 `console.*` calls across 18 production files. Blocks Cloud Error Reporting grouping. Included in Phase 3 Monitoring PR 1 (Pino Logger). |
| 2 | Lockout audit gap: locked accounts with correct password | 1.3 #2 | P2 | Correct password on permanently locked account skips `recordFailedAttempt()`. Audit trail gap for HIPAA. |
| 3 | Audit test mocks that violate production contracts | 1.3 #3 | P2 | 17 dead try/catch blocks passed coverage via mocks that reject (real implementation swallows). False confidence in coverage. |
| 4 | `/baa` web page | 1.4 #1 | P2 | ⚠️ Live but showing "PENDING LEGAL REVIEW" — awaiting legal counsel to finalize content. |
| 5 | Auth security test gaps (7 items) | 1.4.5 | P1 | ✅ Done (Phase 1.7) — All 7 gaps addressed: production cookie flag, rate limit blocking (3 actions), bcrypt `.max(72)`, token type confusion, lockout SQL threshold, expired session contract. |
| 6 | Enforce `CLEANUP_SECRET` in production config | 1.6 #1 | P2 | ✅ Done (Phase 1.7) — See 1.6 follow-up #1. |
| 7 | Add `emailVerified` check to `createPortalAction` | 1.6 #2 | P3 | ✅ Done (Phase 1.7) — See 1.6 follow-up #2. |
| 8 | Zod-validate webhook event data after `constructEvent` | 1.6 #3 | P3 | ✅ Done (Phase 1.7) — See 1.6 follow-up #3. |
| 9 | `ACCESS_DENIED` audit logging for subscription denials | 1.5 A3 #2 | P2 | ✅ Done (Phase 1.7) — See 1.5 A3 follow-up #2. |

### Migration Cleanup

Completed in PR cleanup commit series (March 2026). All legacy code and documentation removed.

- [x] Delete `/backend` directory
- [x] Delete `/extension` directory
- [x] Replace `CLAUDE.md` with `CLAUDE_DRAFT.md` (done — current `CLAUDE.md` reflects web-only architecture)
- [x] Archive `guides/API.md` (Express routes no longer apply) → `docs/archive/guides/API.md`
- [x] Archive `guides/EXTENSION_DEPLOYMENT.md` → `docs/archive/guides/EXTENSION_DEPLOYMENT.md`
- [x] Archive `guides/ENVIRONMENT_VARIABLES.md` → `docs/archive/guides/ENVIRONMENT_VARIABLES.md`
- [x] Archive `planning/IDEA_DUMPING_GROUND.md` → `docs/archive/planning/IDEA_DUMPING_GROUND.md`
- [x] Update `reference/FLASHNOTE_HANDOFF.md` architecture sections
- [x] Update `PRE_LAUNCH_CHECKLIST.md` (remove Chrome Web Store items)
- [x] Update `SUCCESS_METRICS.md` (consolidate for web-only, remove backend/extension metrics)
- [x] Refactor `/shared` design system into `web/design-system/` — no longer "shared" between packages; move to web root alongside `tailwind.config.ts` and update import paths
- [x] Update `STRIPE_TODOS.md` (remove extension sync item) — no extension sync item exists in the file; already clean

---

## UI Overhaul: Refined Teal

Design system migration from "Warm Wellness" (emerald/cream/Inter) to "Refined Teal" (teal/slate/Plus Jakarta Sans). Fixes WCAG AA contrast failures, adds sidebar layout, and matches the mockups in `docs/design/`.

Design spec: [planning/DESIGN_SYSTEM.md](./planning/DESIGN_SYSTEM.md) | Component patterns: [planning/COMPONENT_PATTERNS.md](./planning/COMPONENT_PATTERNS.md)

Dependencies: `UI-1 → UI-2 → UI-3 (parallel with UI-4) → UI-5`

### UI-1: Foundation (Docs + Tokens)

| Item | Status |
|------|--------|
| Create `docs/planning/DESIGN_SYSTEM.md` | ✅ |
| Create `docs/planning/COMPONENT_PATTERNS.md` | ✅ |
| Add Rules 11-14 (a11y) to `CLAUDE.md` | ✅ |
| Create `web/design-system/design-tokens-teal.css` (replace warm tokens) | ✅ |
| Create `web/design-system/tailwind-preset-teal.js` (replace warm preset) | ✅ |
| Rewrite `web/design-system/components.css` (flat teal, no gradients) | ✅ |
| Update `web/tailwind.config.ts` → teal preset | ✅ |
| Update `web/src/app/globals.css` (remove `.text-gradient`, gradient utilities) | ✅ |
| Swap font: Inter → Plus Jakarta Sans in `layout.tsx` | ✅ |
| Update tests affected by token/CSS changes | ✅ (no test changes needed) |
| **Verify**: `pnpm build` succeeds. Font loads. Tailwind resolves new tokens. Tests pass. | ✅ |

### UI-2: Layout Shell + Sidebar

| Item | Status |
|------|--------|
| Create `Sidebar` component (dark nav, section labels, CTA, user footer) | ❌ |
| Create `TopBar` component (back button, title, action slot) | ❌ |
| Rewrite `dashboard/layout.tsx` (sidebar layout replacing top nav) | ❌ |
| Sidebar links: Dashboard, New Note, Settings (working) | ❌ |
| Sidebar links: Notes, Patients, Templates ("Coming soon" stub) | ❌ |
| Update skip link styling for new layout | ❌ |
| Update tests for layout/sidebar changes | ❌ |
| **Verify**: Sidebar renders. Navigation works. Auth enforced. Responsive. Tests pass. | |

### UI-3: Dashboard + Note Generation + Note Result

| Item | Status |
|------|--------|
| Rewrite note form (2-col grid, patient selector stub, hero textarea, context panel stub) | ❌ |
| Create `SoapSection` component (accent bar header, copy/edit buttons, edit mode) | ❌ |
| Rewrite `GeneratedNote` (SOAP section cards, metadata, copy all) | ❌ |
| Create `Rating` widget (star feedback) | ❌ |
| Rewrite dashboard page layout | ❌ |
| Update UI primitives (Button, Card, Input, Alert, Badge, Spinner) | ❌ |
| Update tests for dashboard/note component changes | ❌ |
| **Verify**: Note form matches mockup. SOAP sections render. Copy/edit work. Tests pass. | |

### UI-4: Auth Pages

| Item | Status |
|------|--------|
| Update `AuthLayout` (surface bg, teal primary, no gradient text) | ❌ |
| Reskin all 6 auth page forms (new input/button/alert styles) | ❌ |
| Update `SessionAlert` styling | ❌ |
| Update tests for auth component changes | ❌ |
| **Verify**: All auth pages render. Auth flow tests pass. | |

### UI-5: Marketing + Settings + Cleanup

| Item | Status |
|------|--------|
| Redesign landing page (new colors, typography, teal CTAs) | ❌ |
| Redesign pricing page (teal card styling) | ❌ |
| Update terms, privacy, BAA pages (typography/colors) | ❌ |
| Redesign settings page (new card/form styling) | ❌ |
| Delete old design files (`design-tokens-warm.css`, `tailwind-preset-warm.js`) | ✅ (pulled into UI-1) |
| Final test sweep — catch any remaining test failures from cumulative changes | ❌ |
| **Verify**: All pages use new design. Build succeeds. Full test suite passes. | |

---

## Deployment Readiness

The bridge between "code passes tests locally" and "app is live accepting beta users." Steps are dependency-ordered — complete each before starting the next.

Full monitoring plan: [planning/MONITORING_SETUP.md](./planning/MONITORING_SETUP.md)

### Step 1: Monitoring PR 1 — Pino Logger + Console Migration + Client Telemetry (~5 SP)

Need observability before deploying to any environment. Sentry remains active in parallel.

| Item | Status |
|------|--------|
| Logging gaps audit (12 gaps fixed) | ✅ Done (patterns transfer to new logger) |
| Install `pino` + `@google-cloud/pino-logging-gcp-config` + `pino-pretty` (dev) | ❌ |
| Create `server/lib/logger.ts` singleton (prod: GCP JSON, dev: pino-pretty) | ❌ |
| Replace ~44 `console.*` calls across 18 production files with structured Pino logging | ❌ |
| Create `/api/telemetry` route handler for client-side error ingestion | ❌ |
| Create `lib/telemetry.ts` with global error handlers + `reportErrorBoundary` | ❌ |
| Wire error boundaries (`global-error.tsx`, `ErrorBoundary.tsx`) to telemetry | ❌ |
| Update `instrumentation.ts` `onRequestError` hook to use Pino | ❌ |
| Update ~4 test files that spy on `console.error` | ❌ |
| **Verify**: Tests pass. Build succeeds. Dev server logs via pino-pretty. | |

### Step 2: Pipeline Hardening PR (~2 SP)

Fix the deploy pipeline before the first real deployment.

| Item | Status |
|------|--------|
| Add DB migration step to `deploy.yml` (run migrations before traffic cutover) | ❌ |
| Deep health check — `/api/health` probes DB connectivity, not just `{ status: 'ok' }` | ❌ |
| Remove stale `NEXT_PUBLIC_API_URL` build arg from Dockerfile + deploy.yml | ✅ Done (Dockerfile cleaned; deploy.yml build arg removed) |
| Replace Sentry TODO in deploy.yml with removal note | ✅ Done |
| Add `min-instances` comment in deploy.yml (increase to 1 before production traffic) | ✅ Done |
| Remove dead `develop` branch from ci.yml triggers | ✅ Done |
| **Verify**: CI passes. Docker build succeeds. Pipeline is clean. | |

### Step 3: GCP Infrastructure Provisioning (ops)

Provision the production environment. No code changes — all infrastructure/console work.

| Item | Status |
|------|--------|
| Create GCP project and enable Cloud Run, Cloud SQL, Artifact Registry APIs | ❌ |
| Enable Vertex AI API (`aiplatform.googleapis.com`) — required for HIPAA-compliant LLM access | ❌ |
| Create LLM service account with `roles/aiplatform.user` (or assign to Cloud Run runtime SA) | ❌ |
| Provision Cloud SQL PostgreSQL — encryption at rest (default), `require_ssl = true`, automatic backups | ❌ |
| Configure Secret Manager with runtime secrets (DB URL, Stripe keys, Upstash Redis, Resend API key) | ❌ |
| Set Cloud Run env vars: `GEMINI_USE_ADC=true`, `GCP_PROJECT_ID`, `GCP_REGION` (Vertex AI ADC config — replaces consumer API key) | ❌ |
| Set up Workload Identity Federation for GitHub Actions (keyless auth) | ❌ |
| Configure custom domain (flashnote.co) with SSL | ❌ |
| Set GitHub repository secrets (`GCP_REGION`, `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SA_EMAIL`, `GCP_SA_RUNTIME_EMAIL`) | ❌ |
| **Verify**: `gcloud run deploy` succeeds. Cloud SQL reachable over SSL. Secrets accessible. Domain resolves. | |

### Step 4: First Staging Deploy + Verification

Deploy `main` and verify the full system works end-to-end in a real environment.

| Item | Status |
|------|--------|
| Push to `main` → CI passes → deploy pipeline builds + deploys to Cloud Run | ❌ |
| Verify Pino structured logs appear in Cloud Logging with correct severity levels | ❌ |
| Verify errors with stack traces appear in Cloud Error Reporting, properly grouped | ❌ |
| Verify client-side errors arrive via `/api/telemetry` endpoint | ❌ |
| Verify health check probes pass (Cloud Run startup + liveness) | ❌ |
| Verify Vertex AI ADC is active — note generation uses `GEMINI_USE_ADC=true` endpoint, not consumer API key | ❌ |
| Smoke test: register → verify email → login → generate note → logout | ❌ |
| Smoke test: Stripe checkout (test mode) → webhook → subscription active → notes unlocked | ❌ |
| **Verify**: App is live, monitored, and functional. All smoke tests pass. | |

### Step 5: Monitoring PR 2 — Sentry Removal (~2 SP)

Only after Pino is verified working in the deployed environment.

| Item | Status |
|------|--------|
| Delete Sentry config files (`sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation-client.ts`, `sentry-sanitization.ts`) | ❌ |
| Remove `withSentryConfig` from `next.config.ts` | ❌ |
| Remove `@sentry/nextjs` dependency | ❌ |
| Remove `NEXT_PUBLIC_SENTRY_DSN` build arg from Dockerfile + deploy.yml | ❌ |
| Clean up Sentry test mocks in `test/setup.ts` | ❌ |
| **Verify**: No Sentry references remain. Build succeeds. Error monitoring confirmed working via Pino/Cloud Logging. | |

### Step 6: Stripe Live Mode (ops)

Switch from Stripe test mode to live mode with real payment processing.

| Item | Status |
|------|--------|
| Complete Stripe identity verification (business docs, bank account) | ❌ |
| Create production webhook endpoint in Stripe Dashboard (`flashnote.co/api/webhooks/stripe`) | ❌ |
| Configure production webhook signing secret in Secret Manager | ❌ |
| Test with real $1 charge (refund immediately) | ❌ |
| Verify webhook processes correctly in production | ❌ |
| **Verify**: Real payments work. Webhooks fire and process. Subscription status updates. | |

### Step 7: Beta Launch Gate

Everything needed before inviting beta users with real patient data.

| Item | Status |
|------|--------|
| Increase `min-instances` from 0 to 1 in deploy.yml (avoid cold starts for real users) | ❌ |
| Legal documents published on site (Terms, Privacy Policy, BAA) | ❌ |
| Support email working (support@flashnote.co) | ❌ |
| 48-hour stability soak — no errors, no crashes, monitoring clean | ❌ |
| Recruit 5-10 PT beta testers (see [PRE_LAUNCH_CHECKLIST.md §8](./PRE_LAUNCH_CHECKLIST.md)) | ❌ |
| **Gate**: All items checked → invite beta users via invite codes | |

---

## Phase 2: PHI Storage

Full design: [planning/PHI_STORAGE_PLAN.md](./planning/PHI_STORAGE_PLAN.md) | Competitive context: [planning/TWOFOLD_DEEP_DIVE.md](./planning/TWOFOLD_DEEP_DIVE.md)

**Blocked by:** Phase 1 (migration complete) + Phase 0 HIPAA infrastructure (BAA signed, encryption at rest, audit retention)

### Remaining HIPAA Prerequisites

These items from Phase 0 HIPAA Infrastructure must be complete before PHI work begins:

| Item | Status |
|------|--------|
| Google Cloud BAA signed | ✅ Done |
| Database encryption at rest | ⏳ Pending provisioning (Cloud SQL default; verify at provisioning) |
| TLS 1.2+ enforced | ⏳ Pending provisioning (`require_ssl = true` at provisioning) |
| Audit log retention automation (6-year HIPAA requirement) | ❌ — build in new DAL during Phase 1 or here |
| Audit log immutability protections | ✅ Done (migration 012) |
| Legal document re-acceptance flow | ❌ — build on new stack |

### PHI Implementation

| PR | Scope | Status |
|----|-------|--------|
| PHI-1 | Patients + clinical notes + note templates (SOAP built-in) + generation endpoint | ❌ |
| PHI-2 | Note versioning (immutable, append-only, per-section) | ❌ |
| PHI-3 | Dashboard UI (patient list, note history, version timeline) | ❌ |

**What this enables:**
- Persistent patient records with context injection into all future notes
- Note history and amendment tracking (HIPAA-compliant)
- Template-driven dynamic sections (not hardcoded SOAP)
- Foundation for treatment plans, custom templates, multi-discipline support

---

## Phase 3: Quality & Features

All items scoped to the new Next.js architecture. No extension work.

### ~~UI Quality~~ — Deprecated

> **Superseded by UI build rules in CLAUDE.md.** All 19 items from the UI audit (clipboard, contrast, ARIA, semantic HTML, focus management, responsive, design tokens) are codified as build-from-scratch rules. The UI is being rebuilt — retrofitting fixes onto pages that will be rewritten is wasted work. Dark mode and print styles are explicitly cut.
>
> Original audit details preserved in [compliance/UI_AUDIT.md](./compliance/UI_AUDIT.md) for reference.

### Testing

Full requirements: [compliance/TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md)

> Note: Test foundation is rebuilt during Phase 1.8. This section covers additional testing work beyond the migration.

| Task | Priority | Status |
|------|----------|--------|
| Integration tests (auth lifecycle, sessions, billing webhooks) | P0 | ❌ |
| E2E: Auth flow tests (login, register, logout, password reset) | P0 | ❌ |
| E2E: Note generation flow | P0 | ❌ |
| E2E: Copy functionality edge cases | P1 | ❌ |
| E2E: Rate limiting UX | P1 | ❌ |
| DAST scanning (OWASP ZAP) in CI | P1 | ❌ |
| Secret scanning (GitLeaks) in CI | P1 | ❌ |
| Manual penetration test | P1 | ❌ |
| Third-party security audit | P2 | ❌ (post-launch OK) |

> Removed: "E2E: Floating button on EMR pages" (extension-only), "E2E: Token refresh flow" (no client-side token refresh in new architecture).

### Accessibility Tooling

Full plan: [planning/ACCESSIBILITY_IMPLEMENTATION.md](./planning/ACCESSIBILITY_IMPLEMENTATION.md)

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | ESLint static analysis (`eslint-plugin-jsx-a11y`) | ✅ Done |
| 2 | Fix existing accessibility violations | ✅ Done |
| 3 | Unit test assertions (`vitest-axe`) | ❌ |
| 4 | E2E accessibility audits (`@axe-core/playwright`) | ❌ |
| 5 | Dev-time overlay (`@axe-core/react`) | ❌ |

### Monitoring (Post-Launch Ops)

Full plan: [planning/MONITORING_SETUP.md](./planning/MONITORING_SETUP.md)

> Pino logger setup (PR 1) and Sentry removal (PR 2) are tracked in [Deployment Readiness](#deployment-readiness) — they're deployment-blocking, not post-launch work.

These items are operational configuration after the app is live and Pino is verified:

| Item | Status |
|------|--------|
| Cloud Logging log sink for HIPAA audit retention (6 years) | ❌ |
| Cloud Monitoring alert policies (error spikes, auth failures, billing webhook failures) | ❌ |
| UptimeRobot monitors (external uptime validation) | ❌ |

### Clinic Features (Waves 2-4)

Full design spec: [planning/APP_GATING_STRATEGY.md](./planning/APP_GATING_STRATEGY.md)

**Wave 1 is complete** (PRs 1A-1D merged: usage token split, invite codes, org infrastructure, usage endpoint).

#### Wave 2 — Clinic Admin Dashboard

| Task | Status |
|------|--------|
| Org read DAL functions + Server Components | ❌ |
| Org management Server Actions (invites, members) | ❌ |
| Team dashboard page (`/dashboard/team`) | ❌ |

#### Wave 3 — Clinic Billing

| Task | Status |
|------|--------|
| Stripe clinic plan integration (checkout, webhooks, `max_seats` sync) | ❌ |
| Clinic plan on pricing page + owner billing UX | ❌ |

#### Wave 4 — Polish & Voluntary Flows

| Task | Status |
|------|--------|
| Org leave + transfer Server Actions | ❌ |

> Removed: Wave 4B "Extension org support + admin compliance view" — extension removed.

### Stripe

Full reference: [STRIPE_TODOS.md](./STRIPE_TODOS.md)

| Task | Priority | Status |
|------|----------|--------|
| Failed payment email notifications | P1 — before launch | ❌ |

> Moved: "Webhook event cleanup job" → Phase 1.6 (built into billing migration).
> Removed: "Post-checkout subscription sync for extension" — extension removed.

Post-launch:
- Trial ending soon notifications
- Subscription reactivation flow
- ~~`SUBSCRIPTION_RENEWED` and `PAYMENT_FAILED` audit actions~~ — ✅ Done (Phase 1.6)

---

## Future Features (Not Scheduled)

| Feature | Planning Doc |
|---------|-------------|
| Voice Input | [VOICE_INPUT_ROADMAP.md](./planning/VOICE_INPUT_ROADMAP.md) |
| Treatment Plan Generation | [PHI_STORAGE_PLAN.md](./planning/PHI_STORAGE_PLAN.md) (post Phase 1) |
| Custom Template Builder UI | [PHI_STORAGE_PLAN.md](./planning/PHI_STORAGE_PLAN.md) (Phase 2) |
| OAuth / Social Login | [OAUTH_ANALYSIS.md](./planning/OAUTH_ANALYSIS.md) |
| Conversational Mode | [TRUST_BUILDING_STRATEGY.md](./planning/TRUST_BUILDING_STRATEGY.md) |
| Review Mode | [TRUST_BUILDING_STRATEGY.md](./planning/TRUST_BUILDING_STRATEGY.md) |
| API-as-a-Service | Not planned — if pursued, revisit architecture (requires standalone API server) |
| Design System Rebrand | [DESIGN_DIRECTION.md](./planning/DESIGN_DIRECTION.md) |

---

## Recently Completed

| Item | Notes |
|------|-------|
| Phase 1.6: Billing (PR #89) | Stripe billing service, webhook handlers with idempotency, checkout + portal Server Actions, pricing page converted to Server Component, old auth infrastructure deleted (8 files, 1361 lines). Code review fixes: env var mismatch, unsafe Stripe casts, audit log catch handlers, lazy singleton, H-2 guard widened, duplicate webhook log removed. 1195 tests, 98%+ coverage. |
| Phase 1.4.5: Auth Page Rewiring (Gap Audit) | Converted 6 auth pages from `api.ts`/`useAuth()` to Server Actions. SessionAlert now reads URL query params instead of auth context. Middleware redirects authenticated users from `/login`/`/signup`. Logout appends `?reason=logged_out`. Gap audit identified 6 gaps in migration plan — 2 critical (auth page rewiring + old auth file deletion). 74 page tests rewritten. |
| Phase 1.4: Middleware + Protected Pages (PR #82) | Middleware auth redirect for `/dashboard/*`, usage DAL, dashboard + settings converted to Server Components, `LogoutButton`/`PasswordResetSection`/`DeleteAccountSection` client components, `loading.tsx`/`error.tsx`/`not-found.tsx` error boundaries, CSP cleanup (removed Sentry/API URL from connect-src). 56 new tests. |
| Phase 1.3: Auth Server Actions (PR #81) | Login, register, logout, password reset, email verification, invite code validation Server Actions. Auth service with transactional registration + password reset. Progressive lockout service (atomic SQL). Token service + email service (Resend). Zod auth schemas. Full test coverage. |
| Phase 1.2: Session System + Auth Rate Limiting (PR #80) | Opaque session tokens (SHA-256), sliding window refresh, session DAL (create/validate/refresh/revoke/enforce limit/device binding/cleanup), `getSession()` composition, Upstash rate limiting with compound keying (fixes M-1, L-1) |
| Phase 1.1: DAL Foundation (PR #79) | Database pool, DAL pattern, audit service, types, squashed schema migration |
| Phase 1.0: Infrastructure Scaffold (PR #78) | Next.js standalone build, multi-stage Dockerfile, Cloud Run deploy pipeline |
| All 5 CRITICALs Resolved | CR-1 webhook idempotency, CR-2 token race condition, CR-3 trust proxy, CR-4 security headers, CR-5 password reset atomicity |
| Backend Infrastructure & Safety (Audit PR 1) | CR-3, H-10, H-14, H-15, M-3 — trust proxy, error handling, graceful shutdown, process handlers |
| Billing & Webhook Safety (Audit PR 2) | CR-1, H-1, H-2, H-3, M-5, M-6 — idempotency rollback, price validation, duplicate sub check, audit safety |
| Auth & Token Atomicity (Audit PR 3) | CR-2, CR-5, H-4, H-7, M-2, M-26 — token rotation locking, password reset transaction, bcrypt rounds |
| Web App Hardening (Audit PR 4) | CR-4, M-7, M-8, M-10, M-11, M-23 — CSP + security headers, API client migration, redirect validation |
| Wave 1: Registration Gating + Clinic Infrastructure | 4 PRs merged (usage split, invite codes, orgs, usage endpoint) |
| Auth Form UX Unification | Shared `AuthLayout`, consistent validation, matching fields |
| Unified Styling System | "Warm Wellness" theme, shared design tokens |
| Sentry Monitoring (to be replaced by GCP-native) | All 3 components instrumented, 12 logging gaps fixed. Being replaced by Cloud Logging + Cloud Error Reporting. |
| Accessibility Phases 1-2 | ESLint jsx-a11y + violation fixes |
| MVP Foundation | All 15 quality gates passed |

---

## Related Documents

| Document | Role |
|----------|------|
| [planning/NEXTJS_MIGRATION_PLAN.md](./archive/planning/NEXTJS_MIGRATION_PLAN.md) | Migration analysis, architecture decisions, build order, infrastructure |
| [SUCCESS_METRICS.md](./SUCCESS_METRICS.md) | Quality gate criteria (pass/fail definitions) |
| [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | Business, legal, and ops tasks |
| [STRIPE_TODOS.md](./STRIPE_TODOS.md) | Stripe reference (architecture, test cards, security) |
| [compliance/CONSOLIDATED_AUDIT_2026_02.md](./compliance/CONSOLIDATED_AUDIT_2026_02.md) | Security audit (69 findings, disposition in Phase 0) |
| [compliance/UI_AUDIT.md](./compliance/UI_AUDIT.md) | UI audit findings and affected files |
| [compliance/TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md) | Testing requirements and coverage targets |
| [planning/PHI_STORAGE_PLAN.md](./planning/PHI_STORAGE_PLAN.md) | PHI storage design (patients, notes, templates, versioning) |
| [planning/PROMPT_ENGINEERING_RESEARCH.md](./planning/PROMPT_ENGINEERING_RESEARCH.md) | Prompt optimization research |
| [planning/APP_GATING_STRATEGY.md](./planning/APP_GATING_STRATEGY.md) | Clinic feature design spec (Waves 1-4) |
| [planning/MONITORING_SETUP.md](./planning/MONITORING_SETUP.md) | Monitoring stack setup plan |
| CLAUDE.md (Code Quality Standards + UI patterns) | UI build rules (supersedes UI Quality phase) |
