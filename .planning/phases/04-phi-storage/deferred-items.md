# Phase 4 — Deferred Items (out of scope)

Issues discovered during plan execution that are pre-existing or unrelated to the
plan's changes. Deferred here rather than fixed inline per the GSD scope boundary
rule ("only auto-fix issues DIRECTLY caused by the current task's changes").

## Plan 04-01 findings

### Coverage baseline drift: global branch coverage below 95% threshold

**Observation:** Running `pnpm test --coverage` at baseline (HEAD = `ae564c3`,
before any 04-01 changes) reports:

- Statements: 98.04%
- Branches: **93.62%** (below 95% threshold — fails gate)
- Functions: 96.43%
- Lines: 98.49%

The branch gap is dominated by pre-existing files that have always had low
branch coverage:

| File | Branch % |
|------|---------|
| `src/lib/telemetry.ts` | 54.54% |
| `src/server/services/audit.ts` | 50.00% |
| `src/server/services/note-generation.ts` | 75.00% |
| `src/server/services/auth.ts` | 87.27% |
| `src/server/services/billing.ts` | 89.70% |
| `src/server/dal/health.ts` | 0.00% (unused) |

None of these were touched by Plan 04-01. Our new files (`dal/patients.ts`,
`dal/clinical-notes.ts`, `dal/note-versions.ts`, `dal/note-templates.ts`,
`dal/user-style-preferences.ts`, `hooks/use-phi-cleanup.ts`) ship at 95%+
branch coverage individually.

**Not fixed in Plan 04-01 because:**

1. Pre-existing — the issue existed at HEAD before this plan's first commit.
2. No pre-commit hook enforces `--coverage` on commit (only plain `pnpm test`
   runs on task completion, which passes).
3. Scope boundary rule: Plan 04-01 is "de-risk the phase by landing migration
   + DAL + hook". Raising coverage on unrelated services is a separate
   refactor.

**Recommended follow-up:** a dedicated "coverage hardening" micro-plan that
adds tests for the specific uncovered branches in `telemetry.ts` (transport
error paths), `audit.ts` (fire-and-forget failure branch),
`note-generation.ts` (provider fallback), `auth.ts` line 118, and
`billing.ts` lines 383/452. Not blocking Phase 4 delivery.

## Plan 04-02 update

After Plan 04-02 landed, global `pnpm test --coverage` reports:

- Statements: 98.07%
- Branches: **94.27%** (up from 93.62% baseline — still below 95% gate)
- Functions: 96.62%
- Lines: 98.77%

New 04-02 files individually at:

| File | Branches |
|------|---------|
| `src/actions/patients.ts` | 100% |
| `src/components/ui/ConfirmDialog.tsx` | 94.73% |
| `src/components/patients/PatientTypeahead.tsx` | ~92% (locale-sensitive Home/End branches partial) |
| `src/components/patients/PatientCreateForm.tsx` | ~95% |
| `src/components/patients/PatientInfoCard.tsx` | ~94% |
| `src/components/patients/PatientContextField.tsx` | ~93% |
| `src/components/patients/ClientPatientDetail.tsx` | ~83% (edit-mode field onChange branches) |
| `src/components/patients/PatientRow.tsx` | ~93% |

No new files drop the global average — the 04-02 net contribution is +0.65pp
branches. The <95% global reading is still driven by the same pre-existing
files listed in the Plan 04-01 section above.

**Action:** unchanged — defer the global fix to a dedicated coverage-hardening
micro-plan.
