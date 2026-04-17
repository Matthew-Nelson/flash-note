---
phase: 04
slug: phi-storage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `04-RESEARCH.md §Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + React Testing Library 16.3.2 + jsdom 28.0.0 |
| **Config file** | `web/vitest.config.ts` |
| **Quick run command** | `cd web && pnpm test <pattern>` |
| **Full suite command** | `cd web && pnpm test` |
| **Coverage command** | `cd web && pnpm test --coverage` |
| **Migration smoke** | `cd web && pnpm db:migrate` (against fresh test DB) |
| **Estimated runtime (full)** | ~45s (current 1493-test baseline) |
| **Coverage floor (pre-commit)** | 97.79% statements / 95.46% branches |

---

## Sampling Rate

- **After every task commit:** `cd web && pnpm test <affected patterns>` (< 30s typical)
- **After every plan wave:** `cd web && pnpm test --coverage` (full suite — confirms branch coverage ≥ 95.46%)
- **Before `/gsd:verify-work`:** Full suite green + migration smoke against fresh DB + manual E2E walkthrough
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

*Populated by `gsd-planner` during plan creation. Each task in `04-01-*-PLAN.md`, `04-02-*-PLAN.md`, `04-03-*-PLAN.md` must declare an `<automated>` verify command and its target Nyquist requirement coverage. Requirements pre-mapped below:*

| Req ID | Plan | Behavior | Test Type | Automated Command | Task IDs (filled by planner) |
|--------|------|----------|-----------|-------------------|------------------------------|
| PHI-01 | 04-02 | Create patient + detail fields | unit + page render | `pnpm test patients-action patients/[id]/page` | pending |
| PHI-02 | 04-03 | Save note linked to patient with metadata | unit + integration | `pnpm test notes-action integration/phi-lifecycle` | pending |
| PHI-03 | 04-02 / 04-03 | Chronological note history per patient | unit + page render | `pnpm test clinical-notes.test patients/[id]/page` | pending |
| PHI-04 | 04-03 | Patient.context auto-injects into generation | unit | `pnpm test notes-action generate` | pending |
| PHI-05 | 04-01 | Append-only per-section versions (DB immutability) | unit + DB trigger | `pnpm test note-versions.test` | pending |
| PHI-06 | 04-03 | Per-section inline edits create new versions | unit + transaction rollback | `pnpm test notes-action EditableNoteSection` | pending |
| PHI-07 | 04-03 | Template-driven prompts w/ style prefs | unit | `pnpm test assemble.test gemini-safety-settings` | pending |
| PHI-08 | — | *Deferred to deploy phase (doc-only)* | n/a | n/a | n/a |
| PHI-09 | all | Audit logs on PHI reads (VIEWED events) | unit | `pnpm test patients-action notes-action` (audit mock asserts) | pending |
| PHI-10 (code side) | 04-01 | TLS / encryption-at-rest verification + retention query paths | config inspection | `pnpm test db-config` + manual | Partial (config.ts exists) |
| PROMPT-01 | 04-03 | Gemini safety settings explicit (BLOCK_ONLY_HIGH) | unit | `pnpm test gemini-safety-settings` | pending |
| PROMPT-02 | 04-03 | Post-generation hallucination detection | unit | `pnpm test hallucination-detector` | pending |
| PROMPT-03 | 04-03 | Per-user style prefs configurable | unit + page | `pnpm test NoteStylePreferencesSection templates-action` | pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Before Plan 04-01 task work starts, these test infrastructure items must exist. Treat missing items as Wave 0 tasks inside Plan 04-01.

- [ ] `web/src/test/factories/patient-factory.ts` — `createMockPatient()`, `createMockPatientRow()`
- [ ] `web/src/test/factories/clinical-note-factory.ts` — `createMockNote()`, `createMockNoteRow()`, `createMockNoteSection()`
- [ ] `web/src/test/factories/note-version-factory.ts` — `createMockVersionRow()`
- [ ] `web/src/test/factories/note-template-factory.ts` — `createMockTemplate()`, `createMockTemplateSection()`
- [ ] `web/src/test/integration/phi-lifecycle.test.ts` — cross-plan integration harness (scenarios added incrementally as 04-01 → 04-02 → 04-03 complete)
- [ ] `web/src/test/db-harness.ts` — boot a clean test DB, run migrations, return a `Pool`. Required for migration smoke + DB-level immutability trigger tests. Existing `dal-helpers.ts` mocks `pool.query`; a real-DB harness does not yet exist.

**Framework install:** none needed. Vitest / RTL / jsdom already at required versions.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end PHI lifecycle (register → patient → generate → save → edit → history → archive) | PHI-01..07, PROMPT-01..03 | Browser + visual confirmation of UI flows, print stylesheet, prompt output quality | Full 11-step developer walkthrough — see `04-RESEARCH.md §Validation Architecture → Manual verification plan` |
| Prompt-migration output quality regression | PROMPT-01 | Subjective — compare pre/post-cutover LLM output on identical quickNotes; confirm billing rules, CPT guidance, goal tracking preserved | Save a reference note pre-cutover; re-generate post-cutover with same inputs; diff outputs manually |
| Vertex AI safety-settings wire format | PROMPT-01 | Live smoke-test — research flagged the exact JSON shape (Vertex AI ADC endpoint) as MEDIUM confidence. Unit tests assert our client sends settings; live call confirms Google accepts them. | First task in Plan 04-03: run a real generation against the staging Vertex AI provider, capture request payload, confirm `safetySettings` accepted |
| Gemini dynamic `responseSchema` with UUID keys | PHI-07, PROMPT-03 | Research flagged as MEDIUM confidence — Vertex AI may not accept arbitrary UUID property names in schema. Unit tests cover our assembler; live call is the verification. | Same live smoke-test as above — confirm response schema with UUID keys round-trips |
| Print header populated with real patient name/DOB (not blank underlines) | D-11 carry-forward | Print-stylesheet behavior only visible via browser print preview | Generate + save a note for a patient → Cmd-P → confirm patient name/DOB appear in header |
| Cross-plan integration: save-note rolls back cleanly on induced failure | PHI-02, PHI-05, PHI-09 | Exercises transaction semantics end-to-end; automated in `phi-lifecycle.test.ts` but also verified manually once during Plan 04-03 | Temporarily stub `createInitialVersions` to throw; trigger save; confirm no `clinical_notes` row, no `note_versions` rows, no `audit_logs` row persisted |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (factories, db-harness)
- [ ] No watch-mode flags (use `pnpm test` not `pnpm test --watch`)
- [ ] Feedback latency < 45s for per-task samples
- [ ] Full suite passes at 95.46% branches / 97.79% statements coverage floor
- [ ] Migration smoke against fresh DB passes (seed SOAP row queryable)
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills task map

**Approval:** pending
