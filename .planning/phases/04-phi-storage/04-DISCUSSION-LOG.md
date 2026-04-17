# Phase 4: PHI Storage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 04-phi-storage
**Areas discussed:** Plan reuse, Phase scope / plan breakdown, Template system scope, Prompt migration strategy, Portfolio scope adjustments

---

## Plan Reuse (Gating Question)

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt + remap to Next.js | Use existing PHI_STORAGE_PLAN.md architecture, remap Express layer to DAL + Server Actions | ✓ |
| Revise specific decisions | Adopt but flag specific decisions for re-litigation | |
| Fresh start | Ignore existing plan, design from scratch | |

**User's choice:** Adopt + remap to Next.js (Recommended)
**Notes:** Keeps months of design thinking (schema, versioning, scoping, UX flows) while acknowledging the implementation layer must be modernized to the Next.js DAL/Server Action architecture.

---

## Phase Scope / Plan Breakdown

| Option | Description | Selected |
|--------|-------------|----------|
| 3 plans: foundation / patients / notes | Mirrors original vertical slicing; each plan independently shippable | ✓ |
| 4 plans: split templates from notes | Gives template system its own plan | |
| 2 plans: foundation+patients / templates+notes | Fewer but larger plans | |
| 5 plans: fully decomposed | Smaller atomic plans, higher coordination cost | |

**User's choice:** 3 plans (Recommended)
**Notes:** Matches the original vertical slicing. Plan 1 = foundation (migration + DAL + types + hook). Plan 2 = patients end-to-end. Plan 3 = notes + templates + versions end-to-end.

---

## Template System Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Style preferences only | Built-in SOAP + per-section style toggles in settings | ✓ |
| Read-only built-in only | Just built-in SOAP; defer any configurability | |
| Full template builder | Full CRUD UI for custom templates | |

**User's choice:** Style preferences only (Recommended)
**Notes:** Satisfies PROMPT-03 (concise/narrative/detailed preferences). Schema supports full template builder from day 1; only the builder UI is deferred.

---

## Prompt Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Clean cutover | Port hardcoded prompts into SOAP seed data; delete hardcoded system | ✓ |
| Keep hardcoded as fallback | Template prompt_instructions override hardcoded when present | |
| Parallel systems | Template-driven only for patient-linked notes; hardcoded otherwise | |

**User's choice:** Clean cutover (Recommended)
**Notes:** Matches original plan. Eliminates two-system maintenance cost. All generation reads from template sections.

---

## PHI-09 Audit Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Detail + history views only | PATIENT_VIEWED, NOTE_VIEWED, NOTE_HISTORY_VIEWED. Skip list views. | ✓ |
| Everything (including list views) | Per-row list audit | |
| Detail views only (skip history) | PATIENT_VIEWED, NOTE_VIEWED only | |

**User's choice:** Detail + history views only (Recommended)
**Notes:** Defensible compliance posture. Lists would generate massive audit volume without compliance benefit.

---

## PHI-08 / PHI-10 Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Build code, skip docs/ops verification | Ship code prerequisites; defer doc and ops verification | ✓ |
| Full scope | Write incident response doc, verify ops prerequisites | |
| Defer both entirely | Move PHI-08 and PHI-10 to deploy phase | |

**User's choice:** Build code, skip docs/ops verification (Recommended)
**Notes:** Aligns with portfolio pivot. ROADMAP marks PHI-10 as "code complete, ops deferred" when Phase 4 closes. PHI-08 (incident response doc) is deployment-time work.

---

## Claude's Discretion

- UI details: typeahead debounce, version history UI shape, archive confirmation, section edit save/cancel flow
- Optimistic lock conflict UX
- Loading state composition (skeleton shapes)
- Error code mapping for new paths
- Test coverage distribution across plans

## Deferred Ideas

- Full template builder UI
- Magic Edit (Phase 6)
- PDF export (Phase 5)
- Note search across content (Phase 5)
- Incident response plan update (deploy phase)
- Audit retention sink verification (deploy phase)
- Bulk export (Phase 5)
