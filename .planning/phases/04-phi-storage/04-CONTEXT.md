# Phase 4: PHI Storage - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform FlashNote from a disposable generation tool into a clinical documentation platform. Deliver: (1) patient records with profile fields and persistent free-text context; (2) persistent clinical notes linked to patients; (3) append-only per-section version history for all edits (HIPAA-compliant immutable amendment trail); (4) built-in SOAP template with per-section style preferences (concise/detailed, paragraph/bullets); (5) template-driven note generation that replaces hardcoded prompts; (6) PHI read audit logging on detail and history views.

**In scope:** PHI-01 through PHI-07, PHI-09, PROMPT-01, PROMPT-02, PROMPT-03.
**Deferred to deploy phase:** PHI-08 (incident response doc), PHI-10 (audit retention sink operational). Code-side prerequisites for PHI-10 (encryption-in-transit, audit query paths) ship in Phase 4; ops verification deferred.

Template builder UI (create/edit custom templates) is **not** in scope — deferred to a later feature phase.

</domain>

<decisions>
## Implementation Decisions

### Existing Plan Reuse
- **D-01:** Adopt `docs/planning/PHI_STORAGE_PLAN.md` as the architectural blueprint. Schema design (5 tables), versioning approach, dual-scoping (`user` vs `organization`), and UX flows transfer unchanged.
- **D-02:** Remap Express-era implementation layer to Next.js: `backend/src/routes/*` → Server Actions in `web/src/actions/`; `backend/src/db/queries/*` → DAL modules in `web/src/server/dal/`; `backend/src/types/*` → `web/src/lib/types/` + `web/src/server/types.ts`.

### Plan Breakdown
- **D-03:** Phase 4 ships in 3 plans, mirroring the original vertical slicing:
  - **Plan 04-01 (Foundation):** Migration for 5 tables (`note_templates`, `note_template_sections`, `patients`, `clinical_notes`, `note_versions`), SOAP seed data, DAL modules (read-only template queries, patients, clinical-notes, note-versions), database + domain types, Zod schemas, `usePhiCleanup` hook.
  - **Plan 04-02 (Patients end-to-end):** Patient list/detail/new pages, patient Server Actions, persistent patient context field, PATIENT_CREATED/UPDATED/ARCHIVED/VIEWED audit events, patient typeahead backing search.
  - **Plan 04-03 (Notes + templates + versioning):** Template-driven note generation (clean cutover from hardcoded prompts), note list/detail/new pages (built on existing `/dashboard/notes/new` stub), per-section inline editing with optimistic locking, version history view, NOTE_SAVED/UPDATED/ARCHIVED/VIEWED/HISTORY_VIEWED audit events, style preferences UI in settings.

### Template System Scope
- **D-04:** Phase 4 ships the built-in SOAP template (read-only) plus per-section style toggles (`verbosity: concise|detailed`, `styling: paragraph|bullets`) exposed in `/dashboard/settings`. This satisfies PROMPT-03 without a full builder.
- **D-05:** Full template builder UI (create/edit/delete custom templates) is deferred to a later feature phase. The database schema supports it from day 1; only the UI is deferred.

### Prompt Migration Strategy
- **D-06:** Clean cutover. Port the existing hardcoded PT prompt content from `web/src/server/prompts/` into the SOAP template seed data's `prompt_instructions` values. After migration, delete the hardcoded prompt system. Every note generation reads section instructions from the template.
- **D-07:** Gemini safety settings (PROMPT-01) configured explicitly at the provider level, not per-template. Post-generation hallucination detection (PROMPT-02) runs on the assembled LLM response, not per-section.

### PHI Read Audit Granularity
- **D-08:** Audit logging granularity follows the original plan:
  - `GET /patients/:id` → `PATIENT_VIEWED`
  - `GET /notes/:id` → `NOTE_VIEWED`
  - `GET /notes/:id/versions` → `NOTE_HISTORY_VIEWED`
  - List views (patient list, note list) do **not** log per-row — excessive noise, no compliance requirement for list-level audit.
  - Rationale documented in code so future reviewers see the tradeoff.

### Portfolio Scope Adjustments
- **D-09:** PHI-08 (incident response plan update) is deferred to the deploy phase (Phase 9 or 10) — it's a legal/ops doc task that's meaningful only when actually deploying.
- **D-10:** PHI-10 split: code-side prerequisites (encryption-in-transit verification in DB config, audit retention query paths in DAL) ship in Phase 4. External ops verification (Cloud Logging sink operational, TLS enforcement at infra layer) deferred to the deploy phase. ROADMAP marks PHI-10 as "code complete, ops deferred" when Phase 4 closes.

### Carrying Forward from Prior Phases
- **D-11:** Print stylesheet's blank underlines (Phase 1 decision) get auto-populated when patients ship. The print header now reads from the note's linked patient data.
- **D-12:** All mutations honor CLAUDE.md Rule 1 (multi-step security operations in transactions). Specifically: `POST /notes` (save note + insert N version rows) and `PATCH /notes/:id` (content update + version inserts) run inside a single `PoolClient` transaction.
- **D-13:** All DAL functions enforce scoping via a `QueryScope = { type: 'user'; userId } | { type: 'organization'; organizationId }` parameter. This extends the DAL's HIPAA boundary (Rule 5) to patient/note data.

### Claude's Discretion
- UI details: patient typeahead debounce interval, version history UI (inline expand vs modal vs tab), archive confirmation UX, section edit save/cancel flow
- Server Action return shapes (follow existing `ActionResult<T>` discriminated-union pattern)
- Optimistic lock conflict UX (409 → "This note was modified elsewhere. Refresh to see latest." + refresh button)
- Loading state composition (skeleton shapes, what's streamable in Server Components)
- Error code mapping for new error paths (follow existing `{ code, message }` curated-client-string pattern per Rule 2)
- Test coverage distribution across the 3 plans (maintain 95%+ per pre-commit hook)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary Design Document
- `docs/planning/PHI_STORAGE_PLAN.md` — Full PHI storage design: schema (5 tables), versioning, scoping pattern, UX flows, 27 design decisions, build order. **Written for old Express backend — schema/UX transfers, implementation layer does not.**

### Architecture & Conventions
- `.planning/codebase/ARCHITECTURE.md` — Current Next.js architecture: DAL as HIPAA boundary, Server Actions for mutations, `ActionResult<T>` pattern, `getSession()` auth gate, transaction pattern via `getPoolClient()`.
- `.planning/codebase/STRUCTURE.md` — Project file layout conventions.
- `.planning/codebase/CONVENTIONS.md` — Code style, naming, and pattern conventions.
- `.planning/codebase/STACK.md` — Tech stack (Next.js 16, pg, Zod, Pino, Vertex AI).
- `CLAUDE.md` — **Mandatory reading.** HIPAA compliance rules, 14 Engineering Rules, security requirements. Especially relevant: Rule 1 (transactions), Rule 5 (DAL), Rule 9 (audit in transaction), Rule 10 (defensive row checks).

### Requirements & State
- `.planning/REQUIREMENTS.md` §PHI Storage — PHI-01 through PHI-10 acceptance criteria.
- `.planning/REQUIREMENTS.md` §Prompt Improvements — PROMPT-01/02/03 acceptance criteria.
- `.planning/ROADMAP.md` §Phase 4 — goal and success criteria.

### Prior Phase Context
- `.planning/phases/01-ui-polish/01-CONTEXT.md` — Print stylesheet decision: blank underlines for patient fields, auto-populate when PHI ships.
- `.planning/phases/02-structured-logging/02-CONTEXT.md` — Pino PHI redaction patterns; audit logging conventions.
- `.planning/phases/03-pipeline-provisioning/03-CONTEXT.md` — Migration runner (compiled `.mjs`) and Cloud SQL config.

### Supporting Research
- `docs/planning/PROMPT_ENGINEERING_RESEARCH.md` — Prompt engineering research for PT note generation (informs PROMPT-01/02 implementation).
- `docs/planning/COMPETITIVE_ANALYSIS.md` — Competitor PHI UX references (Twofold context pattern).

### Memory
- `project_portfolio_pivot` (user memory) — Deployment deferred, feature development is the priority. Relevant for D-09, D-10 scope adjustments.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/server/lib/get-session.ts` — `getSession()` auth gate, `React.cache()`-wrapped. Every protected page/action calls this.
- `web/src/server/services/audit.ts` — `auditService.log()` (fire-and-forget) and `auditService.logWithClient()` (transactional). Add new `AuditAction` entries for patient/note events.
- `web/src/server/db/index.ts` — `pool` singleton and `getPoolClient()` for transactions.
- `web/src/server/services/llm/provider-factory.ts` — `getConfiguredProvider()` cached singleton. Reused for template-driven generation.
- `web/src/components/ui/` — Button, Card, Input, Alert primitives. Already WCAG AA.
- `web/src/components/DashboardShell.tsx` + Sidebar + TopBar — already built. New pages drop in under `/dashboard/*`.
- `web/src/lib/schemas/notes.ts` — existing `generateNoteSchema` extends to include `templateId` and `patientId`.
- `web/src/lib/types/actions.ts` — `ActionResult<T>` discriminated union. Pattern for all new Server Actions.

### Established Patterns
- **DAL scoping pattern** (extends to patients/notes): each DAL function takes `QueryScope`, returns camelCase domain types via a private `rowToX()` mapper.
- **Server Action shape:** validate Zod → rate-limit → `getSession()` → business logic → audit → return `ActionResult`. Never `throw` for expected errors.
- **Transaction pattern** (Rule 1): `getPoolClient()` → `BEGIN` → DAL calls with `client` param → `COMMIT`/`ROLLBACK` in `finally`.
- **Audit pattern** (Rule 9): audit write in the same transaction as the action it documents via `auditService.logWithClient(client, ...)`.
- **Error code pattern** (Rule 2): Server Action returns `{ success: false, error: 'error_code' }`; client maps code → curated string.
- **Opaque session tokens**: all patient/note access goes through `getSession()` → DAL scoping check. No direct user ID from cookies.

### Integration Points
- `web/src/app/dashboard/notes/new/page.tsx` — already exists as a stub from UI overhaul Phase A. Phase 4 replaces the stub with the real generator (template + patient selector + dynamic section rendering).
- `web/src/components/notes/NoteGenerationForm.tsx` — existing form has "Additional Context" free-text input stub. Phase 4 removes it (replaced by `patients.context`).
- `web/src/components/notes/GeneratedNote.tsx` — existing component hardcodes SOAP sections. Phase 4 refactors to render from `NoteSection[]` array.
- `web/src/server/prompts/` — existing hardcoded PT prompts. Phase 4 ports content into SOAP template seed data, then deletes this directory.
- `web/src/server/db/migrations/` — add `00XX_patients_and_notes.sql` following existing migration conventions.
- `web/src/app/dashboard/settings/page.tsx` — add "Note style preferences" section for per-section verbosity/styling toggles.
- `web/src/actions/notes.ts` — existing `generateNoteAction`, extend with `templateId`, `patientId`, add `saveNoteAction`, `updateNoteAction`, etc.

### New Files Required
- `web/src/server/dal/patients.ts` (new DAL module)
- `web/src/server/dal/clinical-notes.ts` (new DAL module)
- `web/src/server/dal/note-versions.ts` (new DAL module — append-only)
- `web/src/server/dal/note-templates.ts` (new DAL module, read-only)
- `web/src/actions/patients.ts` (new Server Actions file)
- `web/src/hooks/use-phi-cleanup.ts` (new client hook for route-change PHI clearing)
- `web/src/app/dashboard/patients/page.tsx` + `[id]/page.tsx` + `new/page.tsx`
- `web/src/app/dashboard/notes/page.tsx` + `[id]/page.tsx` (and rewritten `new/page.tsx`)
- `web/src/lib/schemas/patients.ts` (new Zod schemas)

</code_context>

<specifics>
## Specific Ideas

- **Patient selector is a typeahead, not a dropdown** — PTs may have hundreds of patients. Debounced search backed by `findPatientsByScope({ search })`. Reuse the pattern for any future list-of-patients UX.
- **`patients.context` replaces per-session "Additional Context"** — the stub text input added in UI overhaul Phase B is removed. Context is a property of the patient, not a per-session entry.
- **Version history is both a user feature and a compliance feature** — users see what changed; HIPAA sees immutable audit trail. UI should make this clear (e.g., "Edit History" label implies both).
- **Style preferences UI lives in settings, not inline in the template** — users configure concise/detailed and paragraph/bullets once per section in `/dashboard/settings`. The template DB row is updated; all future generations use the new values.

</specifics>

<deferred>
## Deferred Ideas

- **Full template builder UI** — create/edit/delete custom templates with per-section `prompt_instructions` editing. Deferred to a later feature phase. Schema supports it; only the UI is out of scope.
- **Magic Edit** (AI re-edit via free-text instruction) — assigned to Phase 6 (Retention & Differentiation). `note_versions.source = 'magic_edit'` is reserved in the schema for this future use.
- **PDF export** — assigned to Phase 5 (Post-PHI Features).
- **Note search** — cross-content/patient-name/date-range search assigned to Phase 5 (Post-PHI Features). Patient list search by name is in Phase 4 (it's part of the patient list page).
- **Incident response plan update (PHI-08)** — deferred to deploy phase. Doc-only task.
- **Audit retention sink verification (PHI-10 ops)** — deferred to deploy phase. Requires Cloud Logging sink deployed and writing to Cloud Storage with 6-year retention.
- **Bulk export** — assigned to Phase 5 (POST-01).

</deferred>

---

*Phase: 04-phi-storage*
*Context gathered: 2026-04-17*
