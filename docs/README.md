# FlashNote Documentation

This folder contains all project documentation organized by purpose.

---

## Status Tracking Convention

Each task is tracked in **exactly one file**. No duplication.

| What | Where | Role |
|------|-------|------|
| **Technical work** (code changes) | [ROADMAP.md](./ROADMAP.md) | **Start here** — dashboard + all tech task status |
| **Business / legal / ops** (non-code) | [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | LLC, BAAs, domain, infrastructure, Chrome Store |
| **Quality gates** (pass/fail criteria) | [SUCCESS_METRICS.md](./SUCCESS_METRICS.md) | Defines *what must be true* — not task tracking |
| **Stripe reference** (architecture) | [STRIPE_TODOS.md](./STRIPE_TODOS.md) | Reference doc — task status lives in ROADMAP |

**Planning and reference docs never track status.** They describe *what* to build. ROADMAP tracks *is it done*.

---

## Infrastructure

| Component | Service | Notes |
|-----------|---------|-------|
| Web Application | Google Cloud Run | Single Next.js app (frontend + backend), HIPAA-eligible, managed scaling |
| Database | Google Cloud SQL (PostgreSQL) | HIPAA-eligible, managed backups |
| LLM | Google Gemini (via Vertex AI for prod) | HIPAA-eligible with BAA |
| Payments | Stripe | Checkout, webhooks, customer portal |
| Error Tracking | Sentry (`@sentry/nextjs`) | Client and server instrumented |

---

## Folder Structure

### `/guides` - How-To Documentation
Operational guides for developers.

| Document | Description |
|----------|-------------|
| [LLC_FORMATION_GUIDE.md](./guides/LLC_FORMATION_GUIDE.md) | Business entity formation walkthrough |

> **Archived guides** (from pre-migration architecture): [API.md](./archive/guides/API.md), [ENVIRONMENT_VARIABLES.md](./archive/guides/ENVIRONMENT_VARIABLES.md), [EXTENSION_DEPLOYMENT.md](./archive/guides/EXTENSION_DEPLOYMENT.md)

### `/planning` - Planning & Research
Design specs, research, and competitive analysis.

| Document | Description |
|----------|-------------|
| [PHI_STORAGE_PLAN.md](./planning/PHI_STORAGE_PLAN.md) | **Active** — Patient data storage, notes, templates, versioning |
| [PROMPT_ENGINEERING_RESEARCH.md](./planning/PROMPT_ENGINEERING_RESEARCH.md) | **Active** — LLM prompt optimization (10 action items) |
| [APP_GATING_STRATEGY.md](./planning/APP_GATING_STRATEGY.md) | Beta rollout, invite codes, clinic seat management (Wave 1 complete) |
| [ACCESSIBILITY_IMPLEMENTATION.md](./planning/ACCESSIBILITY_IMPLEMENTATION.md) | WCAG AA tooling plan (Phases 1-2 done) |
| [MONITORING_SETUP.md](./planning/MONITORING_SETUP.md) | Sentry (done), UptimeRobot, Axiom setup plan |
| [TWOFOLD_DEEP_DIVE.md](./planning/TWOFOLD_DEEP_DIVE.md) | Competitor analysis — Twofold Health |
| [COMPETITIVE_ANALYSIS.md](./planning/COMPETITIVE_ANALYSIS.md) | Broader competitive landscape |
| [VOICE_INPUT_ROADMAP.md](./planning/VOICE_INPUT_ROADMAP.md) | Voice-to-note feature research |
| [OAUTH_ANALYSIS.md](./planning/OAUTH_ANALYSIS.md) | OAuth/social login implementation analysis |
| [TRUST_BUILDING_STRATEGY.md](./planning/TRUST_BUILDING_STRATEGY.md) | Product strategy for clinician trust |
| [RETENTION_STRATEGY.md](./planning/RETENTION_STRATEGY.md) | Churn reduction and switching cost strategy |
| [DESIGN_DIRECTION.md](./planning/DESIGN_DIRECTION.md) | Visual design direction |
| [DESIGN_SYSTEM.md](./planning/DESIGN_SYSTEM.md) | Design system specification |
| [COMPONENT_PATTERNS.md](./planning/COMPONENT_PATTERNS.md) | React component patterns |

### `/compliance` - Security & HIPAA
Testing, security, and compliance requirements.

| Document | Description |
|----------|-------------|
| [CONSOLIDATED_AUDIT_2026_02.md](./compliance/CONSOLIDATED_AUDIT_2026_02.md) | **Latest** - Full security & production readiness audit (Feb 2026) |
| [AUDIT_LOGGING_REQUIREMENTS.md](./compliance/AUDIT_LOGGING_REQUIREMENTS.md) | HIPAA audit logging specification |
| [TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md) | Test coverage targets and CI/CD requirements |
| [TESTING_GAPS.md](./compliance/TESTING_GAPS.md) | Untested code paths (launch blockers) |
| [UI_AUDIT.md](./compliance/UI_AUDIT.md) | WCAG accessibility and HIPAA UX compliance audit |
| [PERFORMANCE_AUDIT.md](./compliance/PERFORMANCE_AUDIT.md) | Memory leak and performance findings |
| [CODE_QUALITY_REVIEW.md](./compliance/CODE_QUALITY_REVIEW.md) | Codebase maintainability review |

### `/legal` - Legal Templates
Templates requiring legal review before use.

| Document | Description | Status |
|----------|-------------|--------|
| [BAA_TEMPLATE.md](./legal/BAA_TEMPLATE.md) | Business Associate Agreement for customers | Needs legal review |
| [PRIVACY_POLICY.md](./legal/PRIVACY_POLICY.md) | Privacy policy template | Has placeholders |
| [TERMS_OF_SERVICE.md](./legal/TERMS_OF_SERVICE.md) | Terms of service template | Has placeholders |

### `/reference` - Project Specifications
Core project specifications and analysis.

| Document | Description |
|----------|-------------|
| [FLASHNOTE_HANDOFF.md](./reference/FLASHNOTE_HANDOFF.md) | Complete project specification (API, schema, prompts) |
| [BUSINESS_COST_ANALYSIS.md](./reference/BUSINESS_COST_ANALYSIS.md) | Cost analysis and pricing strategy |

### `/memories` - Strategic Context
Preserved context from strategic planning sessions.

| Document | Description |
|----------|-------------|
| [Business Strategy](./memories/2026-02-04-business-strategy-financial-analysis.md) | Financial viability, churn, retention, acquisition strategy |
| [Billing Codes Research](./memories/2026-02-04-billing-codes-research.md) | PT-specific billing code research |

### `/archive` - Completed Work
Historical documentation for completed work. Kept for reference.

| Document | Description |
|----------|-------------|
| [CODE_REVIEW_AUTH_HARDENING.md](./archive/CODE_REVIEW_AUTH_HARDENING.md) | Auth security hardening review |
| [CODE_REVIEW_PLAN.md](./archive/CODE_REVIEW_PLAN.md) | Code review tracking |
| [SENTRY_LOGGING_GAPS.md](./archive/SENTRY_LOGGING_GAPS.md) | Monitoring audit (12 gaps fixed) |
| [STALE_USER_DATA_BUG.md](./archive/STALE_USER_DATA_BUG.md) | Extension state bug (fixed) |
| [UI_ISSUES_PLAN.md](./archive/UI_ISSUES_PLAN.md) | Extension UI fixes |
| [UNIFIED_STYLING_PLAN.md](./archive/UNIFIED_STYLING_PLAN.md) | CSS consolidation (implemented) |
| [WARM_WELLNESS_PREVIEW.md](./archive/WARM_WELLNESS_PREVIEW.md) | Design theme evolution |
| [WEB_APP_BUILDOUT_PLAN.md](./archive/WEB_APP_BUILDOUT_PLAN.md) | Web app construction plan |
| [DESIGN_SYSTEM_ANALYSIS.md](./archive/DESIGN_SYSTEM_ANALYSIS.md) | Design system evolution |
| [SECURITY_AUDIT.md](./archive/SECURITY_AUDIT.md) | Original security audit (superseded by CONSOLIDATED_AUDIT_2026_02) |
| [SIGNUP_FORM_STANDARDIZATION.md](./archive/SIGNUP_FORM_STANDARDIZATION.md) | Signup form standardization (implemented) |

---

## Documentation Rules

1. **Status in one place** — Each task tracked in exactly one file (ROADMAP or PRE_LAUNCH_CHECKLIST)
2. **Planning docs don't track status** — They describe what to build, not whether it's done
3. **Keep it current** — Update the status file when completing work
4. **Archive completed work** — Move fully-implemented planning docs to `/archive`

---

## What to Work on Next?

Open [ROADMAP.md](./ROADMAP.md) — the Dashboard table at the top shows every track with its next action.
