# FlashNote Development Roadmap

**Last Updated:** February 16, 2026

This is the **single source of truth** for all technical work status.

- Each task appears in exactly one place — here for code/technical work, [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) for business/legal/ops.
- Quality gate criteria (pass/fail definitions) live in [SUCCESS_METRICS.md](./SUCCESS_METRICS.md).
- Planning specs and reference docs never track status — they describe *what* to build, this doc tracks *is it done*.

---

## Dashboard

Work is organized into tiers by dependency order and competitive priority. Complete each tier before starting the next; items within a tier can be parallelized.

| Tier | Track | Progress | Next Action |
|------|-------|----------|-------------|
| **1** | [Security Hardening](#tier-1-security-hardening) | 1/69 findings | Fix 4 remaining CRITICALs (Audit PRs 1-2) |
| **1** | [Prompt Engineering](#tier-1-prompt-engineering) | 0/10 items | Lower temperature 0.7 → 0.2 |
| **2** | [HIPAA Infrastructure](#tier-2-hipaa-infrastructure) | 1/10 | Sign Google Cloud BAA |
| **3** | [PHI Storage](#tier-3-phi-storage) | Designed, 0/3 PRs | Patients + notes + templates |
| **4** | [UI Quality](#tier-4-ui-quality) | 0/32 | Fix clipboard + contrast |
| **4** | [Testing](#tier-4-testing) | Foundation done | Backend integration tests |
| **4** | [Accessibility Tooling](#tier-4-accessibility-tooling) | 2/5 phases | vitest-axe unit assertions |
| **5** | [Monitoring](#tier-5-monitoring) | ~75% | UptimeRobot setup |
| **5** | [Clinic Features](#tier-5-clinic-features-waves-2-4) | Wave 1 done | Wave 2A: org read endpoints |
| **5** | [Stripe](#tier-5-stripe) | 3 items left | Webhook cleanup job |
| — | [Business / Legal / Ops](./PRE_LAUNCH_CHECKLIST.md) | ~20% | Form LLC |

**Why this order:**
- **Tier 1** fixes real vulnerabilities in the current product and improves note quality. Quick wins, high impact.
- **Tier 2** is the hard dependency gate — cannot store PHI without HIPAA infrastructure in place.
- **Tier 3** is the competitive pivot — patients, notes, templates to compete with Twofold.
- **Tier 4** is important but non-differentiating. Interleave with Tier 3 as capacity allows.
- **Tier 5** is deferred until post-PHI (clinic admin, operational monitoring, Stripe polish).

---

## Tier 1: Security Hardening

Full audit: [compliance/CONSOLIDATED_AUDIT_2026_02.md](./compliance/CONSOLIDATED_AUDIT_2026_02.md) — 69 findings across 7 planned remediation PRs.

### Audit PRs 1-2 (Do Now — CRITICALs + HIGH auth/billing)

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| CR-1 | Webhook idempotency marks before processing — failed events permanently lost | CRITICAL | ❌ |
| CR-2 | Refresh token rotation race condition — token replay | CRITICAL | ❌ |
| CR-3 | Missing `trust proxy` — all IP-based security broken behind proxy | CRITICAL | ✅ Done |
| CR-4 | No security headers in web app (CSP, HSTS, X-Frame-Options) | CRITICAL | ❌ |
| CR-5 | No CSRF origin validation on web app mutations | CRITICAL | ❌ |

Plus ~18 HIGH findings (auth, billing, session management). See the full audit for the complete list and PR groupings.

### Audit PRs 3-7 (Interleave with Tier 4)

28 MEDIUM + 18 LOW findings covering error handling, logging gaps, configuration hardening, and code quality. Real improvements but not urgent vulnerabilities.

---

## Tier 1: Prompt Engineering

Full research: [planning/PROMPT_ENGINEERING_RESEARCH.md](./planning/PROMPT_ENGINEERING_RESEARCH.md)

### P0 — Do Now (config-level changes)

| Change | Effort | Status |
|--------|--------|--------|
| Lower temperature from 0.7 → 0.2-0.3 | Config change | ❌ |
| Move system prompt to Gemini `systemInstruction` field | Moderate refactor | ❌ |

### P1 — Do Soon

| Change | Effort | Status |
|--------|--------|--------|
| Add sandwich defense (repeat security rules after user content) | Small prompt edit | ❌ |
| Inject PT abbreviation reference into prompts | Prompt addition | ❌ |
| Add `needsReview` / `uncertainAreas` to output schema | Schema + prompt update | ❌ |

### P2-P3 — Defer

| Change | Effort | Status |
|--------|--------|--------|
| Add input length limits for quickNotes/patientContext | Zod validation | ❌ |
| Configure Gemini safety settings explicitly | Small API change | ❌ |
| Post-generation validation for hallucinated numbers | New validation fn | ❌ |
| Template-level style preferences (concise/narrative/detailed) | Feature work | ❌ |
| Structured input hints in extension UI | Frontend work | ❌ |

---

## Tier 2: HIPAA Infrastructure

These are **hard dependencies** for PHI storage. Without them, we cannot legally store patient data.

> **Regulatory Context:** The HITECH Act makes FlashNote directly liable for HIPAA violations as a Business Associate, with penalties up to $2.1M/year per violation category.

| # | Item | Type | Status |
|---|------|------|--------|
| 1 | **Sign Google Cloud BAA** — covers Cloud Run, Cloud SQL, Vertex AI | Ops | ❌ → [Checklist §2](./PRE_LAUNCH_CHECKLIST.md) |
| 2 | **Deploy to HIPAA-compliant hosting** — Cloud Run + Cloud SQL + TLS | Ops | ❌ → [Checklist §4](./PRE_LAUNCH_CHECKLIST.md) |
| 3 | **Database encryption at rest** | Ops | ❌ |
| 4 | **TLS 1.2+ enforced on all connections** | Ops | ❌ |
| 5 | **Audit log retention automation** — 6-year HIPAA requirement | Code | ❌ |
| 6 | **Audit log immutability protections** — database-level constraints | Code | ❌ |
| 7 | **Breach notification / incident response procedure** | Docs | ❌ |
| 8 | **Create `/baa` web page** — signup forms link to it, currently 404 | Code | ❌ |
| 9 | **Legal document re-acceptance flow** — prompt re-consent when doc versions bump | Code | ❌ |
| 10 | BAA acceptance in signup flow (backend) | Code | ✅ Done |

---

## Tier 3: PHI Storage

Full design: [planning/PHI_STORAGE_PLAN.md](./planning/PHI_STORAGE_PLAN.md) | Competitive context: [planning/TWOFOLD_DEEP_DIVE.md](./planning/TWOFOLD_DEEP_DIVE.md)

**Blocked by:** Tier 1 (audit PRs 1-2) + Tier 2 (HIPAA infrastructure)

| PR | Scope | Status |
|----|-------|--------|
| PHI-1 | Patients + clinical notes + note templates (SOAP built-in) + generation endpoint | ❌ |
| PHI-2 | Note versioning (immutable, append-only, per-section) | ❌ |
| PHI-3 | Web dashboard (patient list, note history, version timeline) | ❌ |

**What this enables:**
- Persistent patient records with context injection into all future notes
- Note history and amendment tracking (HIPAA-compliant)
- Template-driven dynamic sections (not hardcoded SOAP)
- Foundation for treatment plans, custom templates, multi-discipline support

---

## Tier 4: UI Quality

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

## Tier 4: Testing

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

## Tier 4: Accessibility Tooling

Full plan: [planning/ACCESSIBILITY_IMPLEMENTATION.md](./planning/ACCESSIBILITY_IMPLEMENTATION.md)

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | ESLint static analysis (`eslint-plugin-jsx-a11y`) | ✅ Done |
| 2 | Fix existing accessibility violations | ✅ Done |
| 3 | Unit test assertions (`vitest-axe`) | ❌ |
| 4 | E2E accessibility audits (`@axe-core/playwright`) | ❌ |
| 5 | Dev-time overlay (`@axe-core/react`) | ❌ |

---

## Tier 5: Monitoring

Full plan: [planning/MONITORING_SETUP.md](./planning/MONITORING_SETUP.md)

| Component | Status |
|-----------|--------|
| Sentry (all 3 components) | ✅ Done |
| Logging gaps audit (12 gaps fixed) | ✅ Done |
| UptimeRobot monitors | ❌ |
| Axiom log aggregation (optional) | ❌ |

---

## Tier 5: Clinic Features (Waves 2-4)

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

## Tier 5: Stripe

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
| Voice Input | [VOICE_INPUT_ROADMAP.md](./planning/VOICE_INPUT_ROADMAP.md) |
| Treatment Plan Generation | [PHI_STORAGE_PLAN.md](./planning/PHI_STORAGE_PLAN.md) (post Phase 1) |
| Custom Template Builder UI | [PHI_STORAGE_PLAN.md](./planning/PHI_STORAGE_PLAN.md) (Phase 2) |
| OAuth / Social Login | [OAUTH_ANALYSIS.md](./planning/OAUTH_ANALYSIS.md) |
| Conversational Mode | [TRUST_BUILDING_STRATEGY.md](./planning/TRUST_BUILDING_STRATEGY.md) |
| Review Mode | [TRUST_BUILDING_STRATEGY.md](./planning/TRUST_BUILDING_STRATEGY.md) |

---

## Recently Completed

| Item | Notes |
|------|-------|
| Wave 1: Registration Gating + Clinic Infrastructure | 4 PRs merged (usage split, invite codes, orgs, usage endpoint) |
| Auth Form UX Unification | Shared `AuthLayout`, consistent validation, matching fields |
| Unified Styling System | "Warm Wellness" theme, shared design tokens |
| Sentry Monitoring | All 3 components instrumented, 12 logging gaps fixed |
| Accessibility Phases 1-2 | ESLint jsx-a11y + violation fixes |
| MVP Foundation | All 15 quality gates passed |

---

## Related Documents

| Document | Role |
|----------|------|
| [SUCCESS_METRICS.md](./SUCCESS_METRICS.md) | Quality gate criteria (pass/fail definitions) |
| [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | Business, legal, and ops tasks |
| [STRIPE_TODOS.md](./STRIPE_TODOS.md) | Stripe reference (architecture, test cards, security) |
| [compliance/CONSOLIDATED_AUDIT_2026_02.md](./compliance/CONSOLIDATED_AUDIT_2026_02.md) | Security audit (69 findings, 7 remediation PRs) |
| [compliance/UI_AUDIT.md](./compliance/UI_AUDIT.md) | UI audit findings and affected files |
| [compliance/TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md) | Testing requirements and coverage targets |
| [planning/PHI_STORAGE_PLAN.md](./planning/PHI_STORAGE_PLAN.md) | PHI storage design (patients, notes, templates, versioning) |
| [planning/PROMPT_ENGINEERING_RESEARCH.md](./planning/PROMPT_ENGINEERING_RESEARCH.md) | Prompt optimization research (10 action items) |
| [planning/APP_GATING_STRATEGY.md](./planning/APP_GATING_STRATEGY.md) | Clinic feature design spec (Waves 1-4) |
| [planning/MONITORING_SETUP.md](./planning/MONITORING_SETUP.md) | Monitoring stack setup plan |
