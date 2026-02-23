# FlashNote Development Roadmap

**Last Updated:** February 20, 2026

This is the **single source of truth** for all technical work status.

- Each task appears in exactly one place — here for code/technical work, [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) for business/legal/ops.
- Quality gate criteria (pass/fail definitions) live in [SUCCESS_METRICS.md](./SUCCESS_METRICS.md).
- Planning specs and reference docs never track status — they describe *what* to build, this doc tracks *is it done*.

---

## Dashboard

Work is organized into phases by dependency order. Complete each phase before starting the next; items within a phase can be parallelized.

| Phase | Track | Progress | Next Action |
|-------|-------|----------|-------------|
| **0** | [Pre-Migration Foundations](#phase-0-pre-migration-foundations) | 3/14 | Sign Google Cloud BAA |
| **1** | [Next.js Migration](#phase-1-nextjs-migration) | 0/8 sub-phases | Infrastructure scaffold |
| **2** | [PHI Storage](#phase-2-phi-storage) | Designed, 0/3 PRs | Blocked on Phase 1 + HIPAA infra |
| **3** | [Quality & Features](#phase-3-quality--features) | Partial | Post-migration |
| — | [Business / Legal / Ops](./PRE_LAUNCH_CHECKLIST.md) | ~20% | Form LLC |

**Why this order:**
- **Phase 0** handles infrastructure and framework-agnostic fixes that apply regardless of the migration. Unblocks the Google Cloud BAA and hardens the database schema. No wasted work — everything here transfers.
- **Phase 1** is the architectural pivot. Express backend and Chrome extension are removed; everything consolidates into a single Next.js app on Cloud Run. This is the largest body of work and the foundation for everything after.
- **Phase 2** is the competitive pivot — patients, notes, templates. Blocked on Phase 1 completion and HIPAA infrastructure.
- **Phase 3** is important but non-differentiating. UI quality, testing, clinic features, monitoring — all scoped to the new architecture.

### Architecture Decision

FlashNote is consolidating from three components (Express backend + Chrome extension + Next.js web app) to a **single Next.js application** deployed on Google Cloud Run. Full analysis and rationale: [planning/NEXTJS_MIGRATION_PLAN.md](./planning/NEXTJS_MIGRATION_PLAN.md)

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
| 1 | **Sign Google Cloud BAA** — covers Cloud Run, Cloud SQL, Vertex AI | Ops | ❌ → [Checklist §2](./PRE_LAUNCH_CHECKLIST.md) |
| 2 | **Database encryption at rest** — Cloud SQL configuration | Ops | ❌ |
| 3 | **TLS 1.2+ enforced on all connections** — Cloud SQL configuration | Ops | ❌ |
| 4 | **Audit log immutability protections** — database triggers prevent UPDATE/DELETE/TRUNCATE on `audit_logs` (migration 012) | Code | ✅ Done |
| 5 | **Breach notification / incident response procedure** — [INCIDENT_RESPONSE_PLAN.md](./compliance/INCIDENT_RESPONSE_PLAN.md) | Docs | ✅ Done |
| 6 | BAA acceptance in signup flow (backend) | Code | ✅ Done |

> Items that require new code in the Next.js architecture (audit retention automation, `/baa` page, legal re-acceptance flow) are deferred to Phase 1 where they'll be built on the new stack.

### Database Schema Hardening

Surviving HIGH findings from the security audit. These are pure SQL migrations — apply to the current database, transfer unchanged.

| ID | Finding | Fix | Status |
|----|---------|-----|--------|
| H-11 | `subscription_status` missing CHECK constraint on `users` table | Add CHECK constraint matching `organizations` pattern | ❌ |
| H-13 | `markCodeAsUsed` doesn't set `is_active = FALSE` | Add `is_active = FALSE` to UPDATE | ❌ |
| H-18 | CASCADE DELETE on `sessions` and `usage` — HIPAA data retention risk | Change to ON DELETE RESTRICT, implement soft-delete for users | ❌ |

### Prompt Engineering

Full research: [planning/PROMPT_ENGINEERING_RESEARCH.md](./planning/PROMPT_ENGINEERING_RESEARCH.md)

Framework-agnostic changes — prompt templates and LLM config transfer directly to the new architecture.

#### P0 — Do Now

| Change | Effort | Status |
|--------|--------|--------|
| Lower temperature from 0.7 → 0.2-0.3 | Config change | ❌ |
| Move system prompt to Gemini `systemInstruction` field | Moderate refactor | ❌ |
| Fix H-16: Escape XML delimiter tags in user content (prompt injection) | Code change | ❌ |

#### P1 — Do Soon

| Change | Effort | Status |
|--------|--------|--------|
| Add sandwich defense (repeat security rules after user content) | Small prompt edit | ❌ |
| Inject PT abbreviation reference into prompts | Prompt addition | ❌ |
| Add `needsReview` / `uncertainAreas` to output schema | Schema + prompt update | ❌ |

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
| H-11 | Missing CHECK constraint on subscription_status | ❌ Fix in Phase 0 (schema hardening) |
| H-12 | Non-null assertions on query results | ❌ Fix during Phase 1.1 (DAL foundation) |
| H-13 | Invite code doesn't deactivate | ❌ Fix in Phase 0 (schema hardening) |
| H-14 | No graceful shutdown | ✅ Done (`44319a8`). Cloud Run handles shutdown signals for Next.js. |
| H-15 | No process-level error handlers | ✅ Done (`44319a8`). Next.js instrumentation hook (`onRequestError`) handles this. |
| H-16 | XML delimiter not escaped (prompt injection) | ❌ Fix in Phase 0 (prompt engineering) |
| H-17 | Backend errors displayed to users (extension) | 🗑️ Moot — extension removed |
| H-18 | CASCADE DELETE on sessions/usage | ❌ Fix in Phase 0 (schema hardening) |

#### MEDIUM/LOW Findings

Previously resolved: M-2, M-26 (`af50b29`), M-3 (`44319a8`), M-5, M-6 (`63b3d10`), M-7, M-8, M-10, M-11, M-23 (`81e6988`).

Remaining 36 MEDIUM/LOW findings need triage during Phase 0:
- **Extension-specific findings** → close as "resolved by removal"
- **Express-specific findings** (middleware, routing) → close as "resolved by migration"
- **Framework-agnostic findings** (schema, validation, logging) → fix during appropriate Phase 1 sub-phase
- **Web UI findings** → carry forward to Phase 3

---

## Phase 1: Next.js Migration

Full plan: [planning/NEXTJS_MIGRATION_PLAN.md](./planning/NEXTJS_MIGRATION_PLAN.md) | CLAUDE.md draft: `CLAUDE_DRAFT.md` (project root)

> **Before starting Phase 1:** Adopt `CLAUDE_DRAFT.md` as the new `CLAUDE.md`. The draft reflects the new architecture and its patterns.

Each sub-phase is independently testable and committable. **Tests are written alongside each phase, not retrofitted at the end.** Verify the current phase before starting the next.

### 1.0 — Infrastructure Scaffold

Stand up the deployment pipeline before writing business logic. Validates Cloud Run + Next.js compatibility early.

- Configure `output: 'standalone'` in `next.config.js`
- Write multi-stage Dockerfile (build → slim production image with standalone output)
- Set up GitHub Actions → Artifact Registry → Cloud Run pipeline
- Provision Cloud Run service with `min-instances=1`
- Provision Upstash Redis
- Deploy hello-world Next.js page to verify full pipeline
- **Verify**: Push to `main` triggers build → deploy → live page on Cloud Run. Redis reachable.

| Status |
|--------|
| ❌ |

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
| ❌ |

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
| ❌ |

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
| ❌ |

### 1.4 — Middleware + Protected Pages + Error Boundaries

- Update Next.js middleware: CSP nonces + cookie-based auth redirect for `/dashboard/*`
- Build `getSession()` DAL function for Server Components
- Convert dashboard to Server Component (call `getSession()` → call DAL → render)
- Convert settings to Server Component
- Create `loading.tsx`, `error.tsx`, `not-found.tsx` for protected routes
- Create `/baa` web page (currently 404 — Tier 2 item #8)
- Port/rewrite middleware tests
- **Verify**: Unauthenticated users redirected. Pages render with server-provided data. Error boundaries handle failures gracefully. No flash of loading state. Tests pass.

| Status |
|--------|
| ❌ |

### 1.5 — Note Generation

- Copy LLM service layer wholesale (`services/llm/*`, `prompts/*`, `utils/prompt-sanitization.ts`)
- Build Server Action with auth + subscription check + rate limiting
- Port usage tracking service
- Add `generateRateLimit` and `apiRateLimit` to Upstash
- Port LLM and usage tests
- **Verify**: Notes generate correctly. Rate limiting works. Usage tracked. PHI not logged. Tests pass.

| Status |
|--------|
| ❌ |

### 1.6 — Billing

- Copy billing service (Stripe integration — framework-agnostic)
- Rewrite webhook Route Handler: raw body parsing + signature verification + idempotency (replaces current proxy pattern)
- Checkout and portal Server Actions
- Port subscription check to DAL (used by note generation gate)
- Webhook event cleanup job
- Port billing service tests, rewrite webhook integration tests
- **Verify**: Webhooks process correctly. Checkout works. Subscription status enforced. Cleanup job runs. Tests pass.

| Status |
|--------|
| ❌ |

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
| ❌ |

### Migration Cleanup

After all 8 sub-phases are verified:

- [ ] Delete `/backend` directory
- [ ] Delete `/extension` directory
- [ ] Replace `CLAUDE.md` with `CLAUDE_DRAFT.md` (if not already done)
- [ ] Archive `guides/API.md` (Express routes no longer apply)
- [ ] Archive `guides/EXTENSION_DEPLOYMENT.md`
- [ ] Archive `guides/ENVIRONMENT_VARIABLES.md` (rewrite for Cloud Run env vars)
- [ ] Archive `planning/IDEA_DUMPING_GROUND.md`
- [ ] Update `reference/FLASHNOTE_HANDOFF.md` architecture sections
- [ ] Update `PRE_LAUNCH_CHECKLIST.md` (remove Chrome Web Store items)
- [ ] Update `STRIPE_TODOS.md` (remove extension sync item)
- [ ] Remove Sentry from all components (replaced by GCP-native monitoring — see [planning/MONITORING_SETUP.md](./planning/MONITORING_SETUP.md))

---

## Phase 2: PHI Storage

Full design: [planning/PHI_STORAGE_PLAN.md](./planning/PHI_STORAGE_PLAN.md) | Competitive context: [planning/TWOFOLD_DEEP_DIVE.md](./planning/TWOFOLD_DEEP_DIVE.md)

**Blocked by:** Phase 1 (migration complete) + Phase 0 HIPAA infrastructure (BAA signed, encryption at rest, audit retention)

### Remaining HIPAA Prerequisites

These items from Phase 0 HIPAA Infrastructure must be complete before PHI work begins:

| Item | Status |
|------|--------|
| Google Cloud BAA signed | ❌ |
| Database encryption at rest | ❌ |
| TLS 1.2+ enforced | ❌ |
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

### UI Quality

Full audit details: [compliance/UI_AUDIT.md](./compliance/UI_AUDIT.md)

#### P0 — Patient Safety & Legal

| Task | Ref | Status |
|------|-----|--------|
| Fix silent clipboard copy failure | 2.1 | ❌ |
| Fix color contrast failures (WCAG AA) | 1.1 | ❌ |

#### P1 — Accessibility Compliance

| Task | Ref | Status |
|------|-----|--------|
| Add `role="alert"` / `aria-live` to all dynamic content | 1.2 | ❌ |
| Add `aria-hidden="true"` to all decorative SVGs | 1.3 | ❌ |
| Fix nested `<Link><Button>` invalid HTML | 1.4 | ❌ |
| Add skip-to-content link | 1.5 | ❌ |
| Add `<main>` landmark to pages | 1.6 | ❌ |
| Fix focus management (outline, button focus, view transitions) | 1.8 | ❌ |
| Add responsive mobile navigation | 4.1 | ❌ |

#### P2 — UX Quality & Consistency

| Task | Ref | Status |
|------|-----|--------|
| Fix heading hierarchy violations | 1.7 | ❌ |
| Fix miscellaneous a11y issues (toggle labels, hints, aria-busy) | 1.9 | ❌ |
| Clear form errors on input change | 2.3 | ❌ |
| Fix dashboard off-brand alert colors | 3.2 | ❌ |
| Add responsive text sizing for hero/pricing headings | 4.2 | ❌ |
| Fix CTA button overflow on small screens | 4.3 | ❌ |
| Increase touch targets to 44x44px minimum | 4.4 | ❌ |

#### P3 — Polish

| Task | Ref | Status |
|------|-----|--------|
| Fix ErrorBoundary hardcoded colors | 3.5 | ❌ |
| Add dark mode support | 5.3 | ❌ |
| Add print styles | 5.4 | ❌ |

> Items removed (extension-specific or resolved by migration): 2.2 (✅ done), 2.4, 2.5, 2.7, 2.8, 2.9, 2.10, 2.11, 3.1, 3.3, 3.4, 5.1, 5.2. These either referenced extension components, the old API client, or patterns that no longer exist post-migration.

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

### Monitoring

Full plan: [planning/MONITORING_SETUP.md](./planning/MONITORING_SETUP.md)

> **Strategy change:** Monitoring is consolidating from Sentry + Axiom to GCP-native tooling (Cloud Logging + Cloud Error Reporting + Cloud Monitoring). Single BAA, $0/mo, zero additional vendors. See decision record in MONITORING_SETUP.md for rationale.

| Component | Status |
|-----------|--------|
| Logging gaps audit (12 gaps fixed) | ✅ Done (patterns transfer to new logger) |
| Pino structured logger + `@google-cloud/pino-logging-gcp-config` | ❌ |
| Client-side telemetry endpoint (`/api/telemetry`) | ❌ |
| Next.js `onRequestError` instrumentation hook | ❌ |
| Remove Sentry from all components | ❌ — after GCP logging verified in production |
| Cloud Logging log sink for HIPAA audit retention (6 years) | ❌ |
| Cloud Monitoring alert policies | ❌ |
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
- `SUBSCRIPTION_RENEWED` and `PAYMENT_FAILED` audit actions

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
| [planning/NEXTJS_MIGRATION_PLAN.md](./planning/NEXTJS_MIGRATION_PLAN.md) | Migration analysis, architecture decisions, build order, infrastructure |
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
