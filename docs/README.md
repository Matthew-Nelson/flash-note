# FlashNote Documentation

This folder contains all project documentation organized by purpose.

---

## Quick Reference

| Document | Purpose |
|----------|---------|
| [ROADMAP.md](./ROADMAP.md) | **Start here** - Consolidated view of all pending work |
| [SUCCESS_METRICS.md](./SUCCESS_METRICS.md) | Quality gates and progress tracking (16% complete) |
| [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | Business, legal, and operational launch requirements |
| [STRIPE_TODOS.md](./STRIPE_TODOS.md) | Stripe payment integration tasks |
| [UI_ISSUES_PLAN.md](./UI_ISSUES_PLAN.md) | Extension UI fixes (3 issues) |

---

## Folder Structure

### `/guides` - How-To Documentation
Operational guides and API documentation for developers.

| Document | Description |
|----------|-------------|
| [API.md](./guides/API.md) | REST API endpoint reference |
| [EXTENSION_DEPLOYMENT.md](./guides/EXTENSION_DEPLOYMENT.md) | Chrome Web Store deployment guide |

### `/planning` - Future Features
Research and planning docs for features not yet implemented.

| Document | Description |
|----------|-------------|
| [MONITORING_SETUP.md](./planning/MONITORING_SETUP.md) | **Critical** - Sentry, UptimeRobot, Axiom setup plan |
| [OAUTH_ANALYSIS.md](./planning/OAUTH_ANALYSIS.md) | OAuth/social login implementation analysis |
| [TRUST_BUILDING_STRATEGY.md](./planning/TRUST_BUILDING_STRATEGY.md) | Product strategy for clinician trust (conversational mode, review mode) |
| [UNIFIED_STYLING_PLAN.md](./planning/UNIFIED_STYLING_PLAN.md) | CSS consolidation plan for extension + web |

### `/compliance` - Security & HIPAA
Testing, security, and compliance requirements.

| Document | Description |
|----------|-------------|
| [AUDIT_LOGGING_REQUIREMENTS.md](./compliance/AUDIT_LOGGING_REQUIREMENTS.md) | HIPAA audit logging specification |
| [SECURITY_AUDIT.md](./compliance/SECURITY_AUDIT.md) | Security audit findings and remediation status |
| [TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md) | Test coverage targets and CI/CD requirements |

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

### `/archive` - Completed Work
Historical documentation for completed work. Kept for reference.

| Document | Description |
|----------|-------------|
| [CODE_REVIEW_AUTH_HARDENING.md](./archive/CODE_REVIEW_AUTH_HARDENING.md) | Auth security hardening review (completed) |
| [CODE_REVIEW_PLAN.md](./archive/CODE_REVIEW_PLAN.md) | Code review tracking (completed) |

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
