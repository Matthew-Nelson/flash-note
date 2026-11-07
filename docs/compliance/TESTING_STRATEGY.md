# FlashNote Testing Strategy

Describes testing in the repository as it exists now. The app is a single Next.js application in `web/`. All commands below run from `web/`.

For security-test requirements, see [Rule 6 in CLAUDE.md](../../CLAUDE.md). This document does not restate them in full.

## Test Layers

| Layer | Location | Tooling | Runs via |
|-------|----------|---------|----------|
| Unit and component | Colocated `*.test.ts` / `*.test.tsx` under `web/src/` | Vitest, React Testing Library, jsdom | `pnpm test` |
| Integration | `web/src/test/integration/` | Vitest | `pnpm test` (same include glob) |
| End-to-end | `web/tests/e2e/` | Playwright (Chromium only) | `pnpm test:e2e` |

Vitest picks up `src/**/*.test.{ts,tsx}` (`web/vitest.config.ts`). `tests/e2e/**` is excluded from Vitest.

### Scripts (`web/package.json`)

- `pnpm test`: `vitest --run`
- `pnpm test:watch`: `vitest`
- `pnpm test:coverage`: `vitest --run --coverage`
- `pnpm test:ci`: `vitest --run --coverage --reporter=verbose`
- `pnpm test:e2e`: `pnpm exec playwright test` (also `:ui`, `:headed`, `:debug`, `:codegen` variants)
- `pnpm lint`: `eslint src`

### Unit and component tests

- Tests live next to the code they cover. There are 139 `*.test.ts(x)` files under `web/src/` (`find src -name '*.test.ts*'`), 5 of them in `src/test/integration/`.
- Global setup is `web/src/test/setup.ts`. It loads jest-dom matchers, mocks `server-only` and `next/navigation`, installs a spy-able `sessionStorage`, and runs RTL `cleanup()` after each test (required for React 19).
- Shared helpers in `web/src/test/`: `dal-helpers.ts` (mock `db.query` / pool client, row builders), `form-data.ts` (`toFormData`), `factories/` (session, patient, clinical note, template, version, style preference), `db-harness.ts` (real-Postgres harness, see below).
- DAL unit tests use the mocked query helpers in `dal-helpers.ts`.

### Global Vitest isolation

`web/vitest.config.ts` sets `mockReset`, `restoreMocks`, `unstubEnvs` and `unstubGlobals` to `true`, and `LOG_LEVEL=silent`.

Consequence: mock implementations are cleared before every test. A module-level `const m = vi.fn().mockResolvedValue(x)` loses `x` after the first test. Either arm the mock in `beforeEach`, or pass the implementation to the constructor (`vi.fn(impl)`), which `mockReset` restores. Tests that assert on logging must mock the logger, since the real logger is silenced.

For mocks referenced inside `vi.mock` factories, use `vi.hoisted(() => vi.fn())`.

## Integration Tests (`web/src/test/integration/`)

| File | Needs a database | Behavior |
|------|------------------|----------|
| `auth-lifecycle.test.ts` | No | Real auth, lockout and token services and DAL against a mocked DB driver. Email and audit are mocked. `BCRYPT_ROUNDS` is mocked to 1 for speed. |
| `note-generation-access.test.ts` | No | Real `checkSubscriptionAccess` behind `generateNoteAction`. Session, org DAL, LLM, usage, audit, request context and rate limiter are mocked. |
| `db-config.test.ts` | No | Pool TLS configuration across `NODE_ENV` / `DATABASE_URL` values. |
| `phi-lifecycle.test.ts` | Yes | `describe.skipIf(!hasTestDb)`, gated on `DATABASE_URL_TEST`. |
| `phi-migration.test.ts` | Yes | `describe.skipIf(!process.env.DATABASE_URL_TEST)`. Exercises triggers, constraints and foreign keys of `002_phi_storage`. |

The two database-backed files use `src/test/db-harness.ts`, which connects to `DATABASE_URL_TEST`, runs `DROP SCHEMA public CASCADE`, and applies migrations `001_initial_schema.sql` and `002_phi_storage.sql`. Point it only at a dedicated throwaway database.

No integration test reads Upstash credentials. The rate limiter is mocked where it appears.

## End-to-End Tests (`web/tests/e2e/`)

Spec files: `auth`, `authorization`, `dashboard`, `email-verification`, `landing`, `navigation`, `notes`, `password-reset`, `patients`, `pricing`, `settings` (11 `*.spec.ts` files), plus `auth.setup.ts`.

### Isolation

`web/playwright.config.ts` starts its own server through `webServer.command`:

1. `tests/e2e/setup/prepare-db.ts` drops and recreates the e2e database, then runs `src/server/db/migrate.ts` against it.
2. `next dev --port 3100` starts against that database.

Details:

- Database: `E2E_DATABASE_URL`, default `postgres://localhost:5432/flashnote_e2e` (`tests/e2e/setup/env.ts`). `prepare-db.ts` refuses any database name not matching `^[a-z0-9_]+_e2e$`.
- Port: `E2E_PORT`, default 3100, so the suite never reuses a developer's `pnpm dev` server on 3000. `reuseExistingServer` is `false`.
- Build directory: `NEXT_DIST_DIR=.next-e2e`, so it can run alongside a developer's dev server.
- Server env: `NODE_ENV=test`, `USE_MOCK_AI=true`, `REGISTRATION_MODE=open`, `TRUSTED_PROXY_COUNT=0`, `LOG_LEVEL=warn`. Next skips `.env.local` when `NODE_ENV=test`, so keys kept there do not reach the e2e server; `.env`, `.env.test` and `.env.test.local` are still loaded and must hold no real third-party keys.
- Mock AI: `USE_MOCK_AI=true` is read in `src/server/db/config.ts`; no Gemini call is made.

### Users and sessions

- `auth.setup.ts` (Playwright project `setup`) creates a shared verified user, logs in through the real `/login` form, and saves cookies to `tests/e2e/.auth/shared-user.json` (git-ignored). The `chromium` project depends on `setup`.
- Read-only specs opt in with `test.use({ storageState: SHARED_USER_STATE })`.
- Specs that log out or assert on per-account data create their own user (`createUser`, `signInNewUser`) because logout deletes the session row and would sign out every test sharing the state.
- `tests/e2e/helpers/db.ts` is for arrangement only (users, email tokens, patients, notes); assertions go through the UI.
- The `fill` helper in `fixtures/web.ts` waits for React hydration before filling, because under `next dev` input events sent before hydration are lost.

### Runner settings

`fullyParallel: true`; in CI (`process.env.CI`) 2 retries and 2 workers, `forbidOnly`; 60 s test timeout; trace on first retry; screenshot on failure; video on first retry.

## Coverage

Provider: v8. Measured scope: `src/lib/**`, `src/components/**`, `src/server/**`. Excluded: tests, `src/test/**`, `src/app/**` (covered by e2e instead), type-only files, `src/server/db/migrate.ts`, and barrel `index.ts` files (full list in `vitest.config.ts`).

Thresholds (lines, functions, branches, statements): **95 / 95 / 95 / 95**. Vitest exits non-zero when any is below threshold.

Enforcement points:

- CI runs `pnpm test:ci`, which includes `--coverage`, so thresholds fail the job.
- `.git/hooks/pre-push`, if installed locally, runs `pnpm lint --quiet`, `npx tsc --noEmit`, then `pnpm test:coverage`. It can be bypassed with `--no-verify`. Git hooks are not versioned, so this is not a guarantee for every clone.

## CI

`.github/workflows/ci.yml` runs on pushes and pull requests to `main` (ignoring `docs/**`, `**/*.md`, `.claude/**`) and on `workflow_dispatch`.

`Web` job, in order: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test:ci`, `pnpm build`, a coverage summary written to the step summary, and `pnpm audit --audit-level=high` (`continue-on-error: true`, advisory only).

`Terraform Plan` job (pull requests only) runs a plan when `infra/**` changed. `CI Success` fails if `Web` did not succeed or the plan failed.

`.github/workflows/e2e.yml` runs on pushes to `main` (same path ignores) and `workflow_dispatch`. It is not run on pull requests, so an e2e failure turns `main` red rather than blocking a PR. It uses a `postgres:15` service container, installs Chromium, and runs `pnpm test:e2e` with `E2E_DATABASE_URL=postgres://test:test@localhost:5432/flashnote_e2e`. Playwright report and test results are uploaded as artifacts (7-day retention).

`.github/workflows/deploy.yml` exists and is triggered after CI on `main`. Deployment is not part of testing and is out of scope here.

## Known Gaps

- The `Web` job in `ci.yml` has no Postgres service and sets no `DATABASE_URL_TEST`, so `phi-lifecycle.test.ts` and `phi-migration.test.ts` are skipped in CI. They run only where a developer sets `DATABASE_URL_TEST`. The only real-Postgres coverage in CI is the post-merge e2e run.
- No automated accessibility assertions: `axe-core`, `vitest-axe` and `jest-axe` are not in `web/package.json`. Rules 11 to 14 in CLAUDE.md are checked only by `eslint-plugin-jsx-a11y` (`web/eslint.config.mjs`) and manual review.
- No DAST and no secret scanning in `.github/workflows/`. The only security scan is `pnpm audit`, which is advisory.
- E2E clipboard coverage is one test (`notes.spec.ts`: copy, then sign out clears the clipboard). Other copy paths are not covered in e2e.
- No e2e spec exercises rate-limit behavior or its user-facing message. Rate limiting is mocked in the integration test above.
- E2E runs on Chromium only and not on pull requests.
