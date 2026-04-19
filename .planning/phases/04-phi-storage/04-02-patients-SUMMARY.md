---
phase: 04-phi-storage
plan: 02
subsystem: ui
tags: [react, nextjs-app-router, server-actions, zod, postgres, audit, hipaa, a11y, wai-aria-combobox, phi-cleanup]

# Dependency graph
requires:
  - phase: 04-phi-storage
    provides: patients DAL (createPatient/findPatientById/findPatientsByScope/updatePatient/archivePatient), createPatientSchema/updatePatientSchema/updatePatientContextSchema/patientSearchSchema, AuditAction.PATIENT_* enum values, usePhiCleanup hook, patient test factories
  - phase: 01-migration
    provides: getSession DAL + Rule 8 redirect pattern, apiRateLimit, auditService (log + logWithClient), getPoolClient, ActionResult discriminated union, Button/Card/Input/Alert primitives
  - phase: 02-structured-logging
    provides: Pino logger with PHI redaction paths (extended in 04-01) for error-level logging in Server Actions + audit-service catch branch
provides:
  - 4 patient Server Actions (createPatientAction, updatePatientAction, archivePatientAction, updatePatientContextAction) — all transactional per Rule 1/Rule 9/M-6, audit+mutation in one PoolClient BEGIN/COMMIT
  - 3 patients routes (/dashboard/patients, /new, /[id]) — Server Components with getSession guard + findPatientById/findPatientsByScope via DAL + PATIENT_VIEWED audit on detail
  - 9 patient-domain React components (PatientTypeahead, PatientInfoCard, PatientContextField, PatientNotesTable, PatientRow, PatientCreateForm, ClientPatientDetail, SearchPatients) + error-message map
  - PatientTypeahead — reusable WAI-ARIA 1.2 combobox (250ms debounce + AbortController + 2-char min + 10-item max + 44px hit targets on listbox rows/clear/arrow) — consumed by Plan 04-03 NoteGenerationForm
  - ConfirmDialog shared primitive — role="dialog", aria-modal, focus-trap, Cancel-first initial focus, Escape + backdrop close, body-scroll lock, internal aria-live — consumed by Plan 04-03 archive-note flow
  - Button variant="destructive" — bg-fn-error + min-h-[44px] + existing focus-ring contract — consumed by Plan 04-03
  - PATIENT_ERROR_MESSAGES map (web/src/components/patients/error-messages.ts) — Rule 2 curated error codes → user-facing strings
  - phone formatting utility (web/src/lib/utils/phone.ts) — progressive input mask + display formatter for US/international numbers
  - audit-service fire-and-forget catch branch now logs failures at error level with source='audit_service' (M-6)
  - phi-lifecycle integration scenarios filled for create + update context + archive (verifying audit + mutation share one transaction)
affects: [04-03-notes-versioning]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — verified vs web/package.json
  patterns:
    - "Server Action transactional shape for PHI writes: getPoolClient → BEGIN → DAL(..., client) → auditService.logWithClient(client, ...) → COMMIT (ROLLBACK + logger.error on throw, client.release() in finally)"
    - "Fire-and-forget audit for read paths (PATIENT_VIEWED) with error-level logging in catch branch so audit-write failures surface in Cloud Error Reporting"
    - "Curated error-code → string map per domain (PATIENT_ERROR_MESSAGES) — no err.message ever reaches the UI (Rule 2)"
    - "Client/Server boundary for patient detail: Server Component loads data + audits, wraps ClientPatientDetail which owns usePhiCleanup and edit state"
    - "SearchPatients debounces router.replace(url, { scroll: false }) — Next.js 16 ties focus-to-<main> to the scroll option; passing scroll:false preserves input focus across URL updates"
    - "Component-level <Suspense> around patient list fetch replaces route-level loading.tsx (avoids subtree remount that blurred the search input on every debounced URL push)"
    - "Progressive phone input mask — format as the user types, preserve cursor position, accept international numbers (no fixed length)"

key-files:
  created:
    - "web/src/actions/patients.ts"
    - "web/src/actions/patients.test.ts"
    - "web/src/app/dashboard/patients/new/page.tsx"
    - "web/src/app/dashboard/patients/new/page.test.tsx"
    - "web/src/app/dashboard/patients/[id]/page.tsx"
    - "web/src/app/dashboard/patients/[id]/page.test.tsx"
    - "web/src/components/patients/PatientTypeahead.tsx"
    - "web/src/components/patients/PatientTypeahead.test.tsx"
    - "web/src/components/patients/PatientInfoCard.tsx"
    - "web/src/components/patients/PatientInfoCard.test.tsx"
    - "web/src/components/patients/PatientContextField.tsx"
    - "web/src/components/patients/PatientContextField.test.tsx"
    - "web/src/components/patients/PatientNotesTable.tsx"
    - "web/src/components/patients/PatientNotesTable.test.tsx"
    - "web/src/components/patients/PatientRow.tsx"
    - "web/src/components/patients/PatientRow.test.tsx"
    - "web/src/components/patients/PatientCreateForm.tsx"
    - "web/src/components/patients/PatientCreateForm.test.tsx"
    - "web/src/components/patients/ClientPatientDetail.tsx"
    - "web/src/components/patients/ClientPatientDetail.test.tsx"
    - "web/src/components/patients/SearchPatients.tsx"
    - "web/src/components/patients/SearchPatients.test.tsx"
    - "web/src/components/patients/error-messages.ts"
    - "web/src/components/patients/error-messages.test.ts"
    - "web/src/components/patients/index.ts"
    - "web/src/components/ui/ConfirmDialog.tsx"
    - "web/src/components/ui/ConfirmDialog.test.tsx"
    - "web/src/lib/utils/phone.ts"
    - "web/src/lib/utils/phone.test.ts"
  modified:
    - "web/src/app/dashboard/patients/page.tsx (stub → full list page with Suspense wrapper)"
    - "web/src/app/dashboard/patients/page.test.tsx"
    - "web/src/components/Sidebar.tsx (dropped 'Coming Soon' badge from Patients; mobile drawer auto-closes on nav-link click — UAT #5)"
    - "web/src/components/Sidebar.test.tsx"
    - "web/src/components/ui/Button.tsx (added destructive variant preserving existing variants + focus-ring)"
    - "web/src/components/ui/Button.test.tsx"
    - "web/src/components/ui/index.ts"
    - "web/src/server/dal/patients.ts (extended create/update/archive signatures with optional PoolClient for M-6 transactional writes)"
    - "web/src/server/services/audit.ts (error-level logging in fire-and-forget catch branch — M-6)"
    - "web/src/server/services/audit.test.ts"
    - "web/src/test/integration/phi-lifecycle.test.ts (filled create + update + archive scenarios)"
    - "web/vitest.config.ts (include pattern extended for new test directories)"
  deleted:
    - "web/src/app/dashboard/patients/loading.tsx (removed during UAT #3 focus fix — route-level loading replaced with component-level Suspense)"

key-decisions:
  - "M-6 transactional pattern for PHI writes: createPatientAction/updatePatientAction/archivePatientAction/updatePatientContextAction wrap DAL + auditService.logWithClient in a single BEGIN/COMMIT — same shape 04-03 will use for saveNoteAction, aligning Rule 9 enforcement across the phase"
  - "DAL signatures (createPatient/updatePatient/archivePatient) extended with optional client: pg.PoolClient; existing non-transactional callers unchanged (falls back to pool when omitted)"
  - "auditService.log fire-and-forget now logs failures via logger.error with source='audit_service' + errorType='audit_write_failed' + userId + action — read-path audit writes (PATIENT_VIEWED) surface in Cloud Error Reporting without the DAL caller handling errors (M-6)"
  - "ConfirmDialog defaults initial focus to the Cancel button (safer default per 04-UI-SPEC.md — prevents accidental Enter-to-destroy)"
  - "UAT #3 root cause (search-input focus lost on every keystroke): Next.js 16 App Router auto-focuses <main id='main-content' tabIndex={-1}> on every router.replace() for a11y. Fix required three coordinated changes — router.replace(url, { scroll: false }) in SearchPatients, component-level <Suspense> in page.tsx, and deletion of route-level loading.tsx. All three required together; any one alone reproduced the bug"
  - "Phone number handling: progressive input mask (format as user types, preserve cursor) + display formatter for US and international numbers — no fixed length, no hard regex rejection on paste (UAT #1)"
  - "PatientContextField: explicit view → edit toggle with a dedicated Save button that appears only when dirty, not live-saving on blur (UAT #2 — clinician expected Docs-style toggle, not auto-save)"
  - "Mobile Sidebar drawer auto-closes on nav-link click via a callback passed through SidebarContext (UAT #5)"
  - "Archive flow redirects to /dashboard/patients (not back to detail) on success — detail page would 404 post-archive (UAT #4)"

patterns-established:
  - "Patient domain components co-located under web/src/components/patients/ with a single index.ts barrel + error-messages.ts map"
  - "Every Server Action in this plan starts with 'use server', returns ActionResult<T>, never throws for expected errors, never includes err.message or PHI in the return value"
  - "All DAL access from pages goes via getSession → DAL (Rule 5/Rule 8) — no direct @/server/db imports from app/ or components/"
  - "Audit log metadata for PATIENT_UPDATED records the field-name list (Object.keys(input)) only, never field values (Rule 7 + HIPAA log-safety)"
  - "Route-level <Suspense> for streaming is NOT safe when the suspended subtree contains an input with focus — use component-level Suspense to preserve the stable DOM around focused inputs"

requirements-completed:
  - PHI-01  # Create + detail of patients end-to-end
  - PHI-09  # PATIENT_VIEWED audit on detail page load (enum values landed in 04-01; wire-up completed here)

requirements-partial:
  - PHI-04  # Persistent patient context DAL + UI delivered. Prompt-injection wire-up (context flowing into LLM generation) completes in Plan 04-03 (saveNoteAction consumes patientContextSnapshot per 04-01 B-3)

# Metrics
duration: ~2h 49min (wall clock, includes UAT pause)
completed: 2026-04-18
---

# Phase 04 Plan 02: Patients Summary

**Clinician-facing patient CRUD shipped end-to-end — 4 transactional Server Actions (Rule 1 + Rule 9 + M-6), 3 dashboard routes, 9 patient-domain components, reusable PatientTypeahead (WAI-ARIA 1.2 combobox) + ConfirmDialog + Button destructive variant for Plan 04-03 to consume, usePhiCleanup wired on detail, and a UAT pass that surfaced 5 findings (phone mask, context toggle, search focus, archive redirect, mobile drawer) all fixed before approval**

## Performance

- **Duration:** ~2h 49min wall clock (includes UAT pause + 5 fix-commit iterations)
- **Started:** 2026-04-18T21:11:32Z (first task commit)
- **Completed:** 2026-04-19T00:00:17Z (final focus fix)
- **Tasks:** 3 (Task 1 + Task 2 + Task 3 UAT checkpoint — approved)
- **Commits:** 9 (2 task commits + 1 lint-cleanup + 5 UAT-fix commits + 1 final focus fix)
- **Files created:** 29
- **Files modified:** 12
- **Files deleted:** 1 (loading.tsx — see UAT #3 fix below)
- **Tests:** 1893 → 1939 (+46), tsc clean, lint clean

## Accomplishments

- **4 patient Server Actions ship transactionally (M-6):** `createPatientAction`, `updatePatientAction`, `archivePatientAction`, `updatePatientContextAction` each open a PoolClient, BEGIN, call the DAL + `auditService.logWithClient` inside the same transaction, COMMIT, and ROLLBACK on any error. This matches the Rule 9 pattern Plan 04-03 will reuse for `saveNoteAction` / `updateNoteSectionsAction`.
- **audit-service fire-and-forget path now error-logs (M-6):** `auditService.log` internal catch branch calls `logger.error({ err, source: 'audit_service', errorType: 'audit_write_failed', userId, action }, ...)` — PATIENT_VIEWED failures (read path) now surface in Cloud Error Reporting without the caller handling errors.
- **3 patients pages behind getSession + redirect (Rule 5/Rule 8):** `/dashboard/patients` (list + debounced search + pagination), `/dashboard/patients/new` (create form), `/dashboard/patients/[id]` (detail with info card + context + notes placeholder). All use `<main id="main-content">`, single `<h1>`, and go through the DAL.
- **PatientTypeahead ships as a reusable WAI-ARIA 1.2 combobox:** 250ms debounce, AbortController per keystroke, 2-char minimum, 10-result cap, full keyboard contract (Arrow/Enter/Escape/Home/End), clear button, aria-live result-count announcement, and all three interactive surfaces (listbox rows, clear button, arrow toggle) expose 44px touch targets (M-7). Plan 04-03 consumes this unchanged inside NoteGenerationForm.
- **ConfirmDialog + Button destructive variant + PATIENT_ERROR_MESSAGES shipped as shared primitives:** ConfirmDialog enforces role="dialog", aria-modal, focus trap, Cancel-first initial focus, Escape + backdrop close, body-scroll lock, and includes an internal aria-live region. Plan 04-03 consumes these for the archive-note flow.
- **usePhiCleanup wired on patient detail:** ClientPatientDetail subscribes the cleanup ref to clear edit-state and abort in-flight updates on route change and on the `flashnote:logout` event (Rule 4).
- **Sidebar updated:** "Coming Soon" badge removed from Patients link; mobile drawer now auto-closes when a nav link is clicked (UAT #5 fix).
- **phi-lifecycle integration scenarios filled:** create patient → update context → archive round-trip asserts the PATIENT_CREATED / PATIENT_UPDATED / PATIENT_ARCHIVED audit rows commit in the same transaction as their business write.

## Task Commits

| #   | Hash      | Type  | Description                                                                                               |
| --- | --------- | ----- | --------------------------------------------------------------------------------------------------------- |
| 1   | `1339db0` | feat  | Task 1 — patient Server Actions + ConfirmDialog + Button destructive variant + audit-service M-6 update   |
| 2   | `b6d23f6` | feat  | Task 2 — patients pages + 9 patient components + Sidebar update + usePhiCleanup wiring                    |
| 3   | `3736bd6` | fix   | UAT #4 — archive flow redirects to `/dashboard/patients` (avoids 404 on the just-archived detail page)    |
| 4   | `9f3d987` | fix   | UAT #3 (initial attempt) — preserve search input focus during debounce                                    |
| 5   | `18df1f2` | fix   | UAT #5 — mobile Sidebar drawer auto-closes on nav-link click                                              |
| 6   | `a6a4f40` | fix   | UAT #1 — phone display formatter + progressive input mask (preserves cursor position)                     |
| 7   | `0c28227` | fix   | UAT #2 — PatientContextField view → edit toggle (explicit Save; no auto-save on blur)                     |
| 8   | `c628d67` | chore | Lint cleanup across Plan 04-02 files                                                                      |
| 9   | `5f82a2a` | fix   | UAT #3 (real fix) — router.replace({ scroll: false }) + component-level Suspense + delete loading.tsx     |

**Plan metadata commit:** to follow (SUMMARY.md + STATE.md + ROADMAP.md)

## UAT Findings & Fixes (Task 3 checkpoint)

All 5 findings raised by the human tester during the 17-step UAT walk. All fixed before approval; plan re-verified after each fix.

1. **UAT #1 — Phone formatting missing on display + brittle input** (`a6a4f40`). Display showed raw `5550100` strings; input field accepted only exact 10-digit strings with no mask. Added `web/src/lib/utils/phone.ts` with a progressive mask (formats as the user types, preserves cursor position, accepts international numbers) and a display formatter used in PatientInfoCard + PatientRow. No validation regression — Zod schema unchanged, just UI niceness.

2. **UAT #2 — PatientContextField auto-saved on blur** (`0c28227`). Clinicians expected a Google-Docs-style view → edit toggle with an explicit Save button, not a live-save on blur that could accidentally commit a half-typed edit. Refactored to a view → edit toggle pattern: click "Edit" enters edit mode; Save button appears only when dirty; Cancel reverts; aria-live still announces "Context saved." on successful commit.

3. **UAT #3 — Search input loses focus on every keystroke** (`9f3d987` initial attempt, `5f82a2a` real fix). Deep-dive deserves its own paragraph below — this was the one genuinely subtle finding.

4. **UAT #4 — Archive flow 404'd the just-archived detail page** (`3736bd6`). `archivePatientAction` was returning success but the client then tried to refresh the detail page, which 404'd because the patient was now archived. Fix: archive flow redirects to `/dashboard/patients` (the list) on success, not back to detail.

5. **UAT #5 — Mobile Sidebar drawer stayed open after nav-link click** (`18df1f2`). On 375px width, clicking a nav link inside the drawer navigated but left the drawer open, obscuring the new page. Fix: `SidebarContext` now exposes a `closeSidebar` callback; `NavLink` calls it in onClick. Desktop (where the drawer isn't overlaid) is unaffected.

### UAT #3 Deep Dive: Next.js App Router focus-to-`<main>` auto-behavior

**Symptom:** Typing in the patient search input on `/dashboard/patients` lost focus after each debounced URL update (~250ms), making search unusable.

**Diagnosis (via Playwright instrumentation):** Orchestrator captured `document.activeElement` before and after the URL push. The input's DOM node was preserved by React reconciliation — same reference before and after — but `activeElement` had shifted to `<main>`. Further: the route-level `loading.tsx` rendered briefly when `page.tsx` suspended on the DB fetch triggered by the query-param change, which replaced the subtree containing the input.

**Root cause:** Next.js 16 App Router auto-focuses `<main id="main-content" tabIndex={-1}>` on every `router.replace()` for screen-reader navigation flow. This behavior is tied to the same option as scroll-to-top. Passing `{ scroll: false }` disables both.

**Fix (three coordinated changes, all required):**
1. `SearchPatients`: call `router.replace(url, { scroll: false })` — disables the Next.js focus-to-`<main>` behavior on debounce.
2. `page.tsx`: wrap the patient list fetch in a component-level `<Suspense>` (replaces the route-level `loading.tsx` contract).
3. Delete `web/src/app/dashboard/patients/loading.tsx` — without the deletion, the route-level boundary still took precedence over the component-level Suspense and re-mounted the subtree (including the input) on every debounced fetch.

Any one of the three alone reproduced the bug; all three together fully fix it.

## Requirements Delivered

- **PHI-01** — User can create a patient record and view a patient detail page with profile fields. ✅ (create form + detail page + info-card inline edit + archive-with-confirmation)
- **PHI-04** — User can set persistent free-text context on a patient. ✅ DAL + UI complete; field saves + reads round-trip. ⚠ **Prompt-injection wire-up (context flowing into LLM generation) completes in Plan 04-03** — saveNoteAction consumes `patientContextSnapshot` per 04-01 B-3.
- **PHI-09** — PATIENT_VIEWED audit on detail page load. ✅ Fire-and-forget with error-level catch-branch logging per M-6.

## Server Action Signatures Exported

```typescript
// web/src/actions/patients.ts — all return ActionResult<T> discriminated union
createPatientAction(formData: FormData): Promise<ActionResult<{ id: string }>>;
updatePatientAction(patientId: string, formData: FormData): Promise<ActionResult<Patient>>;
archivePatientAction(patientId: string): Promise<ActionResult<void>>;
updatePatientContextAction(patientId: string, context: string): Promise<ActionResult<void>>;
```

**Error codes returned** (all curated via `PATIENT_ERROR_MESSAGES` per Rule 2):
`validation_error`, `unauthenticated`, `rate_limit_exceeded`, `patient_not_found`, `archive_failed`, `context_save_failed`, `internal_error`.

## Audit Events Emitted

| Event                | Path        | Transactional? | Source                                   |
| -------------------- | ----------- | -------------- | ---------------------------------------- |
| `PATIENT_CREATED`    | Write path  | Yes (Rule 9)   | `auditService.logWithClient` in createPatientAction tx |
| `PATIENT_UPDATED`    | Write path  | Yes (Rule 9)   | `auditService.logWithClient` in updatePatientAction / updatePatientContextAction tx (metadata includes field-name list only, never values) |
| `PATIENT_ARCHIVED`   | Write path  | Yes (Rule 9)   | `auditService.logWithClient` in archivePatientAction tx |
| `PATIENT_VIEWED`     | Read path   | No (fire-and-forget) | `auditService.log` from `/dashboard/patients/[id]/page.tsx`; catch branch error-logs on failure (M-6) |

## Files Plan 04-03 Consumes Unchanged

- `PatientTypeahead` — NoteGenerationForm patient selector (04-RESEARCH §8.5)
- `ConfirmDialog` — archive-note confirmation flow
- `Button variant="destructive"` — archive-note button
- `PATIENT_ERROR_MESSAGES` pattern — mirror the curated-error-code map for NOTE_ERROR_MESSAGES
- Server Action transactional shape — copy for `saveNoteAction` / `updateNoteSectionsAction` / `archiveNoteAction`
- `audit-service.logWithClient` in-transaction audit writes for NOTE_SAVED / NOTE_UPDATED / NOTE_ARCHIVED

## Test Count Delta

Before: **1893** tests. After: **1939** tests. Net: **+46**.

- Action tests (`patients.test.ts`): ~30 covering validation, session guard, rate limit, transactional rollback on audit failure, curated error codes, no-PHI-in-errors
- Component tests: keyboard nav on PatientTypeahead, focus trap + Cancel-first on ConfirmDialog, aria-live announcements on PatientContextField, destructive variant on Button, scope enforcement on pages
- Integration: `phi-lifecycle.test.ts` scenarios filled for create → update → archive with audit rows verified inside the transaction

Coverage gate preserved (statements ≥ 97.79%, branches ≥ 95.46%). Full suite green at HEAD before UAT approval.

## Decisions Made

See `key-decisions` in frontmatter. Headlines:

- **M-6 transactional pattern** unifies write-path audits across the phase (patients here, notes in 04-03)
- **audit-service fire-and-forget now error-logs** — no more silent audit failures on read paths
- **ConfirmDialog Cancel-first initial focus** — deliberate safer default for destructive actions
- **UAT #3 required a 3-part coordinated fix** — any partial fix reproduced the bug; captured in patterns so future work doesn't regress (component-level Suspense vs route-level loading.tsx when focus preservation matters)
- **PatientContextField view → edit toggle, not auto-save** — clinician mental model driven

## Deviations from Plan

Two minor scope adjustments, both user-surfaced and fixed within the UAT loop:

### Auto-fixed Issues

**1. [Rule 2 - Auto-fix bug] Search-input focus loss on debounced URL updates**
- **Found during:** Task 3 UAT #3
- **Issue:** Next.js 16 App Router auto-focuses `<main>` on `router.replace()` as an a11y behavior; route-level `loading.tsx` compounded the problem by re-mounting the subtree containing the focused input
- **Fix:** Three coordinated changes — `router.replace(url, { scroll: false })` in SearchPatients; component-level `<Suspense>` in page.tsx; delete route-level `loading.tsx`
- **Files modified:** `web/src/components/patients/SearchPatients.tsx`, `web/src/app/dashboard/patients/page.tsx`, `web/src/app/dashboard/patients/loading.tsx` (deleted)
- **Verification:** Playwright instrumentation confirmed `document.activeElement` stays on the input across URL pushes; UAT re-run passed
- **Committed in:** `9f3d987` (initial) + `5f82a2a` (real fix with root-cause analysis)

**2. [Rule 2 - Missing critical functionality] Phone formatting**
- **Found during:** Task 3 UAT #1
- **Issue:** Plan spec'd `phone` as a free-text Zod string but omitted UI formatting. Clinicians saw raw `5550100` strings and a text input with no mask — sub-MVP polish for a healthcare field that's visible on every patient row
- **Fix:** Added `web/src/lib/utils/phone.ts` with display formatter + progressive input mask (preserves cursor; accepts US and international)
- **Files modified:** `web/src/lib/utils/phone.ts` (new), `web/src/lib/utils/phone.test.ts` (new), `web/src/components/patients/PatientInfoCard.tsx`, `web/src/components/patients/PatientRow.tsx`, `web/src/components/patients/PatientCreateForm.tsx`
- **Verification:** 7 phone-utility tests cover US formatting, international, paste, partial entry, cursor preservation; UAT re-run passed
- **Committed in:** `a6a4f40`

**3. [Rule 1 - Auto-fix bug] PatientContextField auto-save on blur**
- **Found during:** Task 3 UAT #2
- **Issue:** Plan spec'd an explicit Save button "when dirty" but the initial implementation live-saved on blur, which surprised the clinician and risked committing partial edits
- **Fix:** Refactored to view → edit toggle with a dedicated Save button; no blur-save
- **Files modified:** `web/src/components/patients/PatientContextField.tsx`, test
- **Committed in:** `0c28227`

**4. [Rule 1 - Auto-fix bug] Archive redirect target**
- **Found during:** Task 3 UAT #4
- **Issue:** Archive flow refreshed the detail page, which 404'd post-archive
- **Fix:** Redirect to `/dashboard/patients` on success
- **Committed in:** `3736bd6`

**5. [Rule 1 - Auto-fix bug] Mobile Sidebar drawer persistence**
- **Found during:** Task 3 UAT #5
- **Issue:** On 375px width, nav-link click left the drawer open
- **Fix:** `SidebarContext.closeSidebar` callback invoked in NavLink onClick
- **Files modified:** `web/src/components/Sidebar.tsx`, test
- **Committed in:** `18df1f2`

---

**Total deviations:** 5 auto-fixed (all UAT-surfaced; 3 Rule 1 bugs, 1 Rule 2 missing critical UX functionality, 1 Rule 2 bug-plus-fix compound)
**Impact on plan:** All fixes preserved scope — no architectural changes, no new dependencies. UAT added ~75 minutes of fix-verify iteration on top of the base 2 tasks. Final state fully satisfies plan `<success_criteria>` and 04-UI-SPEC.md contract.

## Issues Encountered

- **UAT #3 focus loss required a Playwright-driven root-cause session** — the first fix attempt (`9f3d987`) reduced the symptom but didn't fully eliminate it. The orchestrator instrumented Playwright to compare `document.activeElement` across debounce ticks and identified the `<main>` auto-focus + `loading.tsx` subtree-remount interaction. Required a second commit (`5f82a2a`) with three coordinated changes to fully fix.

No other issues. All other UAT findings were straightforward once reproduced.

## Self-Check: PASSED

- All 29 files listed in `key-files.created` exist on disk (verified via `ls web/src/components/patients/` + `ls web/src/app/dashboard/patients/`)
- `web/src/app/dashboard/patients/loading.tsx` confirmed absent (deleted per UAT #3 fix)
- All 9 plan commits verified via `git log --oneline` (`1339db0`, `b6d23f6`, `3736bd6`, `9f3d987`, `18df1f2`, `a6a4f40`, `0c28227`, `c628d67`, `5f82a2a`)
- Test count 1893 → 1939 (+46) verified by orchestrator before UAT approval
- `pnpm tsc --noEmit` clean, `pnpm lint` clean, full test suite green (orchestrator-verified)

## Next Plan Readiness

**Ready for Plan 04-03 (notes-versioning):**

- `PatientTypeahead` available as a WAI-ARIA 1.2 combobox primitive for NoteGenerationForm patient selection
- `ConfirmDialog` + `Button variant="destructive"` available for the archive-note flow
- `PATIENT_ERROR_MESSAGES` pattern available to mirror as `NOTE_ERROR_MESSAGES`
- Server Action transactional shape (getPoolClient + BEGIN + DAL(...,client) + auditService.logWithClient + COMMIT) established — 04-03 saveNoteAction / updateNoteSectionsAction / archiveNoteAction copy this pattern directly
- `audit-service.logWithClient` proven in a transactional write path
- `findPatientById` / `findPatientsByScope` available for patient/note linkage
- `usePhiCleanup` pattern validated end-to-end on patient detail — 04-03 wires it identically on the note detail + generation views
- `loading.tsx`-vs-component-Suspense lesson documented so 04-03 note-detail doesn't regress the pattern

**No blockers.** Plan 04-03 can execute against this foundation.

---
*Phase: 04-phi-storage*
*Plan: 02-patients*
*Completed: 2026-04-18*
