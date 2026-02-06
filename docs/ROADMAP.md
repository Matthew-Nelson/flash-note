# FlashNote Development Roadmap

**Last Updated:** February 5, 2026
**Overall Progress:** 47% (23/49 quality gates complete)

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
| Test extension auth with backend | SUCCESS_METRICS MVP-09 | Needs automated testing |
| Test note generation returns valid SOAP | SUCCESS_METRICS MVP-10 | Needs to change to account for new "trust" paradigm |

### Medium Priority

| Task | Source | Status |
|------|--------|--------|
| Add ESLint config to all projects | SUCCESS_METRICS MVP-15 | ✅ Done |
| **Fix stale user data bug (extension)** | [STALE_USER_DATA_BUG.md](./planning/STALE_USER_DATA_BUG.md) | ⚠️ P0 - Launch blocker |
| Failed payment email notifications | STRIPE_TODOS | Not started |
| Webhook event cleanup job (production required) | STRIPE_TODOS §Operations | Not configured |

> **Note:** The stale user data bug affects extension users who complete checkout on the web app - their subscription status doesn't sync back to the extension. See [STALE_USER_DATA_BUG.md](./planning/STALE_USER_DATA_BUG.md) for full analysis and recommended fix (focus-based refresh).

---

## HIPAA Critical Path (Launch Blockers)

These items are **required for production** with real patient data. They should be completed before or in parallel with Phase 3.

| Task | Source | Status |
|------|--------|--------|
| Audit log retention automation (6 years) | SUCCESS_METRICS PROD-10 | Not implemented |
| Audit log immutability protections | SUCCESS_METRICS PROD-16 | Not implemented |
| Sign Vertex AI BAA with Google Cloud | SUCCESS_METRICS PROD-09 | Not done |
| Database encryption at rest | SUCCESS_METRICS PROD-07 | Not deployed |
| TLS 1.2+ enforced on all connections | SUCCESS_METRICS PROD-08 | Not deployed |
| HIPAA-compliant hosting provider with BAA | PRE_LAUNCH_CHECKLIST §2 | Not done |

**Note:** Without these items complete, we cannot legally handle real PHI in production.

---

## Phase 2: Beta Ready

**Goal:** Complete before beta testing with real PTs.

### Testing & Validation

| Task | Source | Status |
|------|--------|--------|
| Backend unit tests ≥60% coverage | SUCCESS_METRICS BETA-01 | ✅ 28 test files |
| Manual auth flow testing (all apps) | SUCCESS_METRICS BETA-02 | Not done |
| Stripe checkout end-to-end test | SUCCESS_METRICS BETA-03 | Not tested |
| Verify trial expiration enforcement | SUCCESS_METRICS BETA-04 | Needs testing |
| Verify rate limiting works | SUCCESS_METRICS BETA-05 | Needs testing |

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

---

## Phase 3: Production Ready

**Goal:** Complete before public launch.

### Test Coverage

| Target | Current | Goal | Notes |
|--------|---------|------|-------|
| Backend | ✅ 28 test files | 95% lines, 90% branches | Healthcare-grade thresholds enforced in vitest.config.ts |
| Extension | 0% | ≥80% | Not configured |
| Web | 0% | ≥80% | Not configured |

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

| Issue | Description | Priority |
|-------|-------------|----------|
| Auth UI consistency | Extension and web app have different validation UX. Extension uses HTML5 native validation (browser tooltips) while web app uses React/Zod. Should unify to React/Zod validation with styled error messages for consistent UX. Remove `type="email"` and `minLength` HTML5 validation; use `noValidate` on forms. | Medium |
| Form validation pattern | Establish consistent pattern: validate on blur/change with Zod, show styled `.error-message` divs, not browser tooltips. Document in CLAUDE.md. | Medium |

## Recently Completed

| Feature | Notes |
|---------|-------|
| Unified Styling System | ✅ Implemented "Warm Wellness" theme - shared design tokens, component CSS, consistent green/teal palette across extension and web. See `/shared/README.md`. |

---

## Progress Summary

| Phase | Items | Done | Progress |
|-------|-------|------|----------|
| MVP Foundation | 15 | 12 | 80% |
| Beta Ready | 12 | 6 | 50% |
| Production Ready | 16 | 5 | 31% |
| HIPAA Critical Path | 6 | 0 | 0% |
| **Total** | **49** | **23** | **47%** |

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
- [planning/MONITORING_SETUP.md](./planning/MONITORING_SETUP.md) - Sentry, UptimeRobot, Axiom setup plan
