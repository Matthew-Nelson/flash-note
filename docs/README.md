# FlashNote Documentation

This folder contains all project documentation organized by purpose.

---

## Quick Reference

| Document | Purpose |
|----------|---------|
| [ROADMAP.md](./ROADMAP.md) | **Start here** - Consolidated view of all pending work |
| [SUCCESS_METRICS.md](./SUCCESS_METRICS.md) | Quality gates and progress tracking |
| [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | Business, legal, and operational launch requirements |
| [STRIPE_TODOS.md](./STRIPE_TODOS.md) | Stripe payment integration tasks |

---

## Infrastructure

| Component | Service | Notes |
|-----------|---------|-------|
| Backend API | Google Cloud Run | HIPAA-eligible, managed scaling |
| Database | Google Cloud SQL (PostgreSQL) | HIPAA-eligible, managed backups |
| Web / Landing Page | Vercel | Free tier, Next.js optimized |
| LLM | Google Gemini (via Vertex AI for prod) | HIPAA-eligible with BAA |
| Payments | Stripe | Checkout, webhooks, customer portal |
| Error Monitoring | Sentry | All three components instrumented |

---

## Folder Structure

### `/guides` - How-To Documentation
Operational guides and API documentation for developers.

| Document | Description |
|----------|-------------|
| [API.md](./guides/API.md) | REST API endpoint reference |
| [ENVIRONMENT_VARIABLES.md](./guides/ENVIRONMENT_VARIABLES.md) | Environment variable management across all contexts |
| [EXTENSION_DEPLOYMENT.md](./guides/EXTENSION_DEPLOYMENT.md) | Chrome Web Store deployment guide |
| [LLC_FORMATION_GUIDE.md](./guides/LLC_FORMATION_GUIDE.md) | Business entity formation walkthrough |

### `/planning` - Future Features
Research and planning docs for features not yet implemented.

| Document | Description |
|----------|-------------|
| [APP_GATING_STRATEGY.md](./planning/APP_GATING_STRATEGY.md) | Beta rollout, invite codes, clinic seat management (Wave 1 complete) |
| [MONITORING_SETUP.md](./planning/MONITORING_SETUP.md) | Sentry (done), UptimeRobot, Axiom setup plan |
| [OAUTH_ANALYSIS.md](./planning/OAUTH_ANALYSIS.md) | OAuth/social login implementation analysis |
| [TRUST_BUILDING_STRATEGY.md](./planning/TRUST_BUILDING_STRATEGY.md) | Product strategy for clinician trust |
| [ACCESSIBILITY_IMPLEMENTATION.md](./planning/ACCESSIBILITY_IMPLEMENTATION.md) | WCAG AA implementation plan |
| [SIGNUP_FORM_STANDARDIZATION.md](./planning/SIGNUP_FORM_STANDARDIZATION.md) | Web/extension signup consistency |
| [PROMPT_ENGINEERING_RESEARCH.md](./planning/PROMPT_ENGINEERING_RESEARCH.md) | LLM prompt optimization research |
| [RETENTION_STRATEGY.md](./planning/RETENTION_STRATEGY.md) | Churn reduction and switching cost strategy |

### `/compliance` - Security & HIPAA
Testing, security, and compliance requirements.

| Document | Description |
|----------|-------------|
| [CONSOLIDATED_AUDIT_2026_02.md](./compliance/CONSOLIDATED_AUDIT_2026_02.md) | **Latest** - Full security & production readiness audit (Feb 2026) |
| [AUDIT_LOGGING_REQUIREMENTS.md](./compliance/AUDIT_LOGGING_REQUIREMENTS.md) | HIPAA audit logging specification |
| [SECURITY_AUDIT.md](./compliance/SECURITY_AUDIT.md) | Original security audit findings and remediation status |
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

---

## Documentation Principles

1. **Keep it current** - Update docs when code changes
2. **Don't over-document** - Only document what provides value
3. **Single source of truth** - Each piece of info lives in one place
4. **Active vs. Archive** - Move completed work to `/archive`

---

## What to Work on Next?

1. Check [ROADMAP.md](./ROADMAP.md) for prioritized work items
2. Review [SUCCESS_METRICS.md](./SUCCESS_METRICS.md) for current phase progress
3. See [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) for launch blockers
