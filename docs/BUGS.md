# Bug Backlog

Open bugs and suspected bugs. This is the only bug list in the repo. Feature work lives in [ROADMAP.md](./ROADMAP.md).

Entries here are short on purpose. **Triage before fixing:** reproduce the bug with a failing test, then either fix it or delete the entry. When something is fixed, remove the line; the commit is the record.

## Confirmed

| Location | Problem |
|---|---|
| `web/src/actions/notes.ts:348` | `saveNoteAction` has no caller outside tests, so a generated note can't be saved from the UI. Patients, the notes list, and the note detail pages only show notes seeded directly into the DB. |
| `web/src/components/notes/NoteGenerationForm.tsx:402` | BUG-UI-12: the generated note renders below the form on the same page instead of in its own view. |

## Reported in earlier reviews, not yet triaged

Found in the October 2026 test-suite audit and the PR #126 and #127 work. Not re-verified since.

| Location | Problem |
|---|---|
| `web/src/server/dal/note-templates.ts:156-166` | `generateNoteAction` doesn't check that the requested template belongs to the user. |
| Auth pages (login, signup, reset forms) | Forms lack `method="post"`. A submit before hydration sends a GET with the password in the URL. |
| `web/src/actions/auth.ts` | Auth actions return raw Zod messages to the client (Rule 2). |
| Dashboard pages + `TopBar` | Six dashboard pages render two `<h1>` elements (TopBar and page). Unit tests mock TopBar, which hides it. |
| `web/src/components/Sidebar.tsx` | When the mobile drawer is closed, it isn't `inert` or `aria-hidden`. |
| `web/src/actions/patients.ts` | A patient update can't clear an optional field. |
| `web/src/server/services/llm/gemini-provider.ts` | `getADCToken` runs outside the `try` and has no timeout. |
| `web/src/server/services/llm/*-provider.ts` | Providers parse the response body before checking `response.ok`. |
| `web/src/components/auth/LogoutButton.tsx` | A failure to clear the clipboard on logout is swallowed silently (Rule 4). |
| Auth actions / `getSession` | `unauthenticated` and `email_not_verified` are used inconsistently. |
| `web/src/server/dal/users.ts`, `web/src/server/services/lockout.ts` | Lockout thresholds are defined twice: the SQL in the DAL is enforced, and the service only audits. |
| Several components | `<Link><Button>` nesting puts an interactive element inside another. |
| Patient detail page | There is no link from a patient to "new note for this patient". |

## Suspected, from the 2026-11-07 docs audit

Noticed in passing while reading code. These are lower confidence.

| Location | Problem |
|---|---|
| `web/src/server/db/config.ts:68` | Default `ANTHROPIC_MODEL` is `claude-sonnet-4-20250514`, which may be retired. Dev-only: production rejects `LLM_PROVIDER=claude`. |
| `web/src/server/services/auth.ts:83,94,118` | Logs use `source: 'dal_auth'` from a service module, which breaks the naming convention and misleads log searches. |
| `web/src/server/types.ts` (`AuditAction`) | 12 audit actions are defined but no non-test code emits them. Failed logins are audited (`LOGIN_FAILED`, `services/auth.ts:104`), but `LOGIN_BLOCKED_LOCKED` never is. Check whether a login attempt against a locked account leaves any audit row. Full list: [compliance/AUDIT_LOGGING_REQUIREMENTS.md](./compliance/AUDIT_LOGGING_REQUIREMENTS.md). |
| `web/src/components/notes/HallucinationFlag.tsx:4` | A Client Component type-imports from a `server-only` module. It works because the import is type-only, but changing it to a value import would break the build. |
| `web/src/components/notes/NoteGenerationForm.tsx:340` | The free-text "Additional Context" input is marked TEMPORARY until PHI storage shipped, and PHI storage has now shipped. Decide whether to keep it alongside the patient selector or remove it. |
| `web/src/proxy.ts:106` | The matcher excludes `/api/*`, so API responses get no CSP header. Probably fine for JSON, but undocumented. |
