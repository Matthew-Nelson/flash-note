# FlashNote Development Roadmap

**Last Updated:** February 14, 2026

This is the **single source of truth** for all technical work status.

- Each task appears in exactly one place — here for code/technical work, [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) for business/legal/ops.
- Quality gate criteria (pass/fail definitions) live in [SUCCESS_METRICS.md](./SUCCESS_METRICS.md).
- Planning specs and reference docs never track status — they describe *what* to build, this doc tracks *is it done*.

---

## Dashboard

| Track | Progress | Next Action | Priority |
|-------|----------|-------------|----------|
| [Launch Blockers](#launch-blockers) | 1/9 | Create `/baa` web page | **P0** |
| [UI Quality](#ui-quality) | 0/32 | Fix clipboard copy failure (patient safety) | P0 |
| [Testing](#testing) | Foundation done | Backend integration tests | P0 |
| [Clinic Features](#clinic-features-waves-2-4) | Wave 1 complete | Wave 2A: org read endpoints | P1 |
| [Stripe](#stripe) | 3 items left | Webhook event cleanup job | P1 |
| [Business / Legal / Ops](./PRE_LAUNCH_CHECKLIST.md) | ~20% | Form LLC | P0 |

---

## Launch Blockers

These items gate production. They come from multiple tracks but are collected here for visibility. Each links back to its track section for context.

| # | Item | Track | Status |
|---|------|-------|--------|
| 1 | **Create `/baa` web page** — signup forms link to it, currently 404 | Code | ❌ |
| 2 | **Legal document re-acceptance flow** — prompt re-consent when `LEGAL_DOCUMENT_VERSIONS` bumps | Code | ❌ |
| 3 | **Audit log retention automation** — 6-year HIPAA requirement | Code | ❌ |
| 4 | **Audit log immutability protections** — database-level constraints | Code | ❌ |
| 5 | **Webhook event cleanup job** — `processed_webhook_events` grows unbounded | Code | ❌ |
| 6 | **Backend integration tests** — auth lifecycle, session mgmt, billing webhooks | Code | ❌ |
| 7 | **Sign Google Cloud BAA** — covers Cloud Run, Cloud SQL, Vertex AI | Ops | ❌ → [Checklist §2](./PRE_LAUNCH_CHECKLIST.md) |
| 8 | **Deploy infrastructure** — Cloud Run + Cloud SQL + domain + TLS | Ops | ❌ → [Checklist §4](./PRE_LAUNCH_CHECKLIST.md) |
| 9 | BAA acceptance in signup flow (backend) | Code | ✅ Done |

---

## UI Quality

Full audit details, affected files, and implementation notes: [compliance/UI_AUDIT.md](./compliance/UI_AUDIT.md)

### P0 — Patient Safety & Legal

| Task | Ref | Status |
|------|-----|--------|
| Fix silent clipboard copy failure in ResultDisplay | 2.1 | ❌ |
| Fix color contrast failures across brand gradient colors (WCAG AA) | 1.1 | ❌ |

### P1 — Accessibility Compliance

| Task | Ref | Status |
|------|-----|--------|
| Add `role="alert"` / `aria-live` to all dynamic content | 1.2 | ❌ |
| Add `aria-hidden="true"` to all decorative SVGs | 1.3 | ❌ |
| Fix nested `<Link><Button>` invalid HTML (12 instances) | 1.4 | ❌ |
| Add skip-to-content link | 1.5 | ❌ |
| Add `<main>` landmark to 8 web pages | 1.6 | ❌ |
| Fix focus management (outline, button focus, view transitions) | 1.8 | ❌ |
| Route web auth pages through API client for retry logic | 2.2 | ❌ |
| Add responsive mobile navigation | 4.1 | ❌ |

### P2 — UX Quality & Consistency

| Task | Ref | Status |
|------|-----|--------|
| Fix heading hierarchy violations | 1.7 | ❌ |
| Fix miscellaneous a11y issues (toggle labels, hints, aria-busy) | 1.9 | ❌ |
| Clear form errors on input change | 2.3 | ❌ |
| Use Alert component consistently on dashboard | 2.4 | ❌ |
| Show actual error message during NoteGenerator error animation | 2.5 | ❌ |
| Add request timeouts to API clients | 2.7 | ❌ |
| Add nested ErrorBoundaries for view-level isolation | 2.11 | ❌ |
| Deduplicate extension CSS — import shared styles | 3.1 | ❌ |
| Fix dashboard off-brand alert colors | 3.2 | ❌ |
| Extract shared Nav/Footer/BetaBadge components | 3.4 | ❌ |
| Add responsive text sizing for hero/pricing headings | 4.2 | ❌ |
| Fix CTA button overflow on small screens | 4.3 | ❌ |
| Increase touch targets to 44x44px minimum | 4.4 | ❌ |

### P3 — Polish & Tech Debt

| Task | Ref | Status |
|------|-----|--------|
| Fix terminal resend verification error state | 2.8 | ❌ |
| Remove or adopt dead `useApi` hook | 2.9 | ❌ |
| Fix dashboard polling unmount cleanup | 2.10 | ❌ |
| Extract BETA badge into shared component | 3.3 | ❌ |
| Fix ErrorBoundary hardcoded colors | 3.5 | ❌ |
| Fix Settings toggle flash on load | 5.1 | ❌ |
| Fix placeholder Chrome Web Store link | 5.2 | ❌ |
| Add dark mode support | 5.3 | ❌ |
| Add print styles | 5.4 | ❌ |

---

## Testing

Full requirements and coverage targets: [compliance/TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md)

### Current Coverage

| Component | Test Files | Tests | Coverage |
|-----------|-----------|-------|----------|
| Backend | 38 | ~845 | ✅ Enforced 95% lines, 90% branches |
| Extension | 14 | ~233 | ✅ ~93% |
| Web | 19 | ~224 | ✅ ~92% |

### Remaining Work

| Task | Priority | Status |
|------|----------|--------|
| Backend integration tests (auth lifecycle, sessions, billing webhooks) | P0 | ❌ |
| E2E: API error handling tests | P0 | ❌ |
| E2E: Token refresh flow tests | P0 | ❌ |
| E2E: Copy functionality edge cases | P1 | ❌ |
| E2E: Floating button on EMR pages | P1 | ❌ |
| E2E: Rate limiting UX | P1 | ❌ |
| DAST scanning (OWASP ZAP) in CI | P1 | ❌ |
| Secret scanning (GitLeaks) in CI | P1 | ❌ |
| Manual penetration test | P1 | ❌ |
| Third-party security audit | P2 | ❌ (post-launch OK) |

---

## Clinic Features (Waves 2-4)

Full design spec: [planning/APP_GATING_STRATEGY.md](./planning/APP_GATING_STRATEGY.md)

**Wave 1 is complete** (PRs 1A-1D merged: usage token split, invite codes, org infrastructure, usage endpoint).

### Wave 2 — Clinic Admin Dashboard (post-beta)

| PR | Task | Status |
|----|------|--------|
| 2A | Org read endpoints (`GET /organization`, `/members`, `/usage`) | ❌ |
| 2B | Org management endpoints (`POST/DELETE/PATCH` invites, members) | ❌ |
| 2C | Web team dashboard page (`/dashboard/team`) | ❌ |

### Wave 3 — Clinic Billing (pre-launch)

| PR | Task | Status |
|----|------|--------|
| 3A | Stripe clinic plan integration (checkout, webhooks, `max_seats` sync) | ❌ |
| 3B | Web clinic plan on pricing page + owner billing UX | ❌ |

### Wave 4 — Polish & Voluntary Flows (pre-launch)

| PR | Task | Status |
|----|------|--------|
| 4A | `POST /organization/leave` + `/transfer` endpoints | ❌ |
| 4B | Extension org support + admin compliance view | ❌ |

---

## Stripe

Full reference (architecture, test cards, security notes): [STRIPE_TODOS.md](./STRIPE_TODOS.md)

| Task | Priority | Status |
|------|----------|--------|
| Webhook event cleanup job (production required) | P0 — launch blocker | ❌ |
| Failed payment email notifications | P1 — before launch | ❌ |
| Post-checkout subscription sync for extension (stale cache after checkout) | P1 — before launch | ❌ |

Post-launch:
- Trial ending soon notifications
- Subscription reactivation flow
- `SUBSCRIPTION_RENEWED` and `PAYMENT_FAILED` audit actions

---

## Future Features (Not Scheduled)

| Feature | Planning Doc |
|---------|-------------|
| OAuth / Social Login | [OAUTH_ANALYSIS.md](./planning/OAUTH_ANALYSIS.md) |
| Conversational Mode | [TRUST_BUILDING_STRATEGY.md](./planning/TRUST_BUILDING_STRATEGY.md) |
| Review Mode | [TRUST_BUILDING_STRATEGY.md](./planning/TRUST_BUILDING_STRATEGY.md) |
| Accessibility (WCAG AA) | [ACCESSIBILITY_IMPLEMENTATION.md](./planning/ACCESSIBILITY_IMPLEMENTATION.md) |

---

## Recently Completed

| Item | Notes |
|------|-------|
| Wave 1: Registration Gating + Clinic Infrastructure | 4 PRs merged (usage split, invite codes, orgs, usage endpoint) |
| Auth Form UX Unification | Shared `AuthLayout`, consistent validation, matching fields |
| Unified Styling System | "Warm Wellness" theme, shared design tokens |
| Sentry Monitoring | All 3 components instrumented, 12 logging gaps fixed |
| MVP Foundation | All 15 quality gates passed |

---

## Related Documents

| Document | Role |
|----------|------|
| [SUCCESS_METRICS.md](./SUCCESS_METRICS.md) | Quality gate criteria (pass/fail definitions) |
| [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | Business, legal, and ops tasks |
| [STRIPE_TODOS.md](./STRIPE_TODOS.md) | Stripe reference (architecture, test cards, security) |
| [compliance/UI_AUDIT.md](./compliance/UI_AUDIT.md) | UI audit findings and affected files |
| [compliance/TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md) | Testing requirements and coverage targets |
| [planning/APP_GATING_STRATEGY.md](./planning/APP_GATING_STRATEGY.md) | Clinic feature design spec (Waves 1-4) |
| [planning/MONITORING_SETUP.md](./planning/MONITORING_SETUP.md) | Monitoring stack setup plan |
