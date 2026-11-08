# Bug Backlog

Open bugs and suspected bugs. This is the only bug list in the repo. Feature work lives in [ROADMAP.md](./ROADMAP.md). Two bugs are tracked as GitHub issues instead: #124 (notes list not announced to screen readers) and #125 (dev-only Dependabot alerts).

Entries here are short on purpose. **Before fixing one, reproduce it with a failing test**, then fix it or delete the entry. When something is fixed, remove the line; the commit is the record.

Paths are relative to `web/src/`. Everything below was re-verified against the code on 2026-11-07. That check read the code; it did not run failing tests.

## Generate → save loop (ROADMAP "Next up" item 1)

| Location | Problem |
|---|---|
| `actions/notes.ts:337` | `saveNoteAction` has no caller outside tests, so a generated note can't be saved from the UI. |
| `components/notes/NoteGenerationForm.tsx:402` | BUG-UI-12: the generated note renders below the form on the same page instead of in its own view. |
| Patient detail page, `components/patients/PatientNotesTable.tsx` | Nothing links to `/dashboard/notes/new?patientId=…`, not even the "no notes yet" empty state. The new-note patient field is read-only, so the UI has no way to link a note to a patient. `PatientTypeahead.tsx` is built but rendered nowhere. |
| `components/notes/NoteGenerationForm.tsx:340` | "Additional Context" is free text marked TEMPORARY. When a linked patient has stored context, `generateNoteAction` ignores the typed text without telling the user. `saveNoteAction` doesn't persist it, so for an unlinked note the context that shaped generation is lost. Decide whether to keep it, merge it, or remove it. |

## Accessibility

| Location | Problem |
|---|---|
| `components/TopBar.tsx:66` + six pages | The notes, notes/new, notes/[id], patients, patients/new, and patients/[id] pages each render two `<h1>`: TopBar's and the page's own (Rule 14). Page tests mock TopBar, so the "exactly one h1" assertions pass. |
| `app/dashboard/patients/page.tsx` (2), `app/dashboard/notes/page.tsx` (3), `components/patients/PatientCreateForm.tsx` (1) | `<Link><Button>` nesting puts a `<button>` inside an `<a>`. In `PatientCreateForm`, a disabled Cancel still navigates. |
| `components/Sidebar.tsx:221` | The closed mobile drawer is only translated off-screen; it isn't `inert`, so its links stay focusable. The drawer also has no dialog semantics and doesn't move focus in on open or return it on close. |

## Error handling and observability

| Location | Problem |
|---|---|
| `server/services/llm/gemini-provider.ts:170` | `getADCToken` runs before the timeout and outside the `try`, using a raw `fetch` with no timeout. A network failure surfaces as `internal_error` rather than `ai_unavailable`. A hang waits on Node's default timeouts rather than `GEMINI_TIMEOUT_MS`. |
| `server/services/llm/{gemini,claude}-provider.ts` | Both providers call `response.json()` before checking `response.ok`. A non-JSON 429/5xx body becomes `NetworkError` (`ai_unavailable`), not `RateLimitError`, and `Retry-After` is lost. |
| `components/auth/LogoutButton.tsx:24` | The clipboard clear on logout fails silently into an empty catch: no telemetry, and the user isn't warned that PHI may still be on the clipboard (Rule 4). |
| `server/services/auth.ts`, `server/services/lockout.ts` | A login against a locked account is audited as `LOGIN_FAILED`, never `LOGIN_BLOCKED_LOCKED`. With a wrong password the audit row has no user ID or lockout reason; with the right password, two `LOGIN_FAILED` rows are written. Also, 8 org/invite `AuditAction` members plus `AUTH_FAILED`, `CSRF_FAILED`, and `EMAIL_VERIFICATION_SENT` are never emitted (see [compliance/AUDIT_LOGGING_REQUIREMENTS.md](./compliance/AUDIT_LOGGING_REQUIREMENTS.md)). |
| `server/dal/users.ts:272`, `server/services/lockout.ts:16,47` | Lockout thresholds exist in three copies. The DAL SQL sets `locked_until`; the service's table drives the audit metadata and the returned status. They agree today, and no test would catch them drifting apart. |
| `server/services/auth.ts:83,94,118,288` | These log `source: 'dal_auth'` from a service module. The same file also uses `service_auth` and `registration`. CLAUDE.md's source-naming table has no pattern for services. |

## Testing

| Location | Problem |
|---|---|
| `test/db-harness.ts` | The three real-DB suites (`test/integration/phi-*.test.ts`, `template-authorization.test.ts`) each drop and recreate the same schema in `beforeAll`, so they race when Vitest runs files in parallel: run together, `phi-migration` and `template-authorization` failed, and with `--no-file-parallelism` both passed. To run them at all, `DATABASE_URL` and `GEMINI_API_KEY` must also be set, because importing the DAL validates config. DAL calls made without a client go to `DATABASE_URL`, not `DATABASE_URL_TEST`. Fix this before adding Postgres to CI (ROADMAP "Quality"). |

## Low priority

| Location | Problem |
|---|---|
| `actions/notes.ts:503` | `updateNoteSectionsAction` reads the note with `findClinicalNoteById(scope, …)` outside its transaction; the DAL function takes no client. No wrong result follows: the UPDATE matches only when `updated_at` equals the client's `expectedUpdatedAt`, so a concurrent edit returns `conflict`. |
| `actions/auth.ts` | On `validation_error`, auth actions return unsanitized Zod `fieldErrors`, unlike notes, patients, and templates, which use `sanitizeFieldErrors`. No auth UI renders them, and they expose schema limits only. |
| `actions/*.ts` | For an unverified-email session, the 8 notes/patients/templates actions return `unauthenticated`, while `generateNoteAction` and the billing actions return `email_not_verified`. The dashboard layout redirect keeps the UI from hitting this. |
| `server/db/config.ts:68` | The default `ANTHROPIC_MODEL` `claude-sonnet-4-20250514` was retired on 2026-06-15, so the dev-only Claude provider fails on defaults. The replacement is `claude-sonnet-5-5`. Production rejects `LLM_PROVIDER=claude`. |
| `components/notes/HallucinationFlag.tsx:4` | A Client Component type-imports `HallucinationIssue` from a `server-only` module. It works, but it breaks the `lib/` vs `server/` layering, and no lint rule enforces the boundary. |
