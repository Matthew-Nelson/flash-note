---
phase: 02-structured-logging
plan: 04
subsystem: infra
tags: [typescript, eslint, type-safety, pino, telemetry]

# Dependency graph
requires:
  - phase: 02-structured-logging
    provides: Pino logger singleton, client telemetry module, ESLint no-console enforcement
provides:
  - Zero-error lint baseline across all Phase 02 files
  - Unblocked pre-commit hook (lint gate was failing)
affects: [all-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "instanceof Error narrowing for DOM any-typed properties (ErrorEvent.error, PromiseRejectionEvent.reason)"
    - "Explicit Buffer typing for Node.js Writable stream chunks in test code"

key-files:
  created: []
  modified:
    - web/src/lib/telemetry.ts
    - web/src/server/lib/logger.test.ts

key-decisions:
  - "PromiseRejectionEvent.reason: typeof string check instead of String() cast to avoid no-base-to-string on unknown types"

patterns-established:
  - "Type narrowing for DOM any types: use instanceof Error, not optional chaining on any"
  - "Writable stream chunk typing: explicitly type as Buffer when Pino is the writer"

requirements-completed: [MON-01, MON-02, MON-03, MON-04, MON-05, MON-06]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 02 Plan 04: TypeScript ESLint Gap Closure Summary

**Fixed 4 TypeScript ESLint type errors in telemetry.ts and logger.test.ts, restoring zero-error lint baseline for Phase 02**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T13:28:11Z
- **Completed:** 2026-03-17T13:30:37Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Fixed `@typescript-eslint/no-unsafe-member-access` on `event.error?.stack` via `instanceof Error` narrowing
- Fixed `@typescript-eslint/no-unsafe-assignment` on `event.reason` via explicit `unknown` typing
- Fixed `@typescript-eslint/no-unsafe-argument` and `@typescript-eslint/no-unsafe-call` on Writable `chunk` via `Buffer` type annotation
- `pnpm lint` now exits 0 with zero errors, unblocking the pre-commit hook

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix TypeScript ESLint type errors in telemetry.ts and logger.test.ts** - `fd3871c` (fix)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `web/src/lib/telemetry.ts` - Narrowed `event.error` via `instanceof Error`, typed `event.reason` as `unknown`, replaced `String()` with `typeof string` check
- `web/src/server/lib/logger.test.ts` - Typed Writable stream `chunk` parameter as `Buffer`

## Decisions Made
- Used `typeof reason === 'string' ? reason : 'Unknown rejection'` instead of `String(reason ?? 'Unknown rejection')` because the `unknown` type triggers `@typescript-eslint/no-base-to-string`. This is also safer -- objects stringify as `[object Object]` which is useless for diagnostics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed no-base-to-string error exposed by type change**
- **Found during:** Task 1 (lint verification after initial edits)
- **Issue:** Changing `reason` from `any` to `unknown` exposed a new `@typescript-eslint/no-base-to-string` error on `String(reason ?? 'Unknown rejection')` because `unknown` could be an object
- **Fix:** Replaced `String(reason ?? 'Unknown rejection')` with `typeof reason === 'string' ? reason : 'Unknown rejection'`
- **Files modified:** `web/src/lib/telemetry.ts`
- **Verification:** `pnpm lint` exits 0, telemetry tests pass
- **Committed in:** fd3871c (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was a direct consequence of the planned type change. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 02 (Structured Logging) is fully complete with zero lint errors
- All 1494 tests pass, pre-commit hook unblocked
- Ready for Phase 03

## Self-Check: PASSED

- [x] web/src/lib/telemetry.ts exists
- [x] web/src/server/lib/logger.test.ts exists
- [x] 02-04-SUMMARY.md exists
- [x] Commit fd3871c exists

---
*Phase: 02-structured-logging*
*Completed: 2026-03-17*
