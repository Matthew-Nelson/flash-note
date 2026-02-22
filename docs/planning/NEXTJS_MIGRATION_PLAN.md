# Next.js Migration Plan

> Planning document capturing the architectural analysis and migration strategy for consolidating FlashNote from a three-component architecture (Express backend + Chrome extension + Next.js web app) to a single pure Next.js application.
>
> **Status**: Planning — not yet approved for implementation. Track implementation status in `docs/ROADMAP.md` once work begins.

---

## Table of Contents

- [Context](#context)
- [Architecture Options Evaluated](#architecture-options-evaluated)
- [Decision: Pure Next.js](#decision-pure-nextjs)
- [Infrastructure and Hosting](#infrastructure-and-hosting)
- [Vendor BAA Requirements](#vendor-baa-requirements)
- [HIPAA Compliance Assessment](#hipaa-compliance-assessment)
- [Known Concerns and Mitigations](#known-concerns-and-mitigations)
- [Session Token Strategy](#session-token-strategy)
- [Migration Strategy: Structured Transplant](#migration-strategy-structured-transplant)
- [What Transfers Directly](#what-transfers-directly)
- [What Needs Adaptation](#what-needs-adaptation)
- [What Gets Discarded](#what-gets-discarded)
- [Project Structure](#project-structure)
- [Test Migration](#test-migration)
- [Build Order](#build-order)
- [Risk Assessment](#risk-assessment)
- [Tooling Evaluation: GSD Framework](#tooling-evaluation-gsd-framework)
- [CLAUDE.md Updates](#claudemd-updates)
- [Resolved Decisions](#resolved-decisions)

---

## Context

FlashNote is migrating away from the Chrome extension as the primary client. Post-migration, the web app is the only client. This eliminates the original justification for a standalone Express API (serving multiple clients) and opens the question: what's the right architecture for a single Next.js web app with HIPAA-compliant auth, audit logging, and AI note generation?

The existing Express backend has ~800 tests, comprehensive middleware (auth, CSRF, rate limiting, subscription checks), and represents significant hardened security work. The web app is currently a thin client — ~75% `'use client'` components, no Server Actions, no server-side auth, all data fetched client-side via Bearer tokens stored in sessionStorage.

---

## Architecture Options Evaluated

### Option A: Express API only, Next.js middleware for route protection

- Next.js middleware reads session cookie for optimistic redirects
- All data fetching happens client-side calling Express (current pattern, cookies instead of Bearer)
- Express remains the single authority for auth, data, audit logging

**Pros**: Simplest architecture, smallest attack surface, keeps Vercel deployment trivial, all security properties identical to current system.

**Cons**: No SSR for protected pages — client loads, JS runs, calls API, then renders. Flash of loading state. Not leveraging Next.js's strengths.

**Verdict**: Viable and defensible. Undersold in the original analysis.

### Option B: Next.js DAL with direct DB access

- Next.js Server Components query the database directly through a Data Access Layer
- All auth, audit, HIPAA logic in one codebase
- One deployment, one test suite

**Pros**: Simplest when there's no separate API to maintain. Single codebase to audit. No cross-service communication. No cookie forwarding gymnastics.

**Cons**: Originally dismissed because it would duplicate logic across Express and Next.js. That argument evaporates when Express is removed.

**Verdict**: The right answer for a single-client architecture with no API-as-a-service requirement.

### Option C: BFF (Backend-for-Frontend) — Next.js Server Components call Express internally

- Next.js middleware reads session cookie for route protection
- Server Components make server-to-server HTTP calls to Express
- Express validates session, enforces auth, logs audit trail, returns data
- Client-side mutations go through Server Actions → Express API

**Pros**: Single authorization layer (Express), single audit trail, SSR works, defense in depth (two validation layers), PHI minimization (Next.js never touches DB).

**Cons**:
- **Deployment reality breaks the latency claim.** Web deploys to Vercel, Express is on separate infrastructure. Not "~1-5ms" internal hop — it's 50-200ms cross-network per Server Component fetch.
- **Operational complexity is understated.** Cookie forwarding in Server Components, layered error handling (Express → fetch → Server Component → client), two CSRF systems (Next.js Server Actions + Express CSRF middleware), deployment coupling.
- **"Defense in depth" is oversold.** Middleware is a UX optimization (fast redirect), not a security layer.

**Verdict**: The more capable architecture, but trades operational simplicity for SSR capability. Justified only if the API server has a future beyond serving the web app.

---

## Decision: Pure Next.js

**Option B — Next.js with DAL and direct DB access.**

### Rationale

1. **Single client, no API-as-a-service requirement.** The extension is being sunset. There is no near-term plan to offer note generation as a paid API to third-party platforms. If this changes, the architecture decision should be revisited — that would require extracting a standalone API server.

2. **Single codebase to audit.** "Show me every code path that can access patient data" has one answer: the DAL. For HIPAA compliance, this is the strongest property an architecture can have.

3. **No Express maintenance burden.** One deployment, one test suite, one set of infrastructure to monitor.

4. **The business logic is framework-agnostic.** Services (~2,400 LOC), queries (~700 LOC), types, schemas, and prompts have zero Express imports — they transfer with import path changes only. The Express-coupled surface (routes, middleware, app setup) is ~2,300 LOC concentrated in the HTTP and security layers. These require full rewrites as Server Actions and DAL wrappers, but the security properties live in the business logic, not the Express shell.

### Revisit Triggers

Re-evaluate this decision if:
- API-as-a-service becomes a real revenue stream (requires standalone API)
- A native mobile app is planned (requires API accessible outside Next.js)
- SSR latency with DB calls becomes problematic at scale (may need caching layer or API extraction)

---

## Infrastructure and Hosting

### The PHI Routing Problem

In the current architecture, PHI flows: **Browser → Express (Cloud Run) → Gemini API**. The web app on Vercel is a thin client — PHI goes directly from the browser to Express, never through Vercel's servers.

Post-pivot, PHI flows: **Browser → Next.js Server Action → LLM**. If Next.js runs on Vercel, PHI now passes through Vercel's infrastructure. This means Vercel becomes a business associate, requiring a BAA that wasn't previously needed.

This opens the question: should we stay on Vercel, or deploy Next.js elsewhere?

### Hosting Options Evaluated

#### Option 1: All-Google — Next.js on Cloud Run (Recommended)

| Component | Provider | BAA Coverage |
|---|---|---|
| Next.js app | Google Cloud Run | Google Cloud BAA |
| Database | Google Cloud SQL (PostgreSQL) | Google Cloud BAA |
| LLM | Google Vertex AI (Gemini) | Google Cloud BAA |
| Rate limiting | Upstash Redis | No BAA needed (no PHI — stores only IP hashes and counters) |

**Total BAAs: 1 (Google Cloud — free to sign)**

This is the strongest option because:

1. **One BAA covers everything.** Google Cloud BAA is free, self-serve, and covers Cloud Run, Cloud SQL, and Vertex AI under a single agreement. Fewer vendors in the PHI chain = less compliance surface to audit and monitor.

2. **Connection pooling problem vanishes.** Cloud Run runs Next.js as a long-lived container, not a per-invocation serverless function. The existing `pg.Pool` singleton pattern works unchanged. No PgBouncer, no Neon, no serverless driver needed.

3. **Network locality.** Cloud Run → Cloud SQL and Cloud Run → Vertex AI are on the same VPC. Low latency, no cross-cloud data transfer, no cross-network PHI transmission.

4. **Cost matches existing estimates.** Cloud Run (~$5-15/mo) + Cloud SQL (~$10-30/mo) + Vertex AI (usage-based). The $15-45/mo fixed infrastructure estimate from `FLASHNOTE_HANDOFF.md` still holds.

5. **Already the plan.** The original infrastructure decision was all-Google. This pivot preserves that decision — we're just deploying Next.js on Cloud Run instead of Express.

**Trade-offs:**
- Lose Vercel's DX (preview deployments, instant rollbacks, zero-config, edge CDN)
- Need to set up CI/CD pipeline (Cloud Build or GitHub Actions → Cloud Run)
- No edge network (all requests route to your Cloud Run region)
- Cold starts are slower than Vercel (mitigated by Cloud Run `min-instances=1` setting, ~$5/mo extra)

#### Option 2: Vercel + Neon + Google Vertex AI

| Component | Provider | BAA Coverage |
|---|---|---|
| Next.js app | Vercel | Vercel BAA (Pro plan) |
| Database | Neon | Neon BAA (Scale plan) |
| LLM | Google Vertex AI | Google Cloud BAA |

**Total BAAs: 3**

- Vercel Pro: ~$20/mo/seat + HIPAA (included on Pro, self-serve)
- Neon Scale: $5/mo minimum + usage + 15% HIPAA surcharge (coming soon)
- Google Cloud: free BAA
- Best developer experience, native serverless connection pooling
- **But: three vendors to audit, three BAAs to manage, three breach notification chains**

#### Option 3: Vercel + Google Cloud SQL + Vertex AI

| Component | Provider | BAA Coverage |
|---|---|---|
| Next.js app | Vercel | Vercel BAA (Pro plan) |
| Database | Google Cloud SQL | Google Cloud BAA |
| LLM | Google Vertex AI | Google Cloud BAA |

**Total BAAs: 2**

- Requires PgBouncer or Cloud SQL Auth Proxy for connection pooling (Vercel serverless → Cloud SQL)
- Cross-network latency on every Server Component render (Vercel → GCP)
- Operational overhead of running a connection pooler

#### Supabase — Eliminated

Supabase requires Team plan ($599/mo) + HIPAA add-on ($350/mo) = **~$950/mo minimum**. Non-viable at this stage.

### Infrastructure Decision

**Option 1: All-Google.** Deploy Next.js on Cloud Run. One BAA, one vendor, lowest cost, no connection pooling headaches. The DX trade-off (losing Vercel) is manageable — Cloud Run with GitHub Actions is a one-time setup.

### Revisit Trigger

If developer velocity becomes bottlenecked by Cloud Run's deployment experience, evaluate moving to Vercel with a two-BAA setup (Vercel + Google Cloud). This is a deployment change, not an architecture change — the app code doesn't care where it runs.

---

## Vendor BAA Requirements

### BAA Required

| Vendor | Why | BAA Cost | Status |
|---|---|---|---|
| **Google Cloud** | Hosts database (Cloud SQL), runs application (Cloud Run), processes PHI via LLM (Vertex AI). PHI is stored, processed, and transmitted through Google infrastructure. | Free (self-serve) | Not yet signed — Tier 2 roadmap item |

### BAA Recommended (Defense-in-Depth)

| Vendor | Why | BAA Cost | Status |
|---|---|---|---|
| **Sentry** | Error monitoring. Our `beforeSend` hooks and `sanitizeObject()` regex sanitize known PHI field patterns before data reaches Sentry, and `sendDefaultPii` is `false`. However, sanitization is code — code has bugs. If a new field name doesn't match the regex, PHI leaks to Sentry without a BAA in place. For healthcare software, $80/mo is cheap insurance against a sanitization bug becoming a HIPAA violation on top of the underlying issue. | ~$80/mo (Business plan) | Currently on free/lower tier — needs upgrade |

### No BAA Needed

| Vendor | Why Not |
|---|---|
| **Stripe** | Stripe never receives PHI. We send `metadata.userId` (a UUID) and price IDs — no patient data. HIPAA explicitly exempts financial transaction processing from Administrative Simplification requirements. Stripe cannot sign BAAs regardless (their upstream processors — PayPal, Coinbase — won't sign with them). |
| **Resend** | Resend sends verification and password reset emails to *therapists*, not patients. Therapist email addresses are PII (personally identifiable information) but not PHI (protected health information). PHI specifically concerns individually identifiable health information about patients. No patient data flows through email. |
| **Upstash** | Redis stores rate limit counters keyed by IP hash or user ID. No PHI is stored in or transmitted through Redis. Rate limit data is ephemeral and contains no health information. |
| **Namecheap** | Domain registrar. No PHI touches DNS infrastructure. |
| **GitHub** | Source code repository. PHI must never be committed to source code (enforced by code review practices). If PHI were found in the repo, that would be a breach regardless of GitHub's BAA status. |

### BAA Summary

**Minimum required for HIPAA compliance:** 1 BAA (Google Cloud — free)
**Recommended for defense-in-depth:** 2 BAAs (Google Cloud + Sentry Business — ~$80/mo)

### Sentry BAA Decision Rationale

The question of whether Sentry needs a BAA comes down to risk tolerance:

- **Technically**: If sanitization works perfectly, Sentry never receives PHI → Sentry is not a business associate → no BAA legally required
- **Practically**: Sanitization is a code-level control. The `sanitizeObject()` function uses regex pattern matching on field names (`patient`, `diagnosis`, `treatment`, `note`, `soap`, etc.). A field named `clinicalInfo` or `medicalHistory` that isn't in the pattern list would pass through unsanitized
- **Consequence of failure**: If a breach audit reveals PHI was sent to Sentry without a BAA, that's a HIPAA violation *on top of* whatever caused the breach
- **Cost of mitigation**: ~$80/mo for Sentry Business plan with BAA

For healthcare software where the operating principle is "when in doubt, be more secure," the BAA is the right call. The sanitization layer remains as defense-in-depth, not as the sole protection.

---

## HIPAA Compliance Assessment

**Pure Next.js meets all HIPAA requirements.** HIPAA doesn't care about frameworks — it cares about controls.

| Requirement | Current (Express) | Next.js Equivalent | Risk |
|---|---|---|---|
| Audit logging | `audit-service.ts` INSERT wrapper | Identical — same DB, same INSERT | None |
| PHI sanitization | `beforeSend` in Sentry, sanitized errors | Same utilities, ported to `@sentry/nextjs` | None |
| Encryption in transit | TLS (infrastructure) | TLS (infrastructure) | None |
| Auth/session management | JWT + bcrypt-hashed refresh tokens + `SELECT ... FOR UPDATE` | Same logic, cookies instead of Bearer | See session strategy |
| Input validation | Zod schemas everywhere | Same Zod schemas — framework-agnostic | None |
| Parameterized queries | 55 queries, all `$1`-parameterized, zero string concat | Same queries in DAL | None |
| Transactional integrity | 7 transaction sites with `BEGIN/COMMIT/ROLLBACK` | Same pattern, `pg` works in Next.js Node.js runtime | None |
| Progressive lockout | Atomic SQL with `CASE WHEN` thresholds | Same SQL — framework-agnostic | None |
| Immutable audit logs | `audit_logs` table, no UPDATE/DELETE | Same table, same policy | None |

The compliance lives in the business logic and SQL, not in Express.

---

## Known Concerns and Mitigations

### 1. Edge Runtime in Middleware

**Problem**: Next.js middleware runs on Edge Runtime. `jsonwebtoken` and `pg` don't work there. Full session validation requires a DB query.

**Mitigation**: Middleware does a lightweight cookie check (exists + not obviously expired) for fast redirects. Full session validation (DB lookup, lockout check) happens in Server Components and Server Actions running in Node.js runtime. Middleware is a UX layer, not a security boundary. Use `jose` library for any token operations needed at the Edge.

**Note**: On Cloud Run, Next.js middleware still runs in Edge-compatible mode by default. This concern applies regardless of hosting platform.

### 2. Connection Pooling

**Status: Resolved by infrastructure decision.**

Deploying Next.js on Cloud Run (not Vercel serverless functions) means the application runs as a long-lived container process. The existing `pg.Pool` singleton pattern works unchanged — same as the current Express setup. No PgBouncer, no serverless driver, no connection pooling changes needed.

If the hosting decision is revisited (e.g., move to Vercel), this concern re-emerges and would require PgBouncer, Neon's serverless driver, or the `global.pgPool` pattern.

### 3. Rate Limiting Infrastructure

**Problem**: 10 rate limiters currently use `express-rate-limit` with in-memory store. On Cloud Run, in-memory stores don't share state across instances if the service scales to multiple containers.

**Mitigation**: Redis-backed rate limiting via Upstash `@upstash/ratelimit`. The rate limit rules (5 login attempts per 15 min, etc.) transfer directly — only the backing store changes. Upstash is also the correct choice even on Cloud Run because rate limits must survive container restarts and work across scaled instances.

### 4. Cloud Run Cold Starts

**Problem**: Cloud Run scales to zero by default. Cold starts add 1-3 seconds to the first request after idle.

**Mitigation**: Set `min-instances=1` to keep one warm instance at all times. Adds ~$5/mo but eliminates cold start latency for active users. Acceptable cost for a healthcare app where responsiveness matters.

### 5. CI/CD Pipeline

**Problem**: Vercel provides zero-config deployments from Git. Cloud Run requires explicit build and deploy configuration.

**Mitigation**: GitHub Actions workflow: build Docker image → push to Artifact Registry → deploy to Cloud Run. One-time setup. Preview environments are possible via Cloud Run revisions with traffic splitting, though less seamless than Vercel's per-PR previews.

---

## Session Token Strategy

**Decision: Opaque session tokens, not JWT-in-cookie.**

### Rationale

Every authenticated request already requires a DB roundtrip for session validation (`tokenVersion` check in current system, session lookup in new system). JWT's "stateless" benefit is therefore moot — we're paying for the DB call regardless.

| | JWT-in-cookie | Opaque session token |
|---|---|---|
| Cookie size | ~500 bytes | ~36 bytes (UUID) |
| DB roundtrip required | Yes (tokenVersion check) | Yes (session lookup) |
| Revocation | Immediate (increment tokenVersion) | Immediate (delete session row) |
| Complexity | JWT generation + verification + version check | UUID generation + DB lookup |
| Migration effort | Lower (existing JWT logic stays similar) | Moderate (rewrite token verification path) |

Opaque tokens are smaller, simpler, and more honest about what's actually happening (every request checks the DB). The migration effort difference is modest — session lookup by ID vs JWT decode + version check.

### Cookie Configuration

- `httpOnly: true` — JavaScript cannot access the session ID
- `Secure: true` — cookie only sent over HTTPS
- `SameSite: 'Lax'` — prevents CSRF on cross-origin state-changing requests
- `Path: '/'` — available to all routes
- Cookie contains ONLY the session ID (UUID). Never store PHI, user data, or any other state.

### Session Refresh Strategy

**Decision: Sliding window with absolute maximum lifetime.**

- **Idle timeout: 24 hours.** If no authenticated request in 24 hours, the session expires.
- **Absolute maximum: 7 days from `created_at`.** Forces re-authentication regardless of activity. Matches current refresh token expiry.
- **Refresh debounce:** Only extend `expires_at` if more than 50% of idle timeout has elapsed (>12 hours since last refresh). Prevents write amplification from frequent requests — a user actively generating notes won't trigger a DB write on every request.
- **No explicit rotation.** The opaque token stays the same for the session lifetime. Revocation is immediate (delete session row).

**Why not explicit rotation?** Rotation adds complexity (concurrent tab race conditions, token replay detection) for marginal security benefit when the session can be instantly revoked via DB delete. The current system already pays for this complexity with JWT refresh token rotation — the migration is an opportunity to simplify.

**Session validation query (single roundtrip):**

```sql
SELECT id, user_id, expires_at, created_at
FROM sessions
WHERE token_hash = $1
  AND expires_at > NOW()
  AND created_at + INTERVAL '7 days' > NOW()
FOR UPDATE  -- Prevent concurrent modification
```

The `FOR UPDATE` lock is held briefly during the sliding window extension. Absolute expiry is computed from `created_at` rather than stored as a separate column — avoids schema change and is correct by construction.

### CSRF Protection Strategy

**Decision: No additional CSRF implementation needed at launch.**

- **Server Actions:** Get CSRF protection for free from Next.js (validates `Origin` header against the app's origin).
- **Webhook Route Handler** (`/api/webhooks/stripe`): Uses Stripe signature verification. CSRF is not applicable — webhooks are server-to-server.
- **Other Route Handlers:** None planned. If added for third-party API consumption in the future, port the existing HMAC CSRF implementation (`generateCsrfToken`/`validateCsrfToken` from `backend/src/middleware/csrf.ts` — framework-agnostic `crypto` module code).

The existing stateless CSRF implementation transfers if needed later, but Server Actions cover all current browser-initiated mutation paths.

---

## Project Structure

Post-migration directory layout for `web/src/`:

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
    utils/                # Pure utility functions (sentry-sanitization, etc.)
  server/                 # Server-only code (enforced by 'server-only' package)
    dal/                  # Data Access Layer (DB queries, row transforms)
    services/             # Business logic (auth, billing, email, AI, lockout, token, usage, audit)
    db/                   # Database connection pool + migration runner
    prompts/              # LLM prompt templates
    middleware/            # Auth validation, session management (called from Server Components/Actions)
  actions/                # Server Actions (grouped by domain: auth, notes, billing)
  test/                   # Test setup, helpers, factories
```

**Key conventions:**

- `server/` imports are forbidden from Client Components. Enforced by the `server-only` npm package — importing it from a Client Component is a build error.
- `lib/` is shared code that may be used on either client or server. No DB imports, no Node.js-only APIs.
- `actions/` contains Server Actions (`'use server'` files). Each action calls `server/` for business logic — actions are thin wrappers that handle cookie I/O, call services, and return results.
- `loading.tsx` and `error.tsx` at each route level provide streaming fallbacks and error boundaries. Design these intentionally — they're how errors surface to clinicians.
- Route groups `(auth)` and `(marketing)` share layouts without affecting URL structure.

---

## Migration Strategy: Structured Transplant

Not a tear-down. Not an incremental migration. A **structured transplant** — tested business logic moves from one framework shell to another.

The business logic (services, queries, types, schemas, prompts) is ~4,200 lines of framework-agnostic code that transfers with minimal adaptation. The Express-coupled surface (routes, middleware, app setup — ~2,300 LOC) concentrates in security-critical HTTP handling and requires full rewrites as Server Actions and DAL wrappers.

---

## What Transfers Directly

~4,200 lines of tested, hardened logic. Zero or trivial changes required.

| Asset | Approx Lines | Notes |
|---|---|---|
| 11 migration SQL files | ~310 | Pure SQL, completely portable |
| All Zod schemas (auth, notes, billing, config, LLM output) | ~400 | Framework-agnostic. Currently scattered across route files and `services/llm/schemas.ts` — consolidate into `lib/schemas/` during migration |
| Type definitions (`database.ts`, `index.ts`) | ~430 | Pure TypeScript (minus 2 Express-specific interfaces: `AuthenticatedRequest`, `OrgMembershipRequest`) |
| LLM provider layer (`services/llm/*`) | ~660 | Pure Node.js, no Express dependency. Excludes LLM Zod schemas (counted above) |
| Prompt templates (`prompts/pt-prompts.ts`) | ~270 | Pure strings |
| Prompt sanitization (`utils/prompt-sanitization.ts`) | ~137 | Pure functions |
| Sentry sanitization (`utils/sentry-sanitization.ts`) | ~124 | Pure functions |
| CSRF generation/validation (crypto functions) | ~120 | Pure `crypto` module. Full file is 121 LOC including Express middleware wrapper; crypto functions extract cleanly |
| Lockout service logic (`services/lockout-service.ts`) | ~234 | Pure logic + SQL |
| Token service logic (`services/token-service.ts`) | ~208 | Pure logic + SQL |
| Billing service logic (`services/billing-service.ts`) | ~490 | Stripe SDK + SQL |
| Usage service (`services/usage-service.ts`) | ~65 | Pure SQL |
| Audit service (`services/audit-service.ts`) | ~37 | Single INSERT |
| Query functions (`db/queries/*` — 7 files) | ~690 | SQL + row transforms. Largest: `users.ts` (~216), `invite-codes.ts` (~153), `organization-members.ts` (~124), `organizations.ts` (~110) |
| Row-to-domain transforms (`rowToUser`, etc.) | ~40 | Pure functions (3 transforms, embedded in query files) |
| Env loader (`env-loader.ts`) | ~95 | Loads and validates env vars before Sentry init. Port to `server/env.ts` with updated key names |
| Invite code format utility (`utils/invite-code-format.ts`) | ~15 | Pure utility function |

**Main adaptation needed**: Refactoring the `db` import from a singleton pool to a DAL-compatible pattern (dependency injection or shared connection module).

---

## What Needs Adaptation

Same logic, new framework wrapper.

| Component | Current Form | Next.js Form |
|---|---|---|
| `requireAuth` middleware | Express `(req, res, next)` | DAL wrapper: read cookie → validate session → return user or throw |
| `requireCsrf` middleware | Express middleware reading header | Server Actions get CSRF for free; Route Handlers need explicit protection |
| `requireEmailVerification` | Express middleware checking `user.emailVerified` | DAL utility function called from protected Server Actions (notes, billing) |
| `requireActiveSubscription` | Express middleware | DAL authorization check before data access |
| `requireOrgMembership` / `requireOrgRole` | Express middleware checking org membership/role | DAL utility functions. Currently used for org-admin features (Wave 2) — port the logic, wire up when org admin pages are built |
| `getRequestMetadata` | `utils/request-utils.ts` — extracts IP + user-agent from Express `Request` | Adapter function reading from Next.js `headers()` and forwarded-for headers. Called 11 times across middleware and routes |
| Route handlers (auth, notes, billing) | Express `router.post(...)` | Server Actions (mutations) or Route Handlers (webhooks) |
| Error handler | Express error middleware | `error.tsx` boundaries + try/catch in Server Actions/Route Handlers |
| Session creation/refresh | JWT Bearer flow | Cookie set/read flow (same crypto, different transport) |
| Rate limiters | `express-rate-limit` (in-memory) | Upstash `@upstash/ratelimit` (Redis-backed) |

---

## What Gets Discarded

| Component | Reason |
|---|---|
| Express app setup (`index.ts`, routing config) | Replaced by App Router |
| `express-rate-limit` config | Replaced by Upstash |
| Web `api.ts` client (token management) | Cookies handle transport; Server Components call DAL directly |
| Web `storage.ts` (sessionStorage) | Cookies replace it |
| Web `AuthProvider` initialization logic | Server-provided user data via Server Components |
| Web `ProtectedRoute` component | Middleware handles redirects |
| Entire `/extension` directory | Extension is being sunset |
| Entire `/backend` directory | Logic transplanted to Next.js; Express shell discarded |

---

## Test Migration

The backend has ~800 tests. Rough breakdown of portability:

| Test Category | Portability | Notes |
|---|---|---|
| Service/query unit tests (mock `db`) | **High** | Business logic tests. Change imports, keep assertions. |
| Zod schema validation tests | **Direct copy** | Framework-agnostic. |
| Route-level integration tests (supertest) | **Rewrite needed** | Test cases (scenarios/assertions) are valuable as specification. Test code needs rewriting for Next.js patterns. |
| Middleware unit tests | **Rewrite needed** | New wrapper patterns require new test structure. |
| LLM service tests | **High** | No Express dependency. |

Estimate: ~40-50% of test logic transfers with import changes. The rest needs rewriting, but the test scenarios are documented and don't need to be re-discovered.

The web app (331 tests) and extension (288 tests) tests are partially relevant:
- Web component tests for pages that stay similar may transfer
- Extension tests are fully discarded
- Web auth-related tests (api.ts, storage.ts, AuthProvider) need rewriting for the new patterns

---

## Build Order

Phases are sequential. Each phase is independently testable and committable. **Tests are written alongside each phase, not retrofitted at the end** — this is healthcare software where every phase contains security-critical code.

### Phase 0: Infrastructure Scaffold

Stand up the deployment pipeline before writing business logic. Validates Cloud Run + Next.js compatibility early and ensures every subsequent phase can be deployed and tested in a production-like environment.

- Configure `output: 'standalone'` in `next.config.js`
- Write multi-stage Dockerfile: Node.js build stage → `next build` → slim production image with standalone output + `public/` + `.next/static/`
- Set up GitHub Actions workflow: build image → push to Google Artifact Registry → deploy to Cloud Run
- Provision Cloud Run service with `min-instances=1`
- Provision Upstash Redis (rate limiting store)
- Deploy a hello-world Next.js page to verify the full pipeline
- **Verify**: Push to `main` triggers build → deploy → live page on Cloud Run. Upstash Redis is reachable from Cloud Run.

### Phase 1: DAL Foundation + Project Structure

- Create `server/` directory structure per [Project Structure](#project-structure)
- Set up `pg` pool (singleton, same pattern as current `backend/src/db/index.ts`)
- Copy query functions from `backend/src/db/queries/*` (7 files, ~690 LOC), adapt imports to `server/dal/` structure
- Copy types (minus Express-specific `AuthenticatedRequest`/`OrgMembershipRequest` interfaces), row transforms
- Copy audit service
- Port `email_tokens` table queries (used by token service for email verification and password reset tokens)
- Port env loader (`env-loader.ts`) to `server/env.ts` with updated environment variable keys
- Fix H-12 (non-null assertions on `result.rows[0]`) while porting queries
- Port query unit tests and type tests alongside code
- **Verify**: Query functions work, types compile, audit logging writes to DB, ported tests pass

### Phase 2: Session System + Auth Rate Limiting

Rate limiting is co-located with sessions because auth endpoints must never be exposed without brute-force protection. Building sessions without rate limits creates a security gap.

- Write migration 012: add `token_hash` column to `sessions` table for opaque session tokens (the existing `refresh_token_hash` column is JWT-specific and may need renaming or replacement)
- Implement opaque session token generation (`crypto.randomUUID()`)
- Session creation: hash token (SHA-256), insert into `sessions` table, set httpOnly cookie
- Session validation: read cookie → hash → lookup session → validate expiry (idle + absolute)
- Sliding window refresh: extend `expires_at` on authenticated requests, debounced (only if >50% of 24h idle TTL elapsed). Absolute max 7 days from `created_at`.
- Session revocation: delete session row + clear cookie
- Port device binding (IP + user agent stored for audit, not blocking)
- Port session limit enforcement (`MAX_SESSIONS_PER_USER = 5`, delete oldest)
- Port `SELECT ... FOR UPDATE` race condition protection from current refresh flow
- Set up Upstash `@upstash/ratelimit` with compound keying (IP + email/userId, not IP-only — fixes M-1):

  | Limiter | Window | Max | Key |
  |---------|--------|-----|-----|
  | `loginRateLimit` | 15 min | 5 | IP + email |
  | `registerRateLimit` | 1 hour | 3 | IP |
  | `refreshRateLimit` | 15 min | 30 | IP |
  | `passwordResetRequestRateLimit` | 1 hour | 3 | IP |
  | `passwordResetCompleteRateLimit` | 15 min | 5 | IP |
  | `verificationResendRateLimit` | 1 hour | 3 | IP |
  | `verificationCompleteRateLimit` | 15 min | 10 | IP |
  | `inviteCodeValidateRateLimit` | 1 min | 10 | IP |
  | `orgJoinRateLimit` | 15 min | 5 | IP |

- Port session tests and write rate limit tests (must verify requests are actually blocked after threshold — Rule 6)
- **Verify**: Sessions work end-to-end. Rate limits block after threshold. Race condition protection works. Tests pass.

### Phase 3: Auth Server Actions

- Login: validate credentials → check lockout → create session → set cookie
- Register: validate input → create user (transaction with legal consent, invite code, org membership) → create session → set cookie
- Logout: delete session → clear cookie → client clears state
- Password reset: request flow (send email) + complete flow (transaction: update password + delete all sessions + reset lockout)
- Email verification: send + verify flows (port token service + email service — both framework-agnostic)
- Port progressive lockout service (atomic SQL with `CASE WHEN` thresholds)
- Port Zod schemas for all auth inputs
- Fix H-4 pattern (no email in audit metadata) in all new audit calls
- Port auth service tests, lockout service tests, token service tests
- **Verify**: Full auth lifecycle works. Lockout triggers correctly. Password reset is transactional. No PHI in audit metadata. Tests pass.

### Phase 4: Middleware + Protected Pages + Error Boundaries

- Update Next.js middleware: CSP nonces + cookie-based auth redirect for `/dashboard/*` routes
- Build `getSession()` DAL function (read cookie → validate session → return user or null)
- Convert dashboard to Server Component (call `getSession()` → call DAL → render)
- Convert settings to Server Component
- Create `loading.tsx` for protected routes (streaming fallback during data fetch)
- Create `error.tsx` for protected routes (graceful error boundary — curated messages, not stack traces)
- Create `not-found.tsx` for 404s
- Create `/baa` page (currently 404 — deferred from Phase 0 HIPAA infrastructure)
- Port/rewrite middleware tests
- **Verify**: Unauthenticated users redirected. Protected pages render with server-provided data. Error boundaries handle failures gracefully. No flash of loading state. Tests pass.

### Phase 5: Note Generation

- Copy LLM service layer wholesale (`services/llm/*`, `prompts/*`, `utils/prompt-sanitization.ts`)
- Build Server Action with auth + subscription check + rate limiting
- Port usage tracking service
- Add `generateRateLimit` (1 min / 30 requests) and `apiRateLimit` (1 min / 100 requests) to Upstash
- Port LLM service tests and usage service tests
- **Verify**: Notes generate correctly. Rate limiting works. Usage tracked. PHI not logged. Tests pass.

### Phase 6: Billing

- Copy billing service (Stripe integration — framework-agnostic)
- Rewrite webhook Route Handler: raw body parsing via `req.arrayBuffer()` → `Buffer.from()` + Stripe signature verification + idempotency (replaces current proxy pattern in `web/src/app/api/webhooks/stripe/route.ts`). Next.js Route Handlers don't have Express's `raw()` middleware — use `arrayBuffer()` to get the raw body for signature verification
- Checkout and portal Server Actions
- Port subscription check to DAL (used by note generation gate)
- Webhook event cleanup job
- Port billing service tests, rewrite webhook integration tests
- **Verify**: Webhooks process correctly. Checkout works. Subscription status enforced. Cleanup job runs. Tests pass.

### Phase 7: Integration Tests + Production Verification

All unit tests should already be passing from Phases 1-6. This phase adds cross-cutting integration tests and validates the complete system.

- Integration tests: full auth lifecycle (register → verify email → login → generate note → logout)
- Integration tests: billing webhook processing (checkout → webhook → subscription active → note generation unlocked)
- Integration tests: rate limiting across endpoints (verify compound keying works)
- Integration tests: concurrent session handling (multiple tabs, session limit enforcement)
- Performance baseline: measure auth flow latency, note generation latency, protected page load times
- Staging deployment with synthetic data — full smoke test
- Security-critical path coverage audit (per Rule 6)
- **Verify**: All integration tests pass. Performance is acceptable. No regressions from Express baseline. Coverage meets standards.

---

## Risk Assessment

Identified risks ranked by severity and likelihood, with concrete mitigation strategies.

### Critical Risks

#### 1. Context Loss Across Sessions

**Severity: High | Likelihood: High**

This is a multi-week migration. AI-assisted development sessions have finite context windows. Security nuances embedded in the Express codebase (why a `SELECT ... FOR UPDATE` is there, why `CASE WHEN` is used for lockout instead of application logic, why the dummy bcrypt hash exists) can be lost between sessions, leading to subtle regressions.

**Mitigation:**
- Phase-by-phase commits with tests. Each phase is a self-contained unit of work that can be verified independently.
- Each session starts by re-reading the actual code being modified — not summaries, not memory files, the code.
- Reference specific `file_path:line_number` in commit messages and session notes, not abstractions like "the auth service."
- Port tests alongside code (not after). Tests encode the security requirements — if a test for "rejects `algorithm: 'none'` JWTs" exists, the new system must have an equivalent.
- The CLAUDE.md mandatory engineering rules (especially Rules 1, 6, 9, 10) serve as session-independent guardrails.

#### 2. No Rollback After Cutover

**Severity: High | Likelihood: Low**

If a critical bug surfaces post-cutover (e.g., session validation has an edge case that locks out users), there's no running Express backend to fall back to.

**Mitigation:**
- **Do not delete `/backend` on cutover.** Keep it in the repo for 4 weeks post-cutover. It's dead code but costs nothing.
- Cloud Run retains previous revisions. The Express backend's last working revision can be re-activated with `gcloud run services update-traffic --to-revisions=REVISION=100` if the new service fails catastrophically.
- Before cutover: run both services in parallel for 48 hours (Express on current URL, Next.js on a staging URL). Verify feature parity with manual smoke tests.
- Define a rollback trigger: if >5% of authenticated requests fail in the first 24 hours post-cutover, revert to Express revision.

### Elevated Risks

#### 3. Cloud Run + Next.js Operational Issues

**Severity: Medium | Likelihood: High**

Next.js is optimized for Vercel. Running on Cloud Run works but has known rough edges: standalone output mode configuration, static asset serving, image optimization, middleware Edge Runtime behavior, and build caching.

**Mitigation:**
- **Resolved by Phase 0.** The infrastructure scaffold phase validates the entire deployment pipeline with a hello-world app before any business logic is ported. If Cloud Run + Next.js has compatibility issues, they surface in Phase 0 — not Phase 6 when the billing system is half-ported.
- Specific known issues and their fixes:
  - **Standalone mode**: `output: 'standalone'` in `next.config.js`. Dockerfile copies `.next/standalone`, `.next/static`, and `public/`.
  - **Static assets**: Served from the container. If latency is measurable post-launch, add Cloud CDN (one-time config, no code change).
  - **Image optimization**: Install `sharp` as a dependency. Configure `images.loader` in `next.config.js` if needed.
  - **Cold starts**: `min-instances=1` keeps one warm instance (~$5/mo).

#### 4. Session Edge Cases

**Severity: Medium | Likelihood: Medium**

Moving from JWT Bearer tokens to opaque session cookies changes the auth transport layer entirely. Edge cases: concurrent tabs sharing a cookie, race conditions on session refresh, cookie size limits, cross-tab logout synchronization.

**Mitigation:**
- Port `SELECT ... FOR UPDATE` from the existing refresh flow — this is the proven pattern for preventing concurrent modification.
- Sliding window refresh with debounce (>50% of idle TTL elapsed) prevents write amplification from concurrent tab requests hitting the DB simultaneously.
- Cookies are ~36 bytes (UUID) — well under the 4KB browser limit.
- Cross-tab logout: use `BroadcastChannel` API to notify other tabs when logout occurs (same pattern as the current `flashnote:auth-invalidated` custom event, but cross-tab).
- Write explicit tests for concurrent session creation, session limit enforcement with race conditions, and cookie behavior across tabs.

#### 5. Test Regression Gap During Migration

**Severity: Medium | Likelihood: High (if tests are deferred)**

The original plan put all test work in Phase 8. This means 7 phases of security-critical code with no regression safety net, violating CLAUDE.md Rule 6 and the "verify after you act" principle.

**Mitigation:**
- **Resolved by restructure.** Tests are now ported alongside each phase. Every phase includes a "Verify" step with specific test coverage requirements.
- Phase 7 adds cross-cutting integration tests that exercise the full system — but by that point, each component already has unit test coverage.
- Existing test scenarios from the Express backend serve as a specification. Even when test code needs rewriting (e.g., supertest → Server Action invocation), the test cases (what's being verified) transfer directly.

#### 6. Next.js Version Lock-in / Breaking Changes

**Severity: Medium | Likelihood: Medium**

Next.js has frequent releases with breaking changes, especially in App Router, Server Actions, and middleware. Coupling tightly to Next.js-specific patterns creates upgrade risk.

**Mitigation:**
- Pin Next.js to a specific stable version. Don't chase canary releases.
- Prefer stable, well-documented patterns: App Router, Server Components, Server Actions, Route Handlers. Avoid experimental features.
- Keep business logic in `server/services/` (framework-agnostic). Server Actions in `actions/` are thin wrappers — if Next.js changes its Server Action API, only the wrapper layer needs updating.
- The DAL pattern is framework-agnostic by design. If Next.js becomes untenable, the `server/` directory could back a different framework with minimal changes.

#### 7. Audit Logging Latency in Server Actions

**Severity: Medium | Likelihood: Medium**

In Express, audit logs can fire-and-forget after the response is sent — the client isn't waiting on the audit INSERT. In Server Actions, audit logging is synchronous within the action — a slow DB write blocks the client response.

**Mitigation:**
- For most operations (login, logout, password reset), the audit log is part of a transaction that must complete before the response anyway (Rule 9). No behavioral change.
- For note generation and other non-transactional operations, use fire-and-forget with Sentry capture on failure: `auditService.log({...}).catch(err => Sentry.captureException(err))`. This matches the existing pattern.
- Phase 7 integration tests should include an audit logging latency baseline to verify this doesn't degrade user experience.

### Manageable Risks

#### 8. Forced Re-Login on Cutover

**Severity: Low | Likelihood: Certain**

JWT → opaque token is a breaking session format change. All existing sessions become invalid. Every user must re-login.

**Mitigation:**
- Acceptable for early-stage product with small user base.
- Communicate to users in advance via email (using existing Resend infrastructure).
- Schedule cutover during low-usage hours (early morning or weekend for PT clinics).
- Ensure the login page has a clear, non-alarming message ("We've upgraded our security infrastructure. Please sign in again.").

#### 9. Static Asset Serving Performance

**Severity: Low | Likelihood: Medium**

On Vercel, `_next/static` is served from a global CDN. On Cloud Run, static assets serve from the container in a single region.

**Mitigation:**
- For a healthcare B2B app with users primarily in one region, single-region serving is likely fast enough.
- Next.js standalone mode includes static file serving out of the box — no additional configuration needed.
- Monitor Core Web Vitals post-launch. If LCP or FCP degrades, add Cloud CDN in front of Cloud Run (single `gcloud` command, no code change).
- CSS and JS are already minified and hashed by Next.js build — browser caching handles repeat visits.

---

## Tooling Evaluation: GSD Framework

**Evaluated**: [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) — a meta-prompting framework for Claude Code that fights context rot via spec-driven development with fresh subagent contexts.

**Decision: Not adopted.** Reasons:

1. **Requires `--dangerously-skip-permissions`** — disqualifying for healthcare software where the CLAUDE.md exists to enforce discipline and review on every operation.

2. **Wrong problem.** GSD solves "how do I stay organized across many tasks." The migration's hard problem is "how do I ensure every security nuance survives the transplant." Context rot isn't the risk — lost context is.

3. **Fresh subagent contexts are a liability here.** Migration tasks are deeply interdependent. A subagent building the DAL without the full history of *why* the Express auth service works the way it does could introduce security regressions.

4. **Existing workflow is already structured.** CLAUDE.md rules, mandatory engineering rules, tiered roadmap. Adding GSD's planning layer would be redundant overhead.

**What we adopted from the principles:** The core idea of fighting context degradation is sound. Codified in CLAUDE_DRAFT.md under "Work in Phases, Not Marathons":
- Break multi-file work into independently testable/committable phases
- Start each session by re-reading the actual code being modified
- Verify the current phase before starting the next
- Reference specific `file_path:line_number` across sessions, not abstractions

---

## CLAUDE.md Updates

A full draft rewrite is at `CLAUDE_DRAFT.md` in the project root. Key changes from current CLAUDE.md:

- **Rewrote**: Project Overview, Architecture Decisions (with decision record), Tech Stack, Commands, Security Requirements, Error Codes, Password Policy locations
- **Replaced**: Rule 5 (centralized API client → DAL enforcement), Rule 8 (Express middleware → Next.js auth layers)
- **Updated**: Rules 1, 4 for new architecture context
- **Added**: Architecture Decision Record, Server Component vs Client Component guidelines, Server Actions patterns, Route Handler patterns, Cookie Security section, Serverless Constraints section, Middleware Responsibilities section, "Work in Phases, Not Marathons" workflow guidance
- **Kept verbatim**: Healthcare Standards, Working Relationship, Code Discipline (core), HIPAA Compliance, Code Quality Standards, Rules 2/3/6/7/9/10, Documentation Guidelines, Work Priorities, Sentry safe/unsafe extras

The draft should be reviewed and adopted when migration work begins. The current CLAUDE.md remains accurate for the existing architecture until then.

---

## Resolved Decisions

Formerly "Open Questions." All decisions are now finalized.

### Previously Resolved (by Infrastructure Decision)

- ~~**Connection pooling strategy**~~ — Cloud Run runs Next.js as a long-lived container. `pg.Pool` singleton works as-is. No PgBouncer or serverless driver needed.
- ~~**Hosting choice**~~ — All-Google (Cloud Run + Cloud SQL + Vertex AI). One BAA, one vendor.

### 1. Migration Runner

**Decision:** Standalone Node.js script run as a GitHub Actions step before deploying the new container.

Same pattern as current `backend/src/db/migrate.ts`, relocated to `web/src/server/db/migrate.ts`. The CI/CD pipeline runs `node scripts/migrate.js` after building the image but before deploying to Cloud Run. This ensures the database schema is updated before the new application code starts serving requests.

Migrations are NOT exposed as an API route or Server Action — that would create an unauthenticated endpoint capable of modifying the database schema.

### 2. Session Refresh Strategy

**Decision:** Sliding window with absolute maximum lifetime. See [Session Refresh Strategy](#session-refresh-strategy) for full details.

- 24-hour idle timeout (extended on authenticated requests, debounced)
- 7-day absolute maximum from `created_at`
- No explicit token rotation

### 3. CSRF for Route Handlers

**Decision:** No additional CSRF implementation needed at launch. See [CSRF Protection Strategy](#csrf-protection-strategy) for full details.

- Server Actions: built-in CSRF from Next.js
- Webhook Route Handler: Stripe signature verification
- No other Route Handlers planned
- Existing HMAC CSRF implementation is framework-agnostic and available if needed later

### 4. Email Service

**Decision:** Server Actions call the email service directly. No background job.

The email service (`backend/src/services/email-service.ts`, 223 LOC) is entirely framework-agnostic — it's the Resend SDK plus HTML templates. It transplants to `server/services/email-service.ts` with zero changes beyond import paths.

Called from auth Server Actions: register → verification email, password reset request → reset email. Email sends are fast (~200ms via Resend API) and happen synchronously within the auth flow. A background job adds complexity (job queue, failure handling, retry logic) for negligible latency improvement.

If email delivery latency becomes noticeable (unlikely — Resend is async on their end), the Server Action can fire-and-forget with `Promise.resolve().then(() => emailService.send(...))` and catch failures to Sentry.

### 5. Environment Variable Management

**Decision:** Audit and restructure environment variables for the new architecture.

**Server-only** (never prefixed with `NEXT_PUBLIC_`):
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — HMAC key for cookie signing (replaces `JWT_SECRET` / `JWT_REFRESH_SECRET`)
- `CSRF_SECRET` — retained for any future CSRF needs
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe server-side
- `RESEND_API_KEY` — email sending
- `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` — LLM provider keys
- All LLM config (`GEMINI_MODEL`, `GEMINI_TEMPERATURE`, etc.)
- `GCP_PROJECT_ID` — Cloud infrastructure
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — rate limiting (new)
- `REGISTRATION_MODE` — gating control

**Client-exposed** (`NEXT_PUBLIC_` prefix):
- `NEXT_PUBLIC_SENTRY_DSN` — already exists
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — for Stripe.js checkout (new — currently passed from backend)
- `NEXT_PUBLIC_APP_URL` — for canonical URLs, social meta tags

**Removed** (no longer needed):
- `API_URL` — no separate API server
- `ALLOWED_ORIGINS` — no CORS (same-origin)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — no JWTs
- `PORT` — Cloud Run manages port assignment via `PORT` env var automatically

**Configuration method:** Cloud Run env vars set via `gcloud run services update --set-env-vars` for non-sensitive values. Secrets use Google Secret Manager with Cloud Run secret mounts. Zod validation schema updated in `server/db/` config module.

### 6. Cutover Strategy

**Decision:** Clean cutover with forced re-login. No parallel deployment period.

The JWT → opaque token change means existing sessions are inherently incompatible. For an early-stage product with a small user base, a planned maintenance window is acceptable and far simpler than a dual-stack migration.

**Cutover sequence:**
1. Deploy Next.js to Cloud Run on a staging URL. Run full smoke test with synthetic data.
2. Run database migration (adds/modifies columns for opaque sessions if needed).
3. Update DNS to point to the new Cloud Run service.
4. Existing JWT-based sessions become invalid — users see a login page with a clear message.
5. Express Cloud Run revision is retained (not deleted) for 4 weeks as a rollback safety net.

**Rollback trigger:** If >5% of authenticated requests fail in the first 24 hours, revert DNS and Cloud Run traffic to the Express revision.

See [Risk Assessment: Forced Re-Login on Cutover](#8-forced-re-login-on-cutover) for user communication strategy.

### 7. Organization Features

**Decision:** Port during initial migration. Do not defer.

Organization logic is woven into:
- **Registration** (`auth-service.ts:44-110`): invite code validation, org membership creation, seat limit checks — all within the register transaction
- **Subscription checks** (`middleware/subscription.ts`): org-level subscription fallback when individual user has no active subscription
- **Usage tracking** (`routes/usage.ts`): org context in usage response

Extracting org logic would require untangling tested, working code. Porting it is less work than excising it and re-adding later. The org *admin features* (Wave 2: dashboard, invite management) remain deferred to Phase 3 of the roadmap — only the existing backend org logic is ported.

### 8. Sentry Plan Upgrade Timing

**Decision:** Upgrade to Sentry Business (with BAA) before first production deployment with real user data.

During development and beta testing with synthetic data, the current plan is acceptable — no real PHI exists to leak. The trigger for upgrading is: when the first real therapist creates an account in production.

Budget impact: ~$80/mo. This is the cost of "when in doubt, be more secure" applied to error monitoring.

### 9. Cloud Run CI/CD Setup

**Decision:** GitHub Actions → Google Artifact Registry → Cloud Run. Resolved in [Phase 0](#phase-0-infrastructure-scaffold).

- **CI/CD:** GitHub Actions (already used for the repo — no new tool to configure)
- **Image registry:** Google Artifact Registry (Container Registry is deprecated)
- **Docker strategy:** Multi-stage build:
  1. **Build stage:** `node:20-alpine`, install deps, `next build` with `output: 'standalone'`
  2. **Production stage:** `node:20-alpine` (slim), copy `.next/standalone`, `.next/static`, `public/`
  3. Entrypoint: `node server.js` (Next.js standalone server)
- **Deploy:** `gcloud run deploy flashnote --image=REGION-docker.pkg.dev/PROJECT/REPO/flashnote:SHA --region=REGION`
- **Secrets:** Google Secret Manager mounted as env vars in Cloud Run service config
- **Preview environments:** Cloud Run revisions with traffic splitting (less seamless than Vercel per-PR previews, but functional)
