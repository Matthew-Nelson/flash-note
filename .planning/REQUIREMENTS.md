# Requirements: FlashNote

**Defined:** 2026-03-16
**Core Value:** Physical Therapists can paste shorthand clinical notes and instantly receive a structured, professional SOAP note -- saving 15-30 minutes per patient encounter.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### UI Polish

- [x] **UIPOL-01**: All interactive elements have 44px+ touch targets
- [x] **UIPOL-02**: All clickable elements have `cursor-pointer`
- [x] **UIPOL-03**: Remaining spinner loading states replaced with content-shaped skeletons
- [x] **UIPOL-04**: All pages render without horizontal scroll at 375px viewport
- [x] **UIPOL-05**: Generated notes have a print stylesheet
- [x] **UIPOL-06**: All transitions are 150-300ms and respect `prefers-reduced-motion`

### Monitoring & Observability

- [x] **MON-01**: Server-side logging uses Pino structured logger with GCP JSON format in production and pino-pretty in dev
- [x] **MON-02**: All ~44 `console.*` calls across 18 production files replaced with structured Pino logging
- [x] **MON-03**: Client-side errors are captured via `/api/telemetry` endpoint and logged server-side through Pino
- [x] **MON-04**: Error boundaries (`global-error.tsx`, `ErrorBoundary.tsx`) report to telemetry endpoint
- [x] **MON-05**: `instrumentation.ts` `onRequestError` hook uses Pino instead of Sentry
- [x] **MON-06**: Sentry fully removed (config files, SDK dependency, build args, test mocks) after Pino verified in production
- [ ] **MON-07**: Cloud Logging log sink exports audit-tagged entries to Cloud Storage with 6-year locked retention
- [ ] **MON-08**: Cloud Monitoring alert policies for error spikes, auth failures, and billing webhook failures
- [ ] **MON-09**: External uptime monitoring (UptimeRobot) configured for production URL

### Infrastructure & Deployment

- [x] **INFRA-01**: Deploy pipeline runs DB migrations before traffic cutover
- [x] **INFRA-02**: `/api/health` probes DB connectivity (not just `{ status: 'ok' }`)
- [x] **INFRA-03**: GCP project provisioned with Cloud Run, Cloud SQL, Artifact Registry, Vertex AI APIs enabled
- [x] **INFRA-04**: LLM service account configured with `roles/aiplatform.user` for Vertex AI ADC
- [x] **INFRA-05**: Cloud SQL provisioned with encryption at rest, `require_ssl = true`, automatic backups
- [x] **INFRA-06**: Runtime secrets stored in Secret Manager (DB URL, Stripe keys, Upstash, Resend)
- [x] **INFRA-07**: Workload Identity Federation configured for keyless GitHub Actions auth
- [x] **INFRA-08**: Custom domain (flashnote.co) with SSL configured on Cloud Run
- [ ] **INFRA-09**: First staging deploy succeeds with Pino logs in Cloud Logging and errors in Cloud Error Reporting
- [ ] **INFRA-10**: Vertex AI ADC verified working in production (note generation uses ADC endpoint, not consumer API key)
- [ ] **INFRA-11**: Smoke test passes: register -> verify email -> login -> generate note -> logout
- [ ] **INFRA-12**: Smoke test passes: Stripe checkout (test mode) -> webhook -> subscription active -> notes unlocked

### Billing (Live Mode)

- [ ] **BILL-01**: Stripe identity verification completed (business docs, bank account)
- [ ] **BILL-02**: Production webhook endpoint configured in Stripe Dashboard
- [ ] **BILL-03**: Production webhook signing secret stored in Secret Manager
- [ ] **BILL-04**: Real payment verified ($1 charge, immediate refund) with webhook processing
- [ ] **BILL-05**: Failed payment email notifications sent to users

### Launch Gate

- [ ] **LAUNCH-01**: Cloud Run `min-instances` increased from 0 to 1 for production
- [ ] **LAUNCH-02**: Legal documents published on site (Terms, Privacy Policy, BAA)
- [ ] **LAUNCH-03**: Support email working (support@flashnote.co)
- [ ] **LAUNCH-04**: 48-hour stability soak with no errors, crashes, or monitoring alerts

### PHI Storage

- [ ] **PHI-01**: User can create a patient record with minimal fields (name, pronoun) and view patient detail page with additional fields (DOB, phone, email)
- [ ] **PHI-02**: User can save generated notes linked to a patient with session metadata (date, duration, modality)
- [ ] **PHI-03**: User can view chronological note history for a patient (date, title, duration, modality)
- [ ] **PHI-04**: User can store persistent free-text context per patient that is automatically injected into all future note generation for that patient
- [ ] **PHI-05**: All note edits create append-only versions (original never deleted) with immutable amendment trail for HIPAA compliance
- [ ] **PHI-06**: User can inline edit individual SOAP sections of persisted notes (creating new versions)
- [ ] **PHI-07**: Note generation uses template-driven prompts (SOAP built-in template with user-configurable section preferences: concise/detailed, paragraph/bullets)
- [ ] **PHI-08**: Incident response plan updated to reflect PHI storage (currently says "no PHI stored")
- [ ] **PHI-09**: Audit logging covers PHI read access (patient list views, note history views), not just mutations
- [ ] **PHI-10**: HIPAA prerequisites verified before PHI launch: encryption at rest, TLS 1.2+, audit retention sink operational

### Post-PHI Features

- [ ] **POST-01**: User can export a single note or bulk-export notes as PDF with patient name, provider signature, date, and all SOAP sections
- [ ] **POST-02**: User can copy individual SOAP sections (not just "Copy All")
- [ ] **POST-03**: Notes have auto-generated descriptive titles (e.g., "Lumbar Spine Rehabilitation Progress" not "Note - 2026-03-16")
- [ ] **POST-04**: Dashboard KPI cards show time-saved tracking (per-note estimate and cumulative)
- [ ] **POST-05**: User can search across note content, patient name, and date range

### Retention & Differentiation

- [ ] **RET-01**: User can create and manage a personal shorthand/macro library (e.g., `mtjm` -> `manual therapy -- joint mobilization grade III/IV`)
- [ ] **RET-02**: Macros are server-stored and available across devices
- [ ] **RET-03**: User can send a free-text instruction with an existing note for AI re-edit ("Magic Edit") that creates a new version

### Clinic Features

- [ ] **CLINIC-01**: Org admin can view team dashboard with usage analytics per therapist
- [ ] **CLINIC-02**: Org admin can manage members (invite, remove, view seats)
- [ ] **CLINIC-03**: Org admin can manage shared templates and macros at the clinic level
- [ ] **CLINIC-04**: Stripe clinic plan with seat-based pricing (per-seat quantity on subscription)
- [ ] **CLINIC-05**: Clinic plan displayed on pricing page with owner billing UX
- [ ] **CLINIC-06**: User can leave organization; owner can transfer ownership

### Quality & Security

- [ ] **QUAL-01**: E2E tests cover auth flows (login, register, logout, password reset)
- [ ] **QUAL-02**: E2E tests cover note generation flow
- [ ] **QUAL-03**: E2E tests cover copy functionality edge cases
- [ ] **QUAL-04**: E2E tests cover rate limiting UX
- [ ] **QUAL-05**: DAST scanning (OWASP ZAP) runs in CI against staging
- [ ] **QUAL-06**: Secret scanning (GitLeaks) runs on every PR
- [ ] **QUAL-07**: Accessibility testing via @axe-core/playwright in E2E test suite
- [ ] **QUAL-08**: @axe-core/react dev-time overlay available in development mode

### Prompt Improvements

- [ ] **PROMPT-01**: Gemini safety settings configured explicitly (not default)
- [ ] **PROMPT-02**: Post-generation validation detects hallucinated numbers (ROM values, strength grades)
- [ ] **PROMPT-03**: Template-level style preferences (concise/narrative/detailed) configurable per user

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Differentiation

- **DIFF-01**: Patient instructions section (plain-language summary generated alongside SOAP note)
- **DIFF-02**: Last note summary (AI-generated 4-sentence summary on patient overview page)
- **DIFF-03**: Treatment plan generation from recent notes (persisted per patient, injected into future generation)
- **DIFF-04**: CPT/ICD-10 code suggestions based on note content
- **DIFF-05**: EMR-specific output formatting (prompt engineering per EMR field structure)
- **DIFF-06**: Custom template builder (per-section configuration: title, verbosity, styling, content instructions)
- **DIFF-07**: Condition-specific templates with typical interventions, measurements, and goals
- **DIFF-08**: Documentation quality scoring (completeness rubric with trending)

### Security

- **SEC-01**: Manual penetration test
- **SEC-02**: Third-party security audit
- **SEC-03**: MFA support (preparation for proposed HIPAA rule mandate)

### Voice

- **VOICE-01**: Dictation mode (lightweight voice input complement to shorthand)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Direct EMR API integration | Per-EMR BAAs, massive API surface, ongoing maintenance. EMR-specific output formatting captures 80% of value at 5% complexity. |
| Ambient voice recording | Margin-negative at current pricing ($0.50-1.50/session), massive HIPAA exposure, competing on competitors' turf. Shorthand is the differentiator. |
| Scheduling / appointment management | Every EMR already handles this. Not a documentation tool's job. |
| Practice management (billing, RCM, claims) | Massive domain requiring clearinghouse integrations. Stay focused on documentation. |
| Patient portal / patient-facing app | Fragments patient experience. Patient instructions via existing channels instead. |
| Dark mode | Doubles design/test surface for a clinical tool used in well-lit settings. |
| Chrome extension | Sunset during migration. Web app is the only client. |
| Real-time collaboration / co-editing | PTs write notes individually. No clinical workflow justification. |
| Gamification (streaks, badges) | Patronizing in clinical context. Time-saved tracking provides meaningful engagement. |
| HEP builder with exercise library | WebPT, HEP2go already dominate. Generate HEP text in note output instead. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UIPOL-01 | Phase 1 | Complete |
| UIPOL-02 | Phase 1 | Complete |
| UIPOL-03 | Phase 1 | Complete |
| UIPOL-04 | Phase 1 | Complete |
| UIPOL-05 | Phase 1 | Complete |
| UIPOL-06 | Phase 1 | Complete |
| MON-01 | Phase 2 | Complete |
| MON-02 | Phase 2 | Complete |
| MON-03 | Phase 2 | Complete |
| MON-04 | Phase 2 | Complete |
| MON-05 | Phase 2 | Complete |
| MON-06 | Phase 2 | Complete |
| MON-07 | Phase 10 | Pending |
| MON-08 | Phase 10 | Pending |
| MON-09 | Phase 10 | Pending |
| INFRA-01 | Phase 3 | Complete |
| INFRA-02 | Phase 3 | Complete |
| INFRA-03 | Phase 3 | Complete |
| INFRA-04 | Phase 3 | Complete |
| INFRA-05 | Phase 3 | Complete |
| INFRA-06 | Phase 3 | Complete |
| INFRA-07 | Phase 3 | Complete |
| INFRA-08 | Phase 3 | Complete |
| INFRA-09 | Phase 4 | Pending |
| INFRA-10 | Phase 4 | Pending |
| INFRA-11 | Phase 4 | Pending |
| INFRA-12 | Phase 4 | Pending |
| BILL-01 | Phase 5 | Pending |
| BILL-02 | Phase 5 | Pending |
| BILL-03 | Phase 5 | Pending |
| BILL-04 | Phase 5 | Pending |
| BILL-05 | Phase 8 | Pending |
| LAUNCH-01 | Phase 5 | Pending |
| LAUNCH-02 | Phase 5 | Pending |
| LAUNCH-03 | Phase 5 | Pending |
| LAUNCH-04 | Phase 5 | Pending |
| PHI-01 | Phase 6 | Pending |
| PHI-02 | Phase 6 | Pending |
| PHI-03 | Phase 6 | Pending |
| PHI-04 | Phase 6 | Pending |
| PHI-05 | Phase 6 | Pending |
| PHI-06 | Phase 6 | Pending |
| PHI-07 | Phase 6 | Pending |
| PHI-08 | Phase 6 | Pending |
| PHI-09 | Phase 6 | Pending |
| PHI-10 | Phase 6 | Pending |
| POST-01 | Phase 7 | Pending |
| POST-02 | Phase 7 | Pending |
| POST-03 | Phase 7 | Pending |
| POST-04 | Phase 7 | Pending |
| POST-05 | Phase 7 | Pending |
| RET-01 | Phase 8 | Pending |
| RET-02 | Phase 8 | Pending |
| RET-03 | Phase 8 | Pending |
| CLINIC-01 | Phase 9 | Pending |
| CLINIC-02 | Phase 9 | Pending |
| CLINIC-03 | Phase 9 | Pending |
| CLINIC-04 | Phase 9 | Pending |
| CLINIC-05 | Phase 9 | Pending |
| CLINIC-06 | Phase 9 | Pending |
| QUAL-01 | Phase 10 | Pending |
| QUAL-02 | Phase 10 | Pending |
| QUAL-03 | Phase 10 | Pending |
| QUAL-04 | Phase 10 | Pending |
| QUAL-05 | Phase 10 | Pending |
| QUAL-06 | Phase 10 | Pending |
| QUAL-07 | Phase 10 | Pending |
| QUAL-08 | Phase 10 | Pending |
| PROMPT-01 | Phase 6 | Pending |
| PROMPT-02 | Phase 6 | Pending |
| PROMPT-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 71 total
- Mapped to phases: 71
- Unmapped: 0

---
*Requirements defined: 2026-03-16*
*Last updated: 2026-03-16 after roadmap creation*
