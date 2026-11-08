# FlashNote Roadmap

**Last updated:** 2026-11-07

This is the single source of truth for the status of technical work. Two other files track specific things:

- [BUGS.md](./BUGS.md) lists open and suspected bugs.
- [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) lists the gates for the deferred deployment.

FlashNote is a portfolio project. Feature work comes first; deployment is deferred until features are complete.

---

## Where things stand

What is built and on `main` today:

- **Auth.** Email/password signup with invite-code gating, email verification, password reset, opaque-token cookie sessions (24h idle, 7-day absolute), progressive lockout, and Upstash rate limiting.
- **Note generation.** Gemini 2.5 Flash; production config enforces Vertex AI with ADC, and a Claude provider exists for dev only. Template-driven prompts with explicit Gemini safety settings. A hallucinated-number detector. Patient context injected into generation. SOAP cards with inline editing and per-section copy.
- **PHI storage.** Patients (create, edit, archive, persistent context). Clinical notes with append-only versions. Note templates. Per-user style preferences. Notes list with full-text search over note content (#118). **Gap:** a generated note can't be saved from the UI yet (see Next up, item 1).
- **Billing.** Stripe checkout, customer portal, and webhooks with idempotency and retry-safe rollback. Trial expiry enforced.
- **Logging.** Pino with the GCP config, PHI redaction paths, and a client telemetry endpoint (`/api/telemetry`). Sentry has been removed.
- **UI.** Sidebar dashboard layout and redesigned auth and marketing pages. Polish pass done: 44px touch targets, print stylesheet, reduced motion, 375px layouts.
- **Testing.** Vitest with 95% coverage thresholds and global mock isolation. 11 Playwright e2e specs running on `main` after merge. See [compliance/TESTING_STRATEGY.md](./compliance/TESTING_STRATEGY.md).
- **Infrastructure as code.** Terraform for Cloud Run, Cloud SQL, the global load balancer, Secret Manager, and IAM/WIF, plus a migration job. None of it has been applied. The Deploy workflow is disabled in GitHub.

---

## Next up

This is the proposed order. Each item should be its own PR.

### 1. Close the generate → save loop

PHI storage is built, but nothing in the UI calls `saveNoteAction`, so a clinician can't keep a generated note.

| Task | Status |
|---|---|
| Wire save into the generation flow (`saveNoteAction`, `web/src/actions/notes.ts:348`) | ❌ |
| Move the generated note out from under the form, e.g. save and then open the note detail page (BUG-UI-12) | ❌ |
| Add a "new note" link from the patient detail page, prefilled with the patient | ❌ |
| E2E: generate → save → appears in patient history | ❌ |

### 2. Triage the bug backlog

Work through [BUGS.md](./BUGS.md). The backlog was re-verified against the code on 2026-11-07, and the three security and data-integrity bugs it found are fixed. Next by severity: the accessibility section, then error handling.

### 3. Note management features

| Task | Status |
|---|---|
| Per-section copy | ✅ |
| Full-text search over note content | ✅ (#118) |
| Search by patient name and date range | ❌ |
| Auto-generated note titles (the `title` field exists; nothing generates a title) | ❌ |
| PDF export (patient, provider, date, SOAP sections) | ❌ |
| Time-saved tracking on the dashboard (per note and cumulative) | ❌ |

### 4. Quality

| Task | Status |
|---|---|
| Postgres service in the CI unit job so the env-gated integration tests run | ❌ |
| `vitest-axe` assertions in component tests | ❌ |
| `@axe-core/playwright` audits in e2e | ❌ |
| `@axe-core/react` dev overlay | ❌ |
| E2E: copy edge cases | ❌ |
| E2E: rate-limit UX | ❌ |
| Secret scanning (GitLeaks) in CI | ❌ |

### 5. Retention features

| Task | Status |
|---|---|
| Shorthand macros (e.g. `mtjm` expands to full text), stored per user | ❌ |
| Magic Edit: a free-text instruction re-edits a saved note and creates a new version | ❌ |
| Failed-payment email (the `invoice.payment_failed` handler currently sends none) | ❌ |

### 6. Clinic features

The org tables and DAL (`organizations`, `organization_members`, `invite_codes`) already exist. Nothing in the UI uses them yet.

| Task | Status |
|---|---|
| Team dashboard (`/dashboard/team`) with per-therapist usage | ❌ |
| Org management actions: invite, remove, seat utilization | ❌ |
| Shared templates and macros across a clinic | ❌ |
| Clinic plan with seat-based Stripe billing, plus pricing page | ❌ |
| Leave an org and transfer ownership | ❌ |

The original design spec is [APP_GATING_STRATEGY.md](https://github.com/Matthew-Nelson/flash-note/blob/bac14f6460a91f9ad03698ff66ab9ce0460ca7c3/docs/planning/APP_GATING_STRATEGY.md), a historical copy that also describes the removed extension.

---

## Deferred: deployment track

Everything needed to run FlashNote for real users is in [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md): applying Terraform, staging verification, the audit-log retention sink, alerts, Stripe live mode, legal review, and DAST. None of it starts until the project resumes deployment.

---

## Ideas (not scheduled)

Voice input, OAuth/social login, treatment-plan generation, a custom template builder UI, and conversational or review modes. Earlier research for these is in the [historical docs](#history).

API-as-a-service is not planned. Pursuing it would require extracting a standalone API server (see the ADR in CLAUDE.md).

---

## Recently completed

| When | Work |
|---|---|
| 2026-11 | Bug backlog re-verified against the code. Fixed: forms that sent credentials or PHI as a GET before hydration, generation and save accepting any user's template, patient updates that couldn't clear optional fields, and an unvalidated `?patientId=` on the new-note page. |
| 2026-11 | #127 Playwright suite rewritten for cookie sessions, running on `main` after merge. #128 `next build` no longer needs runtime secrets. #129 ignore local artifacts. |
| 2026-11 | #126 Security tests made able to fail; global Vitest mock isolation. #121 Closed PHI leaks and a TLS bypass found in the test audit. #120 Restored 95% branch coverage and fixed delimiter-tag reassembly. |
| 2026-11 | #118 Full-text search on the notes list. #117 Cataloged BUG-UI-12. #122, #123 Dependency advisories and the Zod 4 migration. |
| 2026-08 – 10 | Relicensed MIT with a not-for-clinical-use disclaimer. Dependency advisory patches (#119). |
| 2026-04 | PHI storage: patients, clinical notes with versioning, templates, style preferences, prompt assembly, safety settings, hallucination detector. |
| 2026-03 | UI polish pass. Pino logging, client telemetry, Sentry removal. Terraform, deploy pipeline with a migration job, deep health check. |
| 2026-02 – 03 | Next.js migration: Express backend and Chrome extension removed. UI redesign phases A–D. |

---

## History

On 2026-11-07, the previous roadmap, planning specs, audits, research, and GSD phase plans (`.planning/`) were removed from the working tree. They described completed work or the deleted architecture. Browse them as they were at [commit bac14f6](https://github.com/Matthew-Nelson/flash-note/tree/bac14f6460a91f9ad03698ff66ab9ce0460ca7c3/docs) ([`.planning/`](https://github.com/Matthew-Nelson/flash-note/tree/bac14f6460a91f9ad03698ff66ab9ce0460ca7c3/.planning)).
