# FlashNote Documentation

Engineering rules, architecture decisions, and conventions live in [CLAUDE.md](../CLAUDE.md). The files here cover what CLAUDE.md doesn't.

| Document | What it's for |
|---|---|
| [ROADMAP.md](./ROADMAP.md) | **Start here.** Current state, what's next, and the status of all technical work. |
| [BUGS.md](./BUGS.md) | Open and suspected bugs. This is the only bug list. |
| [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) | Gates for the deferred deployment: infra, staging verification, ops, payments, legal. |
| [STRIPE.md](./STRIPE.md) | Billing reference: webhook events, subscription gating, local webhook testing, env vars. |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Design tokens and visual rules. The source of truth is `web/design-system/`. |
| [COMPONENT_PATTERNS.md](./COMPONENT_PATTERNS.md) | Markup and accessibility patterns for common components. |
| [compliance/AUDIT_LOGGING_REQUIREMENTS.md](./compliance/AUDIT_LOGGING_REQUIREMENTS.md) | HIPAA audit events, which actions emit them, and the retention gaps. |
| [compliance/INCIDENT_RESPONSE_PLAN.md](./compliance/INCIDENT_RESPONSE_PLAN.md) | Breach and incident response, including a PHI data inventory. |
| [compliance/TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md) | Test layers, coverage gates, CI, e2e setup, and known gaps. |
| [legal/](./legal/) | Drafts of the Terms, Privacy Policy, and BAA. They need attorney review; the live pages are placeholders. |

## Rules for these docs

1. **Status lives in ROADMAP.md, and bugs live in BUGS.md.** No other doc tracks whether something is done.
2. **Delete, don't archive.** When a plan ships or a doc goes stale, delete it. Git history is the archive; link to an old version with a commit permalink if needed.
3. **Every claim must be checkable.** Cite a file path or a command, and don't put numbers in a doc that you haven't measured.
4. **Prefer editing an existing doc to adding a new one.** A new planning doc is fine while work is in progress. Delete it when the work ships.
