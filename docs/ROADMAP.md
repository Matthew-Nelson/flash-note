# FlashNote Development Roadmap

**Last Updated:** February 8, 2026
**Overall Progress:** 31% (26/84 quality gates complete)

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
| BAA acceptance in signup flow | PRE_LAUNCH_LEGAL_COMPLIANCE | Not implemented |

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
| Backend `/usage/stats` endpoint | Web buildout dependency | Not started |
| Web dashboard with real data | SUCCESS_METRICS BETA-07 | ⚠️ Auth/subscription live, usage mock |
| Privacy policy page on web | SUCCESS_METRICS BETA-08 | ✅ Done |
| Terms of service page on web | SUCCESS_METRICS BETA-09 | ✅ Done |
| API request timeout handling | SUCCESS_METRICS BETA-10 | ✅ Done |
| Retry logic with backoff | SUCCESS_METRICS BETA-11 | ✅ Done |
| **Create `/baa` web page** | PRE_LAUNCH_LEGAL_COMPLIANCE | ❌ Not started — signup forms link to /baa, currently 404 |

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

> **Note:** This table tracks all work items across the project (84 total), including UI audit findings and HIPAA compliance tasks. For quality gates only (43 items), see [SUCCESS_METRICS.md](./SUCCESS_METRICS.md).

| Phase | Items | Done | Progress |
|-------|-------|------|----------|
| MVP Foundation | 15 | 15 | 100% |
| UI Quality (P0/P1/P2/P3) | 33 | 0 | 0% |
| Beta Ready | 12 | 9 | 75% |
| Production Ready | 16 | 5 | 31% |
| HIPAA/HITECH Critical Path | 8 | 0 | 0% |
| **Total** | **84** | **29** | **35%** |

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
- [compliance/TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md) - **Critical** - Unit, integration, E2E, and penetration testing requirements
- [compliance/UI_AUDIT.md](./compliance/UI_AUDIT.md) - **Critical** - UI quality audit: accessibility, error handling, responsiveness, styling
- [planning/MONITORING_SETUP.md](./planning/MONITORING_SETUP.md) - Sentry, UptimeRobot, Axiom setup plan
