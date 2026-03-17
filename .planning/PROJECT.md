# FlashNote

## What This Is

FlashNote is an AI-powered web application that helps Physical Therapists generate SOAP notes from shorthand input. It's a single Next.js 16 application with an integrated server-side backend (App Router, Server Components, Server Actions, DAL pattern) deployed on Google Cloud Run, backed by PostgreSQL on Cloud SQL, with Gemini 2.5 Flash via Vertex AI for note generation.

## Core Value

Physical Therapists can paste shorthand clinical notes and instantly receive a structured, professional SOAP note — saving 15-30 minutes per patient encounter.

## Requirements

### Validated

- Auth: Email/password signup, login, logout, password reset, email verification, session management (opaque tokens, sliding window refresh)
- Auth: Progressive account lockout with atomic SQL thresholds
- Auth: Invite code gating for registration
- Security: HIPAA-compliant audit logging (immutable, all auth/access events)
- Security: Upstash Redis rate limiting with compound keying (IP + email/userId) on all auth and generation endpoints
- Security: CSP nonce injection, security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- Security: Prompt injection detection and sanitization
- Notes: AI-powered SOAP note generation from shorthand input via Gemini 2.5 Flash (Vertex AI)
- Notes: Dual LLM provider support (Gemini + Claude) with retry/backoff
- Notes: PT-specific prompt templates with abbreviation reference injection
- Notes: Inline editing per SOAP section, Copy All, star rating widget
- Billing: Stripe subscription management (checkout, portal, webhooks with idempotency)
- Billing: Trial period with expiration enforcement
- Billing: Webhook event cleanup job (Cloud Scheduler)
- UI: Sidebar layout with responsive mobile drawer
- UI: Dashboard home with KPI cards, trial banner, quick action cards
- UI: Redesigned note generation form (step indicator, modality/duration fields, word count)
- UI: SOAP card display with teal accent bars, metadata bar, suggestions panel
- UI: Auth pages with consistent AuthLayout, trust signals, testimonials on landing page
- UI: Marketing pages with MarketingNav (mobile hamburger), Footer, BetaBadge
- UI: Teal design system tokens, Plus Jakarta Sans font, WCAG AA contrast compliance
- Infra: Next.js standalone Docker build, multi-stage Dockerfile, Cloud Run deploy pipeline (GitHub Actions)
- Infra: PostgreSQL with squashed migration schema (11 tables), connection pool singleton
- Infra: Graceful shutdown (SIGTERM handler, pool drain)
- Org: Organization/clinic infrastructure (orgs, members, seat limits, invite codes)
- Org: Usage tracking with input/output token split
- Testing: 1493+ tests, 97.79% statement coverage, Vitest + React Testing Library
- Accessibility: ESLint jsx-a11y enforcement, violation fixes (Rules 11-14 in CLAUDE.md)

### Active

- [ ] UI Phase E: Polish pass (touch targets 44px+, cursor audit, skeleton loaders, 375px responsive, print stylesheet, reduced-motion transitions)
- [ ] Monitoring: Pino structured logger + console.error migration (~44 calls across 18 files)
- [ ] Monitoring: Client-side telemetry endpoint (/api/telemetry) + error boundary wiring
- [ ] Monitoring: Sentry removal after Pino is verified in production
- [ ] Infra: Pipeline hardening (DB migration step in deploy, deep health check)
- [ ] Infra: GCP infrastructure provisioning (Cloud SQL, Secret Manager, Workload Identity Federation, custom domain)
- [ ] Infra: First staging deploy + end-to-end verification (Pino logs, Cloud Error Reporting, Vertex AI ADC, smoke tests)
- [ ] Billing: Stripe live mode activation (identity verification, production webhook, real payment test)
- [ ] Launch: Beta launch gate (min-instances=1, legal docs published, support email, 48hr stability soak, recruit beta testers)
- [ ] PHI: Patient records with context injection into future notes
- [ ] PHI: Clinical notes storage (HIPAA-compliant, append-only)
- [ ] PHI: Note templates (SOAP built-in, dynamic sections)
- [ ] PHI: Note versioning (immutable, per-section amendments)
- [ ] PHI: Dashboard UI (patient list, note history, version timeline)
- [ ] PHI: HIPAA prerequisites (audit log retention automation, legal document re-acceptance flow)
- [ ] Testing: E2E tests (auth flows, note generation, copy edge cases, rate limiting UX)
- [ ] Testing: DAST scanning (OWASP ZAP) + secret scanning (GitLeaks) in CI
- [ ] Testing: Manual penetration test
- [ ] Accessibility: vitest-axe unit test assertions, @axe-core/playwright E2E audits, @axe-core/react dev overlay
- [ ] Monitoring ops: Cloud Logging sink for HIPAA audit retention (6 years), alert policies, UptimeRobot
- [ ] Clinic: Admin dashboard (org read DAL, management actions, team page)
- [ ] Clinic: Clinic billing (Stripe clinic plan, seat-based pricing)
- [ ] Clinic: Org leave + transfer actions
- [ ] Stripe: Failed payment email notifications
- [ ] Prompt: Configure Gemini safety settings explicitly
- [ ] Prompt: Post-generation validation for hallucinated numbers
- [ ] Prompt: Template-level style preferences (concise/narrative/detailed)

### Out of Scope

- Dark mode — explicitly cut during UI overhaul; not worth the complexity for v1
- Chrome extension — sunset during migration; web app is the only client
- Direct EMR integrations — copy/paste only for v1; integration complexity not justified yet
- Voice input — researched but deferred to post-launch (see VOICE_INPUT_ROADMAP.md)
- OAuth/social login — email/password sufficient for v1 clinical audience
- API-as-a-service — would require extracting a standalone API server; no current demand
- Real-time chat/collaboration — not core to the note generation value prop
- Mobile native app — web-first; responsive design covers mobile use cases

## Context

- **Codebase state**: Next.js migration complete (Phase 0 + Phase 1, 9 sub-phases). All legacy code (Express backend, Chrome extension) deleted. UI overhaul 5/6 phases done.
- **Critical path to launch**: UI Polish E → Pino Logger → Pipeline Hardening → GCP Provisioning → Staging Deploy → Sentry Removal → Stripe Live → Beta Gate
- **PHI storage is the competitive pivot**: Persistent patients, notes, templates, versioning. Blocked on deployment readiness + HIPAA infra verification.
- **Testing**: 1493 tests with 97.79% coverage enforced by pre-commit hook. Security-critical paths have dedicated integration tests.
- **Technical debt**: ~44 console.* calls need Pino migration, /baa page awaiting legal content, Sentry to be replaced by GCP-native monitoring.
- **Target users**: Physical Therapists in clinical settings. They need fast, reliable, HIPAA-compliant documentation tools.
- **Competitive landscape**: TwoFold and similar PT documentation tools exist. FlashNote differentiates on AI-powered generation from shorthand + future PHI storage with context injection.

## Constraints

- **HIPAA**: All code must be HIPAA-compliant. PHI never in logs, error messages, or client-side storage beyond active session. Audit everything security-relevant. Violations carry penalties up to $1.5M/incident.
- **All-Google infra**: Cloud Run + Cloud SQL + Vertex AI, covered under one BAA. No multi-cloud.
- **No ORM**: Raw SQL via pg driver, enforced through DAL pattern. Deliberate choice for query control and HIPAA auditability.
- **Coverage floor**: 95%+ enforced by pre-commit hook. No exceptions.
- **Accessibility**: WCAG AA mandatory (Rules 11-14 in CLAUDE.md). 4.5:1 contrast, semantic landmarks, aria-live regions.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single Next.js app (no separate API) | One web client, no API-as-a-service need | Good |
| All-Google infrastructure | One BAA, one vendor, eliminates serverless pooling concerns | Good |
| Opaque session tokens (not JWT) | Every request needs DB roundtrip anyway (revocation, lockout checks) | Good |
| DAL as single authorization point | One codebase to audit for HIPAA compliance | Good |
| Gemini 2.5 Flash via Vertex AI | Cost efficiency + BAA coverage via Vertex AI | Good |
| Teal design system (no gradients, no dark mode) | WCAG AA contrast compliance, professional clinical aesthetic | Good |
| Extension sunset | Web app is sufficient; extension added maintenance burden without differentiation | Good |

---
*Last updated: 2026-03-16 after GSD initialization*
