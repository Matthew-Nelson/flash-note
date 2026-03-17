---
phase: 02-structured-logging
plan: 03
subsystem: monitoring
tags: [sentry-removal, eslint, telemetry, instrumentation, no-console]

# Dependency graph
requires:
  - "02-01: Pino logger singleton, client telemetry library (/api/telemetry endpoint)"
  - "02-02: All console.* migrated to Pino, error boundaries wired to telemetry"
provides:
  - "Zero @sentry/nextjs references in entire codebase (source, config, tests, package.json)"
  - "4 Sentry files deleted, @sentry/nextjs uninstalled (~140 transitive deps removed)"
  - "next.config.ts exports config directly without Sentry wrapper"
  - "instrumentation-client.ts calls initClientTelemetry() from @/lib/telemetry"
  - "ESLint no-console rule at error level preventing console.* regression"
affects: [02-structured-logging, deployment, dependency-footprint]

# Tech tracking
tech-stack:
  added: []
  removed: ["@sentry/nextjs"]
  patterns: [eslint-no-console-enforcement, client-telemetry-instrumentation]

key-files:
  created: []
  modified:
    - web/next.config.ts
    - web/src/instrumentation-client.ts
    - web/src/instrumentation.ts
    - web/src/test/setup.ts
    - web/eslint.config.mjs
    - web/.env.example
    - web/package.json
  deleted:
    - web/sentry.server.config.ts
    - web/sentry.edge.config.ts
    - web/src/lib/sentry-sanitization.ts
    - web/src/lib/sentry-sanitization.test.ts

key-decisions:
  - "instrumentation-client.ts rewritten in Task 1 (not Task 2) because build fails without it after @sentry/nextjs removal"
  - "Pre-existing lint errors in telemetry.ts and logger.test.ts left as-is (not caused by this plan's changes)"

patterns-established:
  - "ESLint no-console: error -- all console.* calls blocked unless file has inline eslint-disable"
  - "3 exempted files with inline disables: config.ts (process.exit path), migrate.ts (CLI script), redis.ts (process.exit path)"

requirements-completed: [MON-06]

# Metrics
duration: 7min
completed: 2026-03-17
---

# Phase 02 Plan 03: Sentry Removal & ESLint Tightening Summary

**Complete Sentry SDK removal (4 files deleted, ~140 transitive deps removed), instrumentation-client rewritten for Pino telemetry, ESLint no-console enforced at error level**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-17T05:44:16Z
- **Completed:** 2026-03-17T05:51:29Z
- **Tasks:** 2
- **Files modified:** 11 (7 modified, 4 deleted)

## Accomplishments
- Deleted 4 Sentry-specific files (server config, edge config, sanitization lib + tests) and uninstalled @sentry/nextjs (~140 transitive dependencies removed)
- Rewrote instrumentation-client.ts to call initClientTelemetry() from @/lib/telemetry (replaces 88-line Sentry browser SDK init)
- Removed withSentryConfig wrapper from next.config.ts -- exports config directly
- Removed @sentry/nextjs mock from global test setup
- Cleaned .env.example of SENTRY_DSN and SENTRY_AUTH_TOKEN references
- Tightened ESLint no-console from `['warn', { allow: ['warn', 'error'] }]` to `'error'` -- prevents any future console.* regression
- 3 exempted files (config.ts, migrate.ts, redis.ts) already had inline disable comments from previous work

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete Sentry files, uninstall SDK, clean config** - `ff4cc69` (feat)
2. **Task 2: Tighten ESLint no-console rule** - `b3cbe46` (chore)

## Files Created/Modified

**Deleted:**
- `web/sentry.server.config.ts` - Sentry server-side config
- `web/sentry.edge.config.ts` - Sentry edge runtime config
- `web/src/lib/sentry-sanitization.ts` - PHI sanitization for Sentry payloads
- `web/src/lib/sentry-sanitization.test.ts` - Sanitization tests (40+ tests)

**Modified:**
- `web/next.config.ts` - Removed `withSentryConfig` wrapper, exports nextConfig directly
- `web/src/instrumentation-client.ts` - Rewritten from 88-line Sentry init to 3-line telemetry init
- `web/src/instrumentation.ts` - Fixed type error (err: unknown safe access)
- `web/src/test/setup.ts` - Removed @sentry/nextjs mock block
- `web/eslint.config.mjs` - no-console changed from warn+allow to error
- `web/.env.example` - Removed SENTRY_DSN and SENTRY_AUTH_TOKEN entries
- `web/package.json` - @sentry/nextjs removed from dependencies
- `pnpm-lock.yaml` - Lockfile updated

## Decisions Made
- **instrumentation-client.ts rewritten in Task 1:** The plan assigned this to Task 2, but the build cannot succeed after Task 1 removes @sentry/nextjs while instrumentation-client.ts still imports it. Moved to Task 1 to maintain atomic commit integrity (each commit must be buildable).
- **Pre-existing lint errors not fixed:** telemetry.ts (unsafe member access) and logger.test.ts (unsafe call) have pre-existing lint errors from plan 02-01. These are out of scope per deviation boundary rules -- they exist before and after this plan's changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed type error in instrumentation.ts (err: unknown)**
- **Found during:** Task 1 (build verification)
- **Issue:** After removing @sentry/nextjs, TypeScript strict mode surfaced `err` is of type `unknown` in instrumentation.ts:20. The error was previously masked by Sentry's type definitions.
- **Fix:** Added `const message = err instanceof Error ? err.message : String(err)` before the logger call
- **Files modified:** `web/src/instrumentation.ts`
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** ff4cc69 (Task 1 commit)

**2. [Rule 3 - Blocking] Moved instrumentation-client.ts rewrite from Task 2 to Task 1**
- **Found during:** Task 1 (build verification)
- **Issue:** After uninstalling @sentry/nextjs, instrumentation-client.ts still imported from it, causing build failure
- **Fix:** Rewrote instrumentation-client.ts to call initClientTelemetry() (planned for Task 2)
- **Files modified:** `web/src/instrumentation-client.ts`
- **Verification:** `npx tsc --noEmit` passes, `pnpm test` 1494/1494 pass
- **Committed in:** ff4cc69 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for build integrity. Task 2 scope reduced (instrumentation-client already done). No scope creep.

## Issues Encountered
- `pnpm build` fails with config.ts production validation errors (USE_MOCK_AI, GEMINI_API_URL, CLEANUP_SECRET) when run with local dev .env.local. This is pre-existing -- `next build` sets NODE_ENV=production, triggering config validation designed to block dev credentials in production. Not caused by this plan. TypeScript compilation (`tsc --noEmit`) and tests pass cleanly.

## Deferred Items
- Pre-existing lint errors: `web/src/lib/telemetry.ts:68,74` (unsafe member access/assignment) and `web/src/server/lib/logger.test.ts:40` (unsafe argument/call). These should be addressed in a future cleanup task.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 02 (Structured Logging) is now complete: Pino logger (02-01), console migration + error boundary telemetry (02-02), Sentry removal + ESLint tightening (02-03)
- Codebase has zero Sentry references, structured Pino logging everywhere, client telemetry via /api/telemetry endpoint
- ESLint enforcement prevents regression to console.* logging

## Self-Check: PASSED

All files verified (4 deleted, 7 modified, 1 SUMMARY created). Both task commits confirmed in git log.

---
*Phase: 02-structured-logging*
*Completed: 2026-03-17*
