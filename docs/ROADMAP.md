# FlashNote Development Roadmap

**Last Updated:** February 1, 2026
**Overall Progress:** 19% (8/43 quality gates complete)

This document consolidates all pending work from across the project. Use this as your primary reference for what to work on next.

---

## Current Sprint: MVP Foundation Completion

**Goal:** Complete Phase 1 quality gates before any user testing.

### High Priority (Blockers)

| Task | Source | Status |
|------|--------|--------|
| Create extension icons (16, 32, 48, 128px) | SUCCESS_METRICS MVP-07 | Not started |
| Add Zod validation to extension | SUCCESS_METRICS MVP-12 | Not started |
| Add Error Boundary to extension | SUCCESS_METRICS MVP-13 | Not started |
| Add Error Boundary to web app | SUCCESS_METRICS MVP-14 | Not started |
| Connect web app auth to backend | SUCCESS_METRICS MVP-08 | Not started |
| Test extension auth with backend | SUCCESS_METRICS MVP-09 | Needs testing |
| Test note generation returns valid SOAP | SUCCESS_METRICS MVP-10 | Needs testing |

### Medium Priority

| Task | Source | Status |
|------|--------|--------|
| Add ESLint config to all projects | SUCCESS_METRICS MVP-15 | Not started |
| 24-hour grace period for past_due users | STRIPE_TODOS | Not started |
| Post-checkout subscription sync for extension | STRIPE_TODOS | Not started |
| Failed payment email notifications | STRIPE_TODOS | Not started |

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
| Extension password validation | SUCCESS_METRICS BETA-06 | Missing |
| Web dashboard with real data | SUCCESS_METRICS BETA-07 | Mock data only |
| Privacy policy page on web | SUCCESS_METRICS BETA-08 | Missing |
| Terms of service page on web | SUCCESS_METRICS BETA-09 | Missing |
| API request timeout handling | SUCCESS_METRICS BETA-10 | ✅ Done |
| Retry logic with backoff | SUCCESS_METRICS BETA-11 | ✅ Done |

---

## Phase 3: Production Ready

**Goal:** Complete before public launch.

### Test Coverage

| Target | Current | Goal |
|--------|---------|------|
| Backend | ✅ 28 test files | ≥80% |
| Extension | 0% | ≥70% |
| Web | 0% | ≥60% |

### Security & Compliance

| Task | Source | Status |
|------|--------|--------|
| Security headers fully configured | SUCCESS_METRICS PROD-04 | ✅ Done |
| CORS locked to production domains | SUCCESS_METRICS PROD-05 | ✅ Done |
| Database encryption at rest | SUCCESS_METRICS PROD-07 | Not deployed |
| TLS 1.2+ enforced | SUCCESS_METRICS PROD-08 | Not deployed |
| Vertex AI BAA signed | SUCCESS_METRICS PROD-09 | Not done |
| Error tracking (Sentry) | SUCCESS_METRICS PROD-11 | Not done |
| Audit logging workflow complete | SUCCESS_METRICS PROD-16 | Not done |

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
| Unified Styling System | [UNIFIED_STYLING_PLAN.md](./planning/UNIFIED_STYLING_PLAN.md) | Shared CSS components |

---

## Progress Summary

| Phase | Items | Done | Progress |
|-------|-------|------|----------|
| MVP Foundation | 15 | 7 | 47% |
| Beta Ready | 12 | 0 | 0% |
| Production Ready | 16 | 1 | 6% |
| **Total** | **43** | **8** | **19%** |

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
- [compliance/TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md) - Test coverage details
- [planning/MONITORING_SETUP.md](./planning/MONITORING_SETUP.md) - **Critical** - Sentry, UptimeRobot, Axiom setup plan
