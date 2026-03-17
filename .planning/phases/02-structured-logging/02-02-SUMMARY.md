---
phase: 02-structured-logging
plan: 02
subsystem: monitoring
tags: [pino, logging, telemetry, error-boundaries, instrumentation, console-migration]

# Dependency graph
requires:
  - "02-01: Pino logger singleton, client telemetry library, /api/telemetry endpoint"
provides:
  - "All 42 console.* calls in 15 server-side production files replaced with structured Pino logger calls"
  - "4 error boundaries wired to reportErrorBoundary (Sentry removed)"
  - "instrumentation.ts onRequestError uses Pino logger via dynamic import"
  - "instrumentation.test.ts verifies onRequestError structured logging"
  - "Auth/security log calls tagged with { audit: true } for future log sink routing"
affects: [02-structured-logging, sentry-removal, monitoring, deployment]

# Tech tracking
tech-stack:
  added: []
  patterns: [structured-logger-migration, error-boundary-telemetry, instrumentation-pino]

key-files:
  created:
    - web/src/instrumentation.test.ts
  modified:
    - web/src/server/services/billing.ts
    - web/src/server/services/email.ts
    - web/src/server/services/auth.ts
    - web/src/server/services/audit.ts
    - web/src/server/services/llm/provider.ts
    - web/src/server/services/llm/gemini-provider.ts
    - web/src/server/services/llm/claude-provider.ts
    - web/src/server/db/index.ts
    - web/src/server/dal/usage.ts
    - web/src/server/dal/health.ts
    - web/src/server/lib/get-session.ts
    - web/src/actions/auth.ts
    - web/src/actions/notes.ts
    - web/src/actions/billing.ts
    - web/src/app/api/cleanup/webhook-events/route.ts
    - web/src/app/error.tsx
    - web/src/app/global-error.tsx
    - web/src/app/dashboard/error.tsx
    - web/src/components/ErrorBoundary.tsx
    - web/src/instrumentation.ts

key-decisions:
  - "Email dev-mode: 7 console.log calls consolidated into single logger.info call (no email body logged)"
  - "Error boundaries: componentStack not sent to telemetry (Error.stack provides sufficient context)"
  - "instrumentation.ts: register() function removed entirely (was only used for Sentry init)"

patterns-established:
  - "Logger import pattern: import { logger } from '@/server/lib/logger' in all server-side files"
  - "Error object pattern: always pass as { err: error } for Pino stack trace serialization"
  - "Audit tagging: { audit: true } on auth events, lockout, session deletion, suspicious patterns, audit service failures"
  - "Test mock pattern: vi.hoisted mockLogger with info/warn/error/debug/child fns + vi.mock('@/server/lib/logger')"

requirements-completed: [MON-02, MON-04, MON-05]

# Metrics
duration: 21min
completed: 2026-03-17
---

# Phase 02 Plan 02: Console-to-Pino Migration Summary

**Replaced all 42 console.* calls with structured Pino logger across 15 server files, wired 4 error boundaries to client telemetry, rewrote instrumentation.ts to use Pino, and created instrumentation test**

## Performance

- **Duration:** 21 min
- **Started:** 2026-03-17T05:19:29Z
- **Completed:** 2026-03-17T05:40:48Z
- **Tasks:** 2
- **Files modified:** 33 (15 production + 1 created + 17 test files)

## Accomplishments
- Migrated all 42 console.* calls across 15 production files to structured Pino logger with source, errorType, and severity
- Auth/security events tagged with `{ audit: true }` for future Cloud Logging sink routing
- Error boundaries (error.tsx, global-error.tsx, dashboard/error.tsx, ErrorBoundary.tsx) switched from Sentry.captureException to reportErrorBoundary
- instrumentation.ts rewritten: onRequestError uses Pino logger via dynamic import, register() removed
- Created instrumentation.test.ts (2 tests) verifying logger.error called with source, err, routePath, and method
- Updated 17 test files to mock logger instead of console spies, maintaining assertion quality

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate all server-side console.* calls to Pino logger** - `0609366` (feat)
2. **Task 2: Wire error boundaries to telemetry, rewrite instrumentation.ts** - `efea49e` (feat)

## Files Created/Modified

**Created:**
- `web/src/instrumentation.test.ts` - Unit test for onRequestError hook (2 tests)

**Modified (production):**
- `web/src/server/services/billing.ts` - 9 console calls -> logger (info/warn/error)
- `web/src/server/services/email.ts` - 8 console calls -> 1 logger.info + 1 logger.error
- `web/src/server/services/auth.ts` - 4 console calls -> logger.error with audit tags
- `web/src/server/services/audit.ts` - 1 console call -> logger.error with audit tag
- `web/src/server/services/llm/provider.ts` - 1 console call -> logger.warn
- `web/src/server/services/llm/gemini-provider.ts` - 2 console calls -> logger.error
- `web/src/server/services/llm/claude-provider.ts` - 2 console calls -> logger.error
- `web/src/server/db/index.ts` - 5 console calls -> logger (error/warn)
- `web/src/server/dal/usage.ts` - 1 console call -> logger.error
- `web/src/server/dal/health.ts` - 1 console call -> logger.error
- `web/src/server/lib/get-session.ts` - 2 console calls -> logger.error
- `web/src/actions/auth.ts` - 3 console calls -> logger.error with audit tag
- `web/src/actions/notes.ts` - 2 console calls -> logger (warn + error)
- `web/src/actions/billing.ts` - 2 console calls -> logger.error
- `web/src/app/api/cleanup/webhook-events/route.ts` - 2 console calls -> logger (info + error)
- `web/src/app/error.tsx` - Sentry -> reportErrorBoundary
- `web/src/app/global-error.tsx` - Sentry -> reportErrorBoundary
- `web/src/app/dashboard/error.tsx` - console.error -> reportErrorBoundary
- `web/src/components/ErrorBoundary.tsx` - Sentry -> reportErrorBoundary
- `web/src/instrumentation.ts` - Sentry -> Pino logger with dynamic import

**Modified (tests):**
- `web/src/server/services/billing.test.ts` - mockLogger instead of console spies
- `web/src/server/services/email-devmode.test.ts` - mockLogger instead of console spies
- `web/src/server/services/audit.test.ts` - mockLogger instead of console spies
- `web/src/server/services/llm/provider.test.ts` - mockLogger instead of console spies
- `web/src/server/services/llm/gemini-provider.test.ts` - mockLogger instead of console spies
- `web/src/server/services/llm/claude-provider.test.ts` - mockLogger instead of console spies
- `web/src/server/lib/get-session.test.ts` - mockLogger instead of console spies
- `web/src/server/dal/usage.test.ts` - mockLogger instead of console spies
- `web/src/actions/notes.test.ts` - mockLogger instead of console spies
- `web/src/app/api/cleanup/webhook-events/route.test.ts` - mockLogger instead of console spies
- `web/src/components/ErrorBoundary.test.tsx` - mockReportErrorBoundary instead of Sentry
- `web/src/app/dashboard/error.test.tsx` - mockReportErrorBoundary instead of console.error

## Decisions Made
- Email dev-mode: Consolidated 7 console.log calls (separator, header, to, subject, separator, body, separator) into single `logger.info({ source, subject, to: '[redacted]' })`. Email body intentionally excluded from log (minimal logging principle).
- Error boundaries: `componentStack` from React's errorInfo is not forwarded to telemetry endpoint. The Error object's stack trace provides sufficient debugging context for Cloud Error Reporting.
- instrumentation.ts: `register()` function was only used for Sentry init. Removed entirely since Sentry is being replaced by Pino + client telemetry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated LLM provider test files to mock logger instead of console spies**
- **Found during:** Task 1 (verification)
- **Issue:** gemini-provider.test.ts, claude-provider.test.ts, and provider.test.ts all used consoleErrorSpy/consoleWarnSpy to assert on console.* calls that were just replaced with logger calls
- **Fix:** Added vi.hoisted mockLogger mock, replaced console spy assertions with mockLogger assertions
- **Files modified:** 3 LLM test files
- **Committed in:** 0609366 (Task 1 commit)

**2. [Rule 3 - Blocking] Updated billing.test.ts and webhook cleanup route.test.ts to mock logger**
- **Found during:** Task 1 (verification)
- **Issue:** billing.test.ts had 12 console spy assertions, route.test.ts had 2 -- all broken by Task 1 migration
- **Fix:** Added mockLogger mock, replaced all console spy assertions with logger mock assertions
- **Files modified:** 2 test files
- **Committed in:** 0609366 (Task 1 commit)

**3. [Rule 3 - Blocking] Updated Task 2 test files early (audit, email, get-session, usage, notes)**
- **Found during:** Task 1 (verification)
- **Issue:** These 5 test files were planned for Task 2 updates but broke immediately from Task 1's console->logger migration. Tests must pass after each commit.
- **Fix:** Added mockLogger mocks and updated assertions in all 5 files during Task 1
- **Files modified:** 5 test files
- **Committed in:** 0609366 (Task 1 commit)

**4. [Rule 3 - Blocking] Updated dashboard/error.test.tsx to mock telemetry**
- **Found during:** Task 2 (verification)
- **Issue:** Test asserted console.error('Dashboard error:') which was replaced with reportErrorBoundary
- **Fix:** Added mockReportErrorBoundary mock, updated assertion
- **Files modified:** web/src/app/dashboard/error.test.tsx
- **Committed in:** efea49e (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (all Rule 3 blocking -- test files broken by production code migration)
**Impact on plan:** All deviations were test file updates that were necessary for the test suite to pass after each commit. The plan listed some of these test files in Task 2, but they broke in Task 1 and needed immediate fixing. 7 additional test files beyond the plan's 6 required updates. No scope creep -- all changes are direct consequences of the console-to-logger migration.

## Issues Encountered
None -- all failures were expected test breakage from the console->logger migration, resolved via deviation Rule 3.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All server-side logging now flows through Pino structured logger
- Client-side error capture flows through reportErrorBoundary -> /api/telemetry
- instrumentation.ts onRequestError captures unhandled server errors through Pino
- Zero console.* calls remain in production code (except 3 exempted files: config.ts, redis.ts, migrate.ts)
- Zero Sentry references remain in error boundaries or instrumentation
- Ready for Plan 03: Sentry removal and instrumentation-client.ts wiring

## Self-Check: PASSED

All created files verified on disk. Both commit hashes (0609366, efea49e) verified in git log. Zero console.* calls in production code (excluding 3 exempt files). Zero Sentry references in migrated files. Full test suite (1558 tests) passes with zero regressions.

---
*Phase: 02-structured-logging*
*Completed: 2026-03-17*
