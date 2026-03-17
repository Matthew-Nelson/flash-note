# Project Research Summary

**Project:** FlashNote
**Domain:** HIPAA-regulated healthcare SaaS -- AI-powered Physical Therapy clinical documentation
**Researched:** 2026-03-16
**Confidence:** HIGH

## Executive Summary

FlashNote is a production Next.js 16 application deployed on Google Cloud Run that generates PT SOAP notes from shorthand input. The current architecture (App Router, DAL-based authorization, Cloud SQL, Vertex AI) is solid and well-suited for the next phases. The research concludes that FlashNote's immediate priorities are (1) deployment readiness with structured logging, (2) PHI storage to close the critical competitive gap of having no patient records or note persistence, and (3) clinic features with quality hardening. The existing stack requires almost no new production dependencies -- only Pino and its GCP config package. Everything else is dev tooling, CI-only tools, or infrastructure configuration.

The competitive landscape is clear: every credible PT documentation competitor stores patient records and persists notes. FlashNote's pass-through model was a smart v1 de-risking decision, but it is now the single biggest product gap. Patient records and note persistence are the competitive pivot point -- they transform FlashNote from a disposable generation tool into a clinical documentation platform with real switching cost. The shorthand-first input model is a genuine differentiator (all competitors lead with ambient voice), and the roadmap should protect and amplify this rather than chase voice recording.

The primary risks are regulatory, not technical. HIPAA compliance documentation must be updated before PHI is stored (the incident response plan still claims "pass-through only"). Audit logging for PHI read access is mandatory but easy to forget. The proposed HIPAA Security Rule NPRM may make MFA mandatory -- the auth system should be designed for extensibility. On the infrastructure side, Cloud Run connection pool exhaustion under autoscaling is the most likely production incident; sizing must be validated during staging deployment.

## Key Findings

### Recommended Stack

The existing stack is well-chosen and needs minimal additions. The total new production dependency footprint is two packages.

**New production dependencies:**
- **Pino + @google-cloud/pino-logging-gcp-config**: Structured JSON logging with GCP Cloud Logging integration. Required before PHI storage because HIPAA audit logging needs structured, severity-mapped output. 5-10x faster than Winston. Zero transport configuration on Cloud Run.

**New dev dependencies:**
- **@axe-core/playwright**: E2E accessibility audits embedded in existing Playwright specs. Standard approach -- tests real rendered pages with actual CSS, unlike jsdom-based alternatives.
- **@axe-core/react**: Dev-time accessibility overlay for catching violations before CI.
- **pino-pretty**: Human-readable dev logging.

**CI-only tools (no npm install):**
- **Gitleaks**: Secret scanning via GitHub Action. Industry standard (19k stars).
- **OWASP ZAP**: DAST scanning via GitHub Action. Baseline scans on PR, full active scans weekly.

**No new dependencies needed for:**
- PHI storage (extends existing pg + Zod + DAL pattern)
- Clinic billing (existing Stripe SDK supports per-seat pricing natively)
- HIPAA audit retention (GCP infrastructure configuration only)
- Monitoring (Cloud Error Reporting is free and auto-groups from Pino output)

### Expected Features

**Must have (table stakes) -- without these, FlashNote is not competitive:**
- Patient records (minimal creation: name + pronoun, detail page with profile fields)
- Note persistence (save generated notes linked to patients with session metadata)
- Note history per patient (chronological list for insurance audits and re-evaluations)
- Note versioning / amendment trail (HIPAA-required immutable edit history)
- Patient context persistence (free-text per patient, injected into all future generation)
- Inline editing of persisted notes (extend existing Phase B editing to saved notes)
- PDF export (single note + bulk download for insurance audits and patient transfers)
- Copy per SOAP section (PTs pasting into EMRs need individual sections)
- Note search (full-text across note content, patient name, date range)
- Time-saved tracking (cheapest, highest-impact retention lever per retention strategy)
- Basic note templates (SOAP with section-level verbosity/style preferences)

**Should have (differentiators):**
- Custom shorthand/macro library (day-1 differentiator -- no competitor offers this, builds switching cost)
- AI re-edit / "Magic Edit" (rapidly becoming expected, Twofold and Freed have it)
- Auto-generated note titles (small touch, high UX value for scannable note history)
- Patient instructions section (patient-facing plain-language summary, standout Twofold feature)
- Last note summary (4-sentence AI summary on patient page for instant session context)
- EMR-specific output formatting (prompt engineering per EMR, captures 80% of integration value)

**Defer to v2+:**
- Treatment plan generation (needs meaningful note history to be useful)
- CPT/ICD-10 code suggestions (medium-high complexity, requires PT-specific code mapping)
- Custom template builder (basic preferences cover initial need)
- Clinic admin dashboard (individual PTs are the initial market)
- Documentation quality scoring (needs clinical input for rubric, post-PMF feature)

**Anti-features (explicitly do NOT build):**
- Direct EMR API integration (per-EMR BAAs, enormous surface area -- use formatting instead)
- Ambient voice recording (margin-negative at $0.50-1.50/use, competes on others' turf)
- Scheduling, practice management, patient portal (EMR territory -- stay focused on documentation)
- Dark mode, gamification, real-time collaboration (no clinical workflow justification)

### Architecture Approach

The existing layered monolith (Proxy -> Pages -> Server Actions -> Services -> DAL -> PostgreSQL) is the correct foundation. PHI storage integrates as DAL and service layer extensions, not new architectural tiers. The key patterns are: (1) dual-scope DAL functions with a `QueryScope` discriminated union for multi-tenancy, (2) transactional note operations (note + versions + audit in one transaction), (3) append-only version table with database-level immutability triggers, (4) JSONB content for fast current-state reads with relational version history for audit, and (5) template-driven generation from day 1 to avoid migration cost when custom templates ship.

**Major components:**
1. **Patient DAL + Service** -- CRUD scoped by user_id or org_id, context injection into LLM prompts
2. **Clinical Notes DAL + Versions DAL + Service** -- Transactional save/update with optimistic locking, append-only version history
3. **Note Templates DAL** -- Read-only in Phase 1 (built-in SOAP template), template-driven generation replaces hardcoded prompts
4. **Note Generation Service (refactored)** -- Builds prompts dynamically from template section definitions instead of static PT prompts
5. **Clinic Admin + Billing** -- Org-scoped views, seat-based Stripe pricing via subscription quantity

### Critical Pitfalls

1. **Incident response plan not updated before PHI storage** -- The plan explicitly claims "pass-through processing only." If a breach occurs after PHI is stored but before the plan is updated, OCR investigators will see a gap between documented and actual data handling. Update Section 3 as a gating item before the PHI migration goes live.

2. **Audit logging gaps for PHI read access** -- Current audit system only logs mutations. HIPAA 164.312(b) requires auditing all ePHI access including reads. Add `PATIENT_VIEWED`, `NOTE_VIEWED` audit actions to every DAL function that returns PHI. This is the single most common HIPAA audit failure.

3. **Account deletion conflicts with PHI retention** -- HIPAA requires 6-year clinical note retention. CCPA grants deletion rights. `ON DELETE RESTRICT` FKs prevent hard delete. Requires legal counsel input before implementation. Implement soft-delete with de-identification.

4. **HIPAA proposed rule makes MFA mandatory** -- The NPRM (January 2025) proposes eliminating "addressable" vs. "required" distinction. Design the auth schema to be MFA-extensible now (add columns, plan the login flow challenge step). Do not wait for the final rule.

5. **Cloud Run connection pool exhaustion on scale-up** -- Each Cloud Run instance creates its own pg.Pool. At 5 instances with max=10 each, that is 50 connections against a Cloud SQL instance that may only support 100. Set pool max to 5 in production, set `--max-instances` ceiling, size Cloud SQL accordingly.

## Implications for Roadmap

Based on combined research, the work divides into three major phases with clear dependency ordering. Within each phase, the architecture research provides an 8-step build order for PHI storage that should be reflected in the roadmap's sub-phases.

### Phase 1: Deployment Readiness

**Rationale:** Everything downstream depends on production infrastructure. Pino must ship before PHI storage because PHI access audit logging requires structured logging. Staging must exist before E2E/DAST can run. Stripe live mode must be verified before clinic billing. The compliance documentation updates (incident response plan) must happen before PHI goes live.

**Delivers:** Production-ready infrastructure -- structured logging with PHI redaction, Sentry removal, CI/CD pipeline, GCP provisioning (Cloud SQL, Cloud Run, Secret Manager), staging environment, Stripe live mode, health checks, backup restoration procedure.

**Addresses features:** None directly (infrastructure enabling layer).

**Avoids pitfalls:**
- Pitfall 5 (backup restoration never tested) -- test during staging verification
- Pitfall 6 (Stripe webhook secret mismatch) -- verify with real $1 charge
- Pitfall 7 (connection pool exhaustion) -- size during provisioning
- Pitfall 8 (Secret Manager stale secrets) -- document rotation procedure
- Pitfall 9 (audit retention sink) -- configure before PHI storage ships
- Pitfall 12 (Redis fail-open) -- add startup guard
- Pitfall 13 (cold starts) -- set min-instances=1 at beta gate

**Gating items before Phase 2:**
- Pino logger active with PHI redaction paths
- Cloud Logging HIPAA audit sink configured and receiving entries
- Incident response plan updated to enumerate stored PHI types
- Backup restoration tested and runbook documented
- Device binding wired into session validation (Pitfall 15)

### Phase 2: PHI Storage

**Rationale:** The single biggest competitive gap. Patient records and note persistence transform FlashNote from a disposable tool into a platform with switching cost. The architecture is fully designed (PHI_STORAGE_PLAN.md) and requires no new dependencies. The 8-step build order from architecture research provides the internal sequencing.

**Delivers:** Patient CRUD, note persistence linked to patients, note versioning with immutable amendment trail, patient context persistence for LLM prompt injection, template-driven generation (replacing hardcoded prompts), note search, PDF export.

**Internal build order (from architecture research):**
1. Database migration + TypeScript types (5 new tables, triggers, indexes, SOAP seed data)
2. Patient DAL + Service + Actions + Pages (vertical slice)
3. Note Templates DAL (read-only, built-in SOAP template)
4. Note Generation refactor (template-driven prompts, patient context loading)
5. Clinical Notes DAL + Versions DAL + Service (transactional persistence)
6. Note UI (list, detail, inline editing, version history, template selector, patient typeahead)

**Addresses features:** Patient records, note persistence, note history, note versioning, patient context persistence, inline editing of persisted notes, auto-generated note titles, copy per section, basic note templates.

**Avoids pitfalls:**
- Pitfall 1 (incident response plan) -- gated in Phase 1
- Pitfall 2 (audit logging gaps) -- every DAL function that returns PHI gets audit call
- Pitfall 10 (PHI in logs) -- Pino redaction paths updated for new PHI fields
- Pitfall 11 (migration failure) -- test against production clone, idempotency guards

**Deferred within this phase:**
- Account deletion (Pitfall 3) -- requires legal counsel, implement after core PHI is stable
- MFA (Pitfall 4) -- design schema extension in this phase, implement in Phase 3

### Phase 3: Quality, Clinic Features, and Differentiators

**Rationale:** With production infrastructure and PHI storage in place, this phase hardens quality and expands the feature set. Clinic features depend on the full PHI stack. Differentiators like macro library and AI re-edit build on the persisted note foundation. E2E and DAST testing require the staging environment from Phase 1.

**Delivers:** E2E test suite with accessibility audits, DAST scanning in CI, secret scanning, clinic admin dashboard, seat-based billing, custom shorthand/macro library, AI re-edit ("Magic Edit"), PDF export (bulk), time-saved tracking, MFA implementation.

**Sub-groupings:**
- **Quality hardening:** E2E tests + axe accessibility audits, OWASP ZAP baseline scans, Gitleaks in CI, account unlock CLI
- **Clinic features:** Admin dashboard, member management, org-scoped patient/note views, seat-based Stripe billing
- **Differentiators:** Custom shorthand/macro library, AI re-edit, patient instructions section, last note summary, time-saved tracking on dashboard

**Addresses features:** Macro library (day-1 retention differentiator), AI re-edit, time-saved tracking, clinic admin dashboard, seat-based billing, PDF bulk export, patient instructions section.

**Avoids pitfalls:**
- Pitfall 3 (account deletion) -- implement with legal counsel input
- Pitfall 4 (MFA) -- implement TOTP-based MFA before or alongside clinic features
- Pitfall 14 (Stripe settings sync) -- review all Dashboard settings with live mode toggle

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** Pino structured logging is a hard prerequisite for HIPAA audit logging of PHI access. The Cloud Logging audit sink must be receiving entries before PHI is stored. Staging environment must exist for migration testing against production clone.
- **Phase 2 before Phase 3:** Clinic features (admin dashboard, seat billing) need the full PHI stack. Differentiators (AI re-edit, macro library) build on persisted notes. E2E tests are most valuable when they cover the full patient/note workflow.
- **Within Phase 2:** The 8-step build order follows hard dependencies: tables before DAL, DAL before services, services before UI. Steps 2 and 3 can parallelize. Steps 7-8 (clinic admin/billing) are post-PHI-storage and could slide to Phase 3 if needed.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 2, Step 4 (template-driven generation):** The prompt engineering migration from hardcoded PT prompts to dynamic template-driven prompts needs careful design to avoid quality regression. The prompt templates, section ordering logic, and output format parsing all change.
- **Phase 3, clinic billing:** Stripe per-seat edge cases (mid-cycle seat reduction, failed payment on seat addition, prorated downgrades) need Stripe docs review during implementation.
- **Phase 3, MFA implementation:** TOTP vs. email OTP tradeoffs, recovery flow design, and interaction with the existing lockout system need research.

**Phases with standard patterns (skip research):**
- **Phase 1 (Deployment Readiness):** Detailed plans exist for every step. Pino configuration is documented. GCP provisioning is well-documented. Standard CI/CD patterns.
- **Phase 2, Steps 1-3 (DB migration, Patient DAL, Template DAL):** PHI_STORAGE_PLAN.md is comprehensive. Follows existing DAL patterns exactly.
- **Phase 2, Step 5 (Clinical Notes DAL):** Follows the same transactional patterns already used in auth flows. Append-only version table mirrors existing audit_logs immutability.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Minimal additions. All versions verified against npm registry. Pino choice confirmed by existing MONITORING_SETUP.md research. No new production dependencies for PHI storage or billing. |
| Features | HIGH | Based on direct competitor evaluation (Twofold 7-day trial), 15+ competitor analysis, existing competitive analysis docs, APTA documentation standards, and web research across 15+ sources. |
| Architecture | HIGH | Extends proven existing patterns (DAL, transactions, audit logging). PHI_STORAGE_PLAN.md provides comprehensive schema design. Build order reflects hard dependencies verified against codebase. |
| Pitfalls | HIGH (12/17), MEDIUM (1/17), LOW (1/17) | Most pitfalls verified against codebase, official documentation, and existing CONCERNS.md. HIPAA NPRM (Pitfall 4) is MEDIUM because the final rule is not yet issued. CSP under proposed rule (Pitfall 17) is LOW/speculative. |

**Overall confidence:** HIGH

### Gaps to Address

- **Account deletion policy:** Requires legal counsel input on HIPAA retention vs. CCPA/state privacy law deletion rights. Cannot be resolved by engineering research alone. Must be addressed before implementing deletion in Phase 3.
- **HIPAA NPRM final rule:** The proposed rule's MFA mandate timeline is uncertain (expected late 2025-2026). Design the auth schema for extensibility now; implement MFA based on the final rule timeline.
- **Playwright config:** Still references the deleted Express backend in `webServer`. Must be updated before E2E tests can run. Low effort but blocking for E2E testing.
- **Stripe per-seat edge cases:** Mid-cycle seat reduction proration, failed payment handling for seat additions, and downgrade flows need Stripe documentation review during Phase 3 clinic billing implementation.
- **OWASP ZAP rules tuning:** The `.zap/rules.tsv` file will need false positive suppression for CSP nonces, expected rate-limit 429 responses, and health check endpoints. Requires experimentation during Phase 3.
- **@axe-core/react + React 19 Server Components:** May only work in Client Components (acceptable since it is dev-only). Needs verification during implementation.
- **JSONB indexing at scale:** PostgreSQL `tsvector` full-text search is sufficient at initial scale (10K users). If note volume exceeds expectations, evaluate GIN indexes on JSONB content or an external search service.

## Sources

### Primary (HIGH confidence)
- FlashNote codebase analysis: DAL patterns, existing schema, migration runner, auth flows
- `docs/planning/PHI_STORAGE_PLAN.md` -- comprehensive schema and implementation design
- `docs/planning/MONITORING_SETUP.md` -- Pino + GCP logging configuration
- `docs/planning/COMPETITIVE_ANALYSIS.md` -- 15+ competitor mapping
- `docs/planning/TWOFOLD_DEEP_DIVE.md` -- hands-on competitor evaluation (7-day trial)
- `docs/planning/RETENTION_STRATEGY.md` -- 4-layer switching cost framework
- `docs/compliance/INCIDENT_RESPONSE_PLAN.md` -- current PHI posture documentation
- `docs/reference/CONCERNS.md` -- known technical debt and security gaps
- Stripe official docs: per-seat pricing, subscription quantities
- GCP official docs: Cloud SQL connections, Secret Manager, Cloud Run autoscaling
- npm registry: version verification for all recommended packages (2026-03-16)

### Secondary (MEDIUM confidence)
- HHS HIPAA Security Rule NPRM (January 2025) -- proposed rule, not final
- Crunchy Data multi-tenancy patterns, Bytebase architecture comparison
- APTA documentation standards, Medicare PT documentation requirements
- Industry blogs: Coalfire, Axonius, Chess Health on HIPAA 2025-2026 changes

### Tertiary (LOW confidence)
- CSP `unsafe-inline` regulatory impact under proposed HIPAA rule -- speculative extrapolation
- JSONB performance at 100K+ user scale -- based on general PostgreSQL guidance, not FlashNote-specific benchmarks

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
