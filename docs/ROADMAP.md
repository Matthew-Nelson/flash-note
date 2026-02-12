# FlashNote Development Roadmap

**Last Updated:** February 10, 2026
**Overall Progress:** 36% (41/114 items complete)

This document consolidates all pending work from across the project. Use this as your primary reference for what to work on next.

---

## Current Sprint: MVP Foundation Completion

**Goal:** Complete Phase 1 quality gates before any user testing.

### High Priority (Blockers)

| Task | Source | Status |
|------|--------|--------|
| Create extension icons (16, 32, 48, 128px) | SUCCESS_METRICS MVP-07 | ✅ Done |
| Add Zod validation to extension | SUCCESS_METRICS MVP-12 | ✅ Done |
| Add Error Boundary to extension | SUCCESS_METRICS MVP-13 | ✅ Done |
| Add Error Boundary to web app | SUCCESS_METRICS MVP-14 | ✅ Done |
| Connect web app auth to backend | SUCCESS_METRICS MVP-08 | ✅ Done |
| Test extension auth with backend | SUCCESS_METRICS MVP-09 | ✅ Done |
| Test note generation returns valid SOAP | SUCCESS_METRICS MVP-10 | ✅ Done |

### Medium Priority

| Task | Source | Status |
|------|--------|--------|
| Add ESLint config to all projects | SUCCESS_METRICS MVP-15 | ✅ Done |
| **Fix stale user data bug (extension)** | [STALE_USER_DATA_BUG.md](./archive/STALE_USER_DATA_BUG.md) | ✅ Done (fixed in #41, #44) |
| Failed payment email notifications | STRIPE_TODOS | Not started |
| Webhook event cleanup job (production required) | STRIPE_TODOS §Operations | Not configured |


---

## P0: UI Quality Improvements

**Goal:** Fix patient-safety and accessibility compliance issues identified in the [UI Audit](./compliance/UI_AUDIT.md).

> Full audit details, affected files, and implementation notes are in [compliance/UI_AUDIT.md](./compliance/UI_AUDIT.md).

### P0 -- Patient Safety & Legal (Fix Now)

| Task | Audit Ref | Status |
|------|-----------|--------|
| Fix silent clipboard copy failure in ResultDisplay | [2.1] | Not started |
| Fix color contrast failures across brand gradient colors (WCAG AA) | [1.1] | Not started |

### P1 -- Accessibility Compliance (Fix Soon)

| Task | Audit Ref | Status |
|------|-----------|--------|
| Add `role="alert"` / `aria-live` to all dynamic content | [1.2] | Not started |
| Add `aria-hidden="true"` to all decorative SVGs | [1.3] | Not started |
| Fix nested `<Link><Button>` invalid HTML (12 instances) | [1.4] | Not started |
| Add skip-to-content link | [1.5] | Not started |
| Add `<main>` landmark to 8 web pages | [1.6] | Not started |
| Fix focus management (outline, button focus, view transitions) | [1.8] | Not started |
| Route web auth pages through API client for retry logic | [2.2] | Not started |
| Add responsive mobile navigation | [4.1] | Not started |

### P2 -- UX Quality & Consistency

| Task | Audit Ref | Status |
|------|-----------|--------|
| Fix heading hierarchy violations | [1.7] | Not started |
| Fix miscellaneous a11y issues (toggle labels, hints, aria-busy) | [1.9] | Not started |
| Clear form errors on input change | [2.3] | Not started |
| Use Alert component consistently on dashboard | [2.4] | Not started |
| Show actual error message during NoteGenerator error animation | [2.5] | Not started |
| ~~Add offline detection with user-facing banner~~ | [2.6] | Dropped — deferred to post-launch polish |
| Add request timeouts to API clients | [2.7] | Not started |
| Add nested ErrorBoundaries for view-level isolation | [2.11] | Not started |
| Deduplicate extension CSS -- import shared styles | [3.1] | Not started |
| Fix dashboard off-brand alert colors | [3.2] | Not started |
| Extract shared Nav/Footer/BetaBadge components | [3.4] | Not started |
| Add responsive text sizing for hero/pricing headings | [4.2] | Not started |
| Fix CTA button overflow on small screens | [4.3] | Not started |
| Increase touch targets to 44x44px minimum | [4.4] | Not started |

### P3 -- Polish & Tech Debt

| Task | Audit Ref | Status |
|------|-----------|--------|
| Fix terminal resend verification error state | [2.8] | Not started |
| Remove or adopt dead `useApi` hook | [2.9] | Not started |
| Fix dashboard polling unmount cleanup | [2.10] | Not started |
| Extract BETA badge into shared component | [3.3] | Not started |
| Fix ErrorBoundary hardcoded colors | [3.5] | Not started |
| Fix Settings toggle flash on load | [5.1] | Not started |
| Fix placeholder Chrome Web Store link | [5.2] | Not started |
| Add dark mode support | [5.3] | Not started |
| Add print styles | [5.4] | Not started |

---

## HIPAA/HITECH Critical Path (Launch Blockers)

These items are **required for production** with real patient data. They should be completed before or in parallel with Phase 3.

> **Regulatory Context:** The HITECH Act of 2009 makes FlashNote directly liable for HIPAA violations as a Business Associate, subject to direct OCR audits, with penalties up to $2.1M/year per violation category. These items address both HIPAA and HITECH requirements.

| Task | Source | Status |
|------|--------|--------|
| Audit log retention automation (6 years) | SUCCESS_METRICS PROD-10 | Not implemented |
| Audit log immutability protections | SUCCESS_METRICS PROD-16 | Not implemented |
| Sign Vertex AI BAA with Google Cloud | SUCCESS_METRICS PROD-09 | Not done |
| Database encryption at rest | SUCCESS_METRICS PROD-07 | Not deployed |
| TLS 1.2+ enforced on all connections | SUCCESS_METRICS PROD-08 | Not deployed |
| HIPAA-compliant hosting provider with BAA | PRE_LAUNCH_CHECKLIST §2 | Not done |
| Breach notification / incident response procedure | HITECH Act requirement | Not documented |
| BAA acceptance in signup flow (backend) | PRE_LAUNCH_LEGAL_COMPLIANCE | ✅ Done (legal_acceptances table + recordLegalAcceptances in auth-service) |
| **Create `/baa` web page** (so users can read the BAA) | PRE_LAUNCH_LEGAL_COMPLIANCE | ❌ Not started — signup forms link to /baa, currently 404 |
| **Legal document re-acceptance flow** (compare user's accepted version vs current `LEGAL_DOCUMENT_VERSIONS`, prompt re-consent if stale) | LEGAL_VERSIONING | Not started — P1 prod blocker |

**Note:** Without these items complete, we cannot legally handle real PHI in production. Under the HITECH Act, FlashNote is directly liable for compliance failures — independent of covered entities.

---

## Phase 2: Beta Ready

**Goal:** Complete before beta testing with real PTs.

### Testing & Validation

| Task | Source | Status |
|------|--------|--------|
| Backend unit tests ≥60% coverage | SUCCESS_METRICS BETA-01 | ✅ 31 test files, ~683 tests |
| Manual auth flow testing (all apps) | SUCCESS_METRICS BETA-02 | ✅ Done |
| Stripe checkout end-to-end test | SUCCESS_METRICS BETA-03 | ✅ Done (local override interception; live Stripe deferred to post-beta) |
| Verify trial expiration enforcement | SUCCESS_METRICS BETA-04 | ✅ Done |
| Verify rate limiting works | SUCCESS_METRICS BETA-05 | ✅ Done (dev mode uses relaxed limits; prod limits confirmed correct) |

### Feature Completion

| Task | Source | Status |
|------|--------|--------|
| Extension password validation | SUCCESS_METRICS BETA-06 | ✅ Done |
| ~~Backend `/usage/stats` endpoint~~ | ~~Web buildout dependency~~ | Superseded by `GET /usage/me` in Wave 1 below |
| ~~Web dashboard with real data~~ | ~~SUCCESS_METRICS BETA-07~~ | Superseded by Wave 1 items 8-9 below |
| Privacy policy page on web | SUCCESS_METRICS BETA-08 | ✅ Done |
| Terms of service page on web | SUCCESS_METRICS BETA-09 | ✅ Done |
| API request timeout handling | SUCCESS_METRICS BETA-10 | ✅ Done |
| Retry logic with backoff | SUCCESS_METRICS BETA-11 | ✅ Done |
| **Create `/baa` web page** | PRE_LAUNCH_LEGAL_COMPLIANCE | ❌ Not started — signup forms link to /baa, currently 404 |

### Registration Gating + Clinic Infrastructure (Wave 1) — Beta Blocker

> Full design: [planning/APP_GATING_STRATEGY.md](./planning/APP_GATING_STRATEGY.md) Wave 1. Each part is a separate PR with a code review gate — see the planning doc for review focus areas per PR.

**PR 1A — Usage token split + config:**

| Task | Source | Status |
|------|--------|--------|
| Usage schema migration: split `tokens_used` → `input_tokens` + `output_tokens` | APP_GATING_STRATEGY PR 1A | Done |
| Update `usageService.incrementUsage()` signature and callers | APP_GATING_STRATEGY PR 1A | Done |
| Add `REGISTRATION_MODE` to `config.ts` env schema | APP_GATING_STRATEGY PR 1A | Done |

**PR 1B — Invite codes + registration gating:**

| Task | Source | Status |
|------|--------|--------|
| Migration 010: `invite_codes` table | APP_GATING_STRATEGY PR 1B | Done |
| Modify `/auth/register`: registration mode + invite codes | APP_GATING_STRATEGY PR 1B | Done |
| Invite code generation CLI script (`scripts/generate-invite-code.ts`) | APP_GATING_STRATEGY PR 1B | Done |
| `POST /auth/invite-codes/validate` endpoint (with rate limit + audit logging) | APP_GATING_STRATEGY PR 1B | Done |
| Web signup: invite code field + extension schema sync | APP_GATING_STRATEGY PR 1B | Done |

**PR 1C — Organization infrastructure:**

| Task | Source | Status |
|------|--------|--------|
| Migration 011: `organizations`, `organization_members` tables, `users.organization_id` | APP_GATING_STRATEGY PR 1C | Done |
| New audit actions in `AuditAction` enum (ORG_*, INVITE_*) | APP_GATING_STRATEGY PR 1C | Done |
| Organization service (create, query, member management, billable seats) | APP_GATING_STRATEGY PR 1C | Done |
| Modify `requireActiveSubscription` middleware for org-based access | APP_GATING_STRATEGY PR 1C | Done |
| `requireOrgMembership` and `requireOrgRole` middleware | APP_GATING_STRATEGY PR 1C | Done |
| Modify registration: clinic invite code → auto-join org | APP_GATING_STRATEGY PR 1C | Done |
| `POST /organization/join` endpoint (existing user re-join, transactional) | APP_GATING_STRATEGY PR 1C | Done |

**PR 1D — Usage endpoint + web dashboard:**

| Task | Source | Status |
|------|--------|--------|
| `GET /usage/me` endpoint (replaces mock dashboard data) | APP_GATING_STRATEGY PR 1D | Done |
| Web dashboard: replace mock usage with real `/usage/me` data | APP_GATING_STRATEGY PR 1D | Done |
| Handle all subscription statuses distinctly in dashboard UI | APP_GATING_STRATEGY PR 1D | Done |
| Extension: add `organizationId` to `storedUserSchema` | APP_GATING_STRATEGY PR 1D | Done |

**Done when:** `REGISTRATION_MODE=invite` works, PT can register with beta code and see real usage, AND clinic admin can register → org created (manually) → clinic invite codes generated → PTs join org → subscription access works through org.

---

## Phase 3: Production Ready

**Goal:** Complete before public launch.

### Test Coverage

| Target | Current | Goal | Notes |
|--------|---------|------|-------|
| Backend | ✅ 31 test files, ~683 tests | 95% lines, 90% branches | Healthcare-grade thresholds enforced in vitest.config.ts |
| Extension | ✅ 14 test files, ~233 tests (~93%) | ≥80% | Configured with 80% thresholds |
| Web | ✅ 19 test files, ~224 tests (~92%) | ≥80% | Configured with 80% thresholds |

See [TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md) for integration, E2E, and penetration testing requirements.

### Security & Compliance

| Task | Source | Status |
|------|--------|--------|
| Security headers fully configured | SUCCESS_METRICS PROD-04 | ✅ Done |
| CORS locked to production domains | SUCCESS_METRICS PROD-05 | ✅ Done |
| Database encryption at rest | SUCCESS_METRICS PROD-07 | Not deployed |
| TLS 1.2+ enforced | SUCCESS_METRICS PROD-08 | Not deployed |
| Vertex AI BAA signed | SUCCESS_METRICS PROD-09 | Not done |
| Error tracking (Sentry) | SUCCESS_METRICS PROD-11 | ✅ Done (all components + logging gaps fixed) |
| Audit logging workflow complete | SUCCESS_METRICS PROD-16 | Not done |
| Legal document re-acceptance flow (prompt existing users when doc versions bump) | LEGAL_VERSIONING | Not started — P1 prod blocker |

### Testing (Beyond Unit Tests) - Production Blockers

See [TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md) for full requirements.

**These tests are required before public launch with real users:**

| Task | Source | Status | Priority |
|------|--------|--------|----------|
| Integration tests (backend) | TESTING_STRATEGY §5 | Not started | P0 |
| E2E tests (Playwright) | TESTING_STRATEGY §6 | ✅ Foundation complete (37 tests) | P0 |
| DAST scanning (OWASP ZAP) | TESTING_STRATEGY §7 | Not configured | P1 |
| Secret scanning (GitLeaks) | TESTING_STRATEGY §7 | Not configured | P1 |
| Manual penetration test | TESTING_STRATEGY §7 | Not scheduled | P1 |
| Third-party security audit | TESTING_STRATEGY §7 | Not scheduled | P2 (post-launch OK) |

**Milestones:**
1. Integration tests covering auth lifecycle, session management, billing webhooks
2. ✅ E2E tests for critical user journeys (register → verify → login → generate → copy)
3. DAST scan with zero high/critical findings

**E2E Test Coverage Gaps (to address before launch):**
- API error handling tests (network failures, 500 errors)
- Token refresh flow tests
- Floating button on EMR pages tests
- Copy functionality tests
- Rate limiting UX tests

### Wave 2: Clinic Admin Dashboard (Post-Beta)

> Full design: [planning/APP_GATING_STRATEGY.md](./planning/APP_GATING_STRATEGY.md) Wave 2. Three PRs: read endpoints, management endpoints, web UI.

| PR | Task | Status |
|----|------|--------|
| 2A | Org read endpoints (GET /organization, /members, /usage) | Not started |
| 2B | Org management endpoints (POST/DELETE/PATCH invites, members) | Not started |
| 2C | Web: Team dashboard page (`/dashboard/team`) | Not started |

### Wave 3: Clinic Billing (Pre-Launch)

> Full design: [planning/APP_GATING_STRATEGY.md](./planning/APP_GATING_STRATEGY.md) Wave 3. Two PRs: Stripe integration, web UI.

| PR | Task | Status |
|----|------|--------|
| 3A | Stripe clinic plan integration (checkout, webhooks, `max_seats` sync) | Not started |
| 3B | Web: clinic plan on pricing page + owner billing UX | Not started |

### Wave 4: Polish & Voluntary Flows (Pre-Launch)

> Full design: [planning/APP_GATING_STRATEGY.md](./planning/APP_GATING_STRATEGY.md) Wave 4. Two PRs: backend flows, extension + compliance.

| PR | Task | Status |
|----|------|--------|
| 4A | `POST /organization/leave` + `/transfer` endpoints | Not started |
| 4B | Extension org support + admin compliance view | Not started |

### Launch Preparation

| Task | Source | Status |
|------|--------|--------|
| Chrome Web Store listing | SUCCESS_METRICS PROD-12 | Not done |
| BAA template for customers | SUCCESS_METRICS PROD-13 | ⚠️ Template ready with pass-through model, needs legal review |
| Incident response plan | SUCCESS_METRICS PROD-14 | Not documented |

---

## Business & Legal (Pre-Launch)

See [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) for full details.

### Critical Path

1. **Business Formation** - LLC, EIN, bank account
2. **HIPAA Compliance** - Sign BAAs with Google Cloud, hosting provider
3. **Infrastructure** - Deploy to HIPAA-compliant hosting
4. **Payments** - Configure Stripe live mode, webhook cleanup job
5. **Legal** - Finalize and publish privacy policy, terms of service
6. **Chrome Store** - Submit extension for review

---

## Future Features (Not Scheduled)

These are researched but not prioritized for current development.

| Feature | Planning Doc | Notes |
|---------|--------------|-------|
| OAuth/Social Login | [OAUTH_ANALYSIS.md](./planning/OAUTH_ANALYSIS.md) | Google OAuth recommended |
| Conversational Mode | [TRUST_BUILDING_STRATEGY.md](./planning/TRUST_BUILDING_STRATEGY.md) | AI asks clarifying questions |
| Review Mode | [TRUST_BUILDING_STRATEGY.md](./planning/TRUST_BUILDING_STRATEGY.md) | AI reviews therapist's draft |

## Technical Debt / UX Improvements

*No outstanding items.*

## Recently Completed

| Feature | Notes |
|---------|-------|
| Auth Form UX Unification | ✅ Unified validation UX across web and extension. Shared `AuthLayout` component, consolidated error blocks with field-level borders (`invalid` prop), `invalidFields` in extension validation helpers, consistent headings/footers, removed native HTML5 validation. |
| Unified Styling System | ✅ Implemented "Warm Wellness" theme - shared design tokens, component CSS, consistent green/teal palette across extension and web. See `/shared/README.md`. |

---

## Progress Summary

> **Note:** This table tracks all work items across the project, including UI audit findings, HIPAA compliance, and gating strategy. For quality gates only (43 items), see [SUCCESS_METRICS.md](./SUCCESS_METRICS.md).

| Phase | Items | Done | Progress |
|-------|-------|------|----------|
| MVP Foundation | 15 | 15 | 100% |
| UI Quality (P0/P1/P2/P3) | 33 | 0 | 0% |
| Beta Ready (Wave 1 + existing) | 26 | 20 | 77% |
| Production Ready (Waves 2-4 + existing) | 30 | 5 | 17% |
| HIPAA/HITECH Critical Path | 10 | 1 | 10% |
| **Total** | **114** | **41** | **36%** |

---

## How to Use This Document

1. **Pick a task** from Current Sprint first
2. **Check the source doc** for detailed requirements
3. **Update this doc** when completing tasks
4. **Move to archive** when a planning doc is fully implemented

---

## Related Documents

- [SUCCESS_METRICS.md](./SUCCESS_METRICS.md) - Detailed quality gates
- [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) - Business launch requirements
- [STRIPE_TODOS.md](./STRIPE_TODOS.md) - Payment integration details
- [planning/APP_GATING_STRATEGY.md](./planning/APP_GATING_STRATEGY.md) - **Critical** - Beta rollout gating, clinic seat management, implementation waves
- [compliance/TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md) - **Critical** - Unit, integration, E2E, and penetration testing requirements
- [compliance/UI_AUDIT.md](./compliance/UI_AUDIT.md) - **Critical** - UI quality audit: accessibility, error handling, responsiveness, styling
- [planning/MONITORING_SETUP.md](./planning/MONITORING_SETUP.md) - Sentry, UptimeRobot, Axiom setup plan
