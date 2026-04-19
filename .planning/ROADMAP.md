# Roadmap: FlashNote

## Overview

FlashNote is a production Next.js application with auth, billing, note generation, and UI already built. This roadmap covers the remaining requirements to complete feature development and (optionally) deploy to production. The project currently serves as a portfolio piece demonstrating HIPAA-compliant healthcare software engineering. Remote deployment is deferred until after feature development is complete. The critical path runs through PHI storage (the core differentiator), then post-PHI features, retention, and clinic features. Infrastructure provisioning (Phase 3) is already done; staging verification and production launch are deferred to the end.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: UI Polish** - Touch targets, cursor audit, skeletons, responsive, print, reduced-motion (completed 2026-03-17)
- [x] **Phase 2: Structured Logging** - Pino logger, console migration, client telemetry, error boundary wiring, instrumentation, Sentry removal (completed 2026-03-19)
- [x] **Phase 3: Pipeline & Provisioning** - Deploy pipeline hardening, deep health check, GCP infrastructure provisioning (completed 2026-03-19)
- [ ] **Phase 4: PHI Storage** - Patient records, note persistence, versioning, templates, context injection, HIPAA prerequisites, prompt improvements
- [ ] **Phase 5: Post-PHI Features** - PDF export, per-section copy, auto titles, time-saved tracking, note search
- [ ] **Phase 6: Retention & Differentiation** - Macro library, Magic Edit, failed payment notifications
- [ ] **Phase 7: Clinic Features** - Admin dashboard, member management, shared resources, seat-based billing, org lifecycle
- [ ] **Phase 8: Quality Hardening** - E2E tests, DAST scanning, secret scanning, accessibility testing, monitoring ops
- [ ] **Phase 9: Staging Verification** - First staging deploy, Vertex AI ADC, end-to-end smoke tests (DEFERRED — deploy only)
- [ ] **Phase 10: Production Readiness** - Stripe live mode, beta launch gate (DEFERRED — deploy only)

## Phase Details

### Phase 1: UI Polish
**Goal**: The application feels polished and professional on all devices, including mobile and print
**Depends on**: Nothing (first phase)
**Requirements**: UIPOL-01, UIPOL-02, UIPOL-03, UIPOL-04, UIPOL-05, UIPOL-06
**Success Criteria** (what must be TRUE):
  1. Every button, link, and interactive element is comfortably tappable on mobile (44px+ hit area)
  2. The entire app renders without horizontal scroll on a 375px viewport (iPhone SE)
  3. A user can print a generated note and get a clean, readable document without UI chrome
  4. All loading states show content-shaped skeletons instead of spinners
  5. Animations are smooth at 150-300ms and disappear entirely when the user has reduced-motion enabled
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Touch targets, cursor-pointer, and reduced-motion refinement (UIPOL-01, UIPOL-02, UIPOL-06)
- [ ] 01-02-PLAN.md — Responsive 375px, settings skeleton, and print stylesheet (UIPOL-03, UIPOL-04, UIPOL-05)

### Phase 2: Structured Logging
**Goal**: All server-side logging uses structured Pino output, client-side errors flow through a telemetry endpoint, and Sentry is fully removed -- establishing the logging foundation required for HIPAA audit compliance and eliminating the external error tracking dependency
**Depends on**: Nothing (can run in parallel with Phase 1)
**Requirements**: MON-01, MON-02, MON-03, MON-04, MON-05, MON-06
**Success Criteria** (what must be TRUE):
  1. Server logs are structured JSON in production (GCP format) and human-readable in dev (pino-pretty)
  2. All ~56 console.* calls in production code are replaced with Pino logger calls at appropriate severity levels
  3. Client-side JavaScript errors are captured and appear in server-side Pino logs via the telemetry endpoint
  4. Error boundaries (global-error.tsx, ErrorBoundary.tsx) automatically report to the telemetry endpoint
  5. The instrumentation.ts onRequestError hook logs through Pino instead of Sentry
  6. Sentry is fully removed (no SDK, no config files, no build args, no test mocks) and Pino is the sole error reporting path
**Plans**: 5 plans

Plans:
- [ ] 02-01-PLAN.md — Pino logger singleton, client telemetry library, telemetry endpoint (MON-01, MON-03)
- [ ] 02-02-PLAN.md — Console migration, error boundary wiring, instrumentation rewrite (MON-02, MON-04, MON-05)
- [ ] 02-03-PLAN.md — Sentry removal, instrumentation-client rewrite, ESLint tightening (MON-06)
- [ ] 02-04-PLAN.md — Gap closure: fix 4 TypeScript ESLint type errors for lint-clean gate
- [ ] 02-05-PLAN.md — Gap closure: add operational logging to happy paths and fix dev transport visibility (MON-01, MON-02)

### Phase 3: Pipeline & Provisioning
**Goal**: The deploy pipeline is hardened for safe production deployments and all GCP infrastructure is provisioned and configured
**Depends on**: Phase 2 (Pino must be in the codebase before infrastructure is provisioned)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08
**Success Criteria** (what must be TRUE):
  1. Database migrations run automatically before traffic cutover during deployment
  2. The health endpoint probes actual database connectivity and returns unhealthy when the DB is down
  3. Cloud Run, Cloud SQL, Artifact Registry, and Vertex AI APIs are all enabled and configured in the GCP project
  4. All runtime secrets (DB URL, Stripe keys, Upstash, Resend) are stored in Secret Manager, not environment variables
  5. Custom domain (flashnote.co) resolves to Cloud Run with valid SSL
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Terraform foundation, IAM/WIF, Cloud SQL, Secret Manager, Dockerfile cleanup (INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07)
- [x] 03-02-PLAN.md — Deploy workflow rewrite with staging/production split and migration job, CI terraform plan (INFRA-01, INFRA-02)
- [x] 03-03-PLAN.md — Cloud Run service/job Terraform, Global ALB with custom domain SSL (INFRA-01, INFRA-06, INFRA-08)

### Phase 4: PHI Storage
**Goal**: FlashNote transforms from a disposable generation tool into a clinical documentation platform -- users can create patients, persist notes, view history, and edit with full HIPAA-compliant versioning
**Depends on**: Phase 3 (audit logging infrastructure must be operational)
**Requirements**: PHI-01, PHI-02, PHI-03, PHI-04, PHI-05, PHI-06, PHI-07, PHI-08, PHI-09, PHI-10, PROMPT-01, PROMPT-02, PROMPT-03
**Success Criteria** (what must be TRUE):
  1. User can create a patient record and view a patient detail page with profile fields
  2. User can generate a note linked to a patient, and that note appears in the patient's chronological history
  3. User can edit individual SOAP sections of a saved note, and every edit creates a new immutable version (original never modified)
  4. User can set persistent free-text context on a patient that is automatically included in all future note generation for that patient
  5. Note generation uses template-driven prompts with configurable section preferences (concise/detailed) and explicit Gemini safety settings
**Plans**: 3 plans

Plans:
- [x] 04-01-foundation-PLAN.md — Migration, DAL, types, schemas, PHI cleanup hook (PHI-05, PHI-09, PHI-10 code, PROMPT-03 schema)
- [x] 04-02-patients-PLAN.md — Patient CRUD + detail + context + typeahead (PHI-01, PHI-04, PHI-09)
- [ ] 04-03-notes-versioning-PLAN.md — Template generation, note persistence, versioning, style prefs (PHI-02, PHI-03, PHI-04, PHI-05, PHI-06, PHI-07, PHI-09, PROMPT-01, PROMPT-02, PROMPT-03)

### Phase 5: Post-PHI Features
**Goal**: Users have the tools to manage, export, and find their persisted notes efficiently
**Depends on**: Phase 4
**Requirements**: POST-01, POST-02, POST-03, POST-04, POST-05
**Success Criteria** (what must be TRUE):
  1. User can export a note as PDF with patient name, provider signature, date, and all SOAP sections
  2. User can copy individual SOAP sections (not just Copy All)
  3. Notes have auto-generated descriptive titles visible in the patient's note history
  4. Dashboard KPI cards show time-saved tracking (per-note estimate and cumulative total)
  5. User can search across note content, patient name, and date range and get relevant results
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Retention & Differentiation
**Goal**: Users have personalization and AI-powered editing tools that build switching cost and keep subscribers engaged
**Depends on**: Phase 4 (macros are used in generation; Magic Edit operates on persisted notes)
**Requirements**: RET-01, RET-02, RET-03, BILL-05
**Success Criteria** (what must be TRUE):
  1. User can create, edit, and delete shorthand macros (e.g., `mtjm` expands to full clinical text) and macros persist across devices
  2. User can send a free-text instruction with an existing note to get an AI re-edit that creates a new version
  3. Users with failed payments receive email notifications before their subscription lapses
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Clinic Features
**Goal**: Clinic owners can manage their team, share resources, and pay for seats on a single subscription
**Depends on**: Phase 4 (clinic admin needs patient/note data), Phase 6 (shared macros extend macro library)
**Requirements**: CLINIC-01, CLINIC-02, CLINIC-03, CLINIC-04, CLINIC-05, CLINIC-06
**Success Criteria** (what must be TRUE):
  1. Org admin can view a team dashboard showing usage analytics per therapist
  2. Org admin can invite members, remove members, and see seat utilization
  3. Org admin can create shared templates and macros visible to all clinic members
  4. Clinic plan with seat-based pricing is available on the pricing page and manageable through Stripe
  5. A member can leave an organization, and an owner can transfer ownership to another member
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

### Phase 8: Quality Hardening
**Goal**: The application has comprehensive automated testing, security scanning, accessibility audits, and operational monitoring
**Depends on**: Phase 4 (E2E tests should cover PHI flows)
**Requirements**: QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, QUAL-06, QUAL-07, QUAL-08, MON-07, MON-08, MON-09
**Success Criteria** (what must be TRUE):
  1. E2E tests cover auth flows, note generation, copy edge cases, and rate limiting UX -- and pass in CI
  2. OWASP ZAP DAST scanning runs against staging on every PR and weekly full scans
  3. GitLeaks secret scanning blocks PRs that contain leaked credentials
  4. Accessibility violations are caught by @axe-core/playwright in E2E and @axe-core/react overlay in dev
  5. Cloud Logging audit sink exports to Cloud Storage with 6-year retention, alert policies fire on error spikes, and UptimeRobot monitors production
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD
- [ ] 08-03: TBD

### Phase 9: Staging Verification (DEFERRED)
**Goal**: The application runs successfully in the GCP staging environment with all integrations verified end-to-end
**Depends on**: Phase 3, Phase 8 (deploy after features are complete and hardened)
**Requirements**: INFRA-09, INFRA-10, INFRA-11, INFRA-12
**Success Criteria** (what must be TRUE):
  1. Pino logs appear in Cloud Logging and errors auto-group in Cloud Error Reporting
  2. Note generation works via Vertex AI ADC (not consumer API key) in the deployed environment
  3. A user can register, verify email, log in, generate a note, and log out in staging
  4. A user can complete Stripe checkout (test mode), webhook fires, subscription activates, and note generation unlocks
**Plans**: 2 plans (already prepared from prior Phase 4 planning)

Plans:
- [ ] 09-01-PLAN.md — Prerequisites, first staging deploy, Pino log verification (INFRA-09)
- [ ] 09-02-PLAN.md — Auth flow, note generation, and Stripe billing smoke tests (INFRA-10, INFRA-11, INFRA-12)

### Phase 10: Production Readiness (DEFERRED)
**Goal**: The application is ready for real users with real payments -- Stripe live, launch gate criteria met
**Depends on**: Phase 9 (Stripe live requires staging smoke tests passing)
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04
**Success Criteria** (what must be TRUE):
  1. Stripe is in live mode with identity verification complete and production webhook processing real events
  2. A real $1 payment succeeds, webhook processes correctly, and the charge is refunded
  3. Cloud Run has min-instances=1, legal docs are published, support email works, and 48 hours pass with no errors
**Plans**: TBD

Plans:
- [ ] 10-01: TBD
- [ ] 10-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10
(Phases 1 and 2 can run in parallel; Phases 9 and 10 are deferred until feature development is complete)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. UI Polish | 2/2 | Complete   | 2026-03-17 |
| 2. Structured Logging | 5/5 | Complete | 2026-03-19 |
| 3. Pipeline & Provisioning | 3/3 | Complete | 2026-03-19 |
| 4. PHI Storage | 0/3 | Not started | - |
| 5. Post-PHI Features | 0/2 | Not started | - |
| 6. Retention & Differentiation | 0/2 | Not started | - |
| 7. Clinic Features | 0/2 | Not started | - |
| 8. Quality Hardening | 0/3 | Not started | - |
| 9. Staging Verification | 0/2 | Deferred | - |
| 10. Production Readiness | 0/2 | Deferred | - |
