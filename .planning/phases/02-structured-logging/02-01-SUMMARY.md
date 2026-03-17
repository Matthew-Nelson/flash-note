---
phase: 02-structured-logging
plan: 01
subsystem: monitoring
tags: [pino, logging, telemetry, gcp-cloud-logging, sendbeacon, rate-limiting]

# Dependency graph
requires: []
provides:
  - "Pino logger singleton at @/server/lib/logger with GCP Cloud Logging config and PHI redaction"
  - "Client telemetry library at @/lib/telemetry with sendBeacon/fetch error capture"
  - "POST /api/telemetry endpoint with Zod validation, IP-based rate limiting, and Pino logging"
  - "Request logger factory at @/server/lib/request-logger for Cloud Trace correlation"
  - "telemetryRateLimit export at @/server/lib/rate-limit (20 req/min/IP)"
affects: [02-structured-logging, instrumentation, error-boundaries, sentry-removal]

# Tech tracking
tech-stack:
  added: [pino@10.3.1, "@google-cloud/pino-logging-gcp-config@1.3.3", pino-pretty@13.1.3]
  patterns: [pino-singleton, phi-redaction-paths, sendbeacon-telemetry, cloud-trace-child-logger]

key-files:
  created:
    - web/src/server/lib/logger.ts
    - web/src/server/lib/logger.test.ts
    - web/src/server/lib/request-logger.ts
    - web/src/lib/telemetry.ts
    - web/src/lib/telemetry.test.ts
    - web/src/app/api/telemetry/route.ts
    - web/src/app/api/telemetry/route.test.ts
  modified:
    - web/src/server/lib/rate-limit.ts
    - web/package.json

key-decisions:
  - "Logger reads process.env.NODE_ENV directly, not from config.ts, to avoid circular dependency"
  - "pino-pretty transport skipped in test environment to avoid worker thread overhead"
  - "PHI redaction uses 14 field paths matching sentry-sanitization.ts patterns"
  - "Telemetry endpoint extracts IP using TRUSTED_PROXY_COUNT, consistent with request-context.ts"
  - "sendBeacon sends Blob with application/json; route handler fallback handles text/plain"

patterns-established:
  - "Logger singleton: import { logger } from '@/server/lib/logger' for all server-side logging"
  - "PHI redaction: 14 paths censored as [PHI_REDACTED] via Pino fast-redact"
  - "Client telemetry: sendTelemetry() fire-and-forget via sendBeacon, never throws"
  - "Request logger: createRequestLogger(request) for Cloud Trace correlated child loggers"
  - "Telemetry endpoint: always returns 200 { ok: true }, never leaks errors or rate limit status"

requirements-completed: [MON-01, MON-03]

# Metrics
duration: 7min
completed: 2026-03-17
---

# Phase 02 Plan 01: Logger & Telemetry Foundation Summary

**Pino structured logger singleton with GCP Cloud Logging config, PHI redaction on 14 field paths, client-side sendBeacon telemetry, and rate-limited /api/telemetry ingestion endpoint**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-17T05:08:36Z
- **Completed:** 2026-03-17T05:16:07Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Pino logger singleton with GCP Cloud Logging format in production and pino-pretty in dev
- PHI redaction across 14 field paths using Pino's built-in fast-redact (defense-in-depth)
- Cloud Trace correlation via createRequestLogger child logger factory
- Client telemetry library with sendBeacon/fetch fallback that never throws
- Telemetry endpoint with Zod validation, IP-based rate limiting (20 req/min), and silent failure
- 37 new tests covering redaction, singleton API, trace correlation, telemetry client, and route handler

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create Pino logger singleton with tests** - `1846984` (feat)
2. **Task 2: Create client telemetry library, telemetry endpoint, and rate limiter** - `6f1b882` (feat)

## Files Created/Modified
- `web/src/server/lib/logger.ts` - Pino logger singleton with GCP config and PHI redaction
- `web/src/server/lib/logger.test.ts` - 20 tests: redaction, singleton API, request logger
- `web/src/server/lib/request-logger.ts` - Cloud Trace correlation child logger factory
- `web/src/lib/telemetry.ts` - Client-side error capture via sendBeacon/fetch
- `web/src/lib/telemetry.test.ts` - 8 tests: initClientTelemetry, sendTelemetry, reportErrorBoundary
- `web/src/app/api/telemetry/route.ts` - POST endpoint for client error ingestion
- `web/src/app/api/telemetry/route.test.ts` - 9 tests: validation, rate limiting, body parsing
- `web/src/server/lib/rate-limit.ts` - Added telemetryRateLimit (20 req/min/IP)
- `web/package.json` - Added pino, @google-cloud/pino-logging-gcp-config, pino-pretty

## Decisions Made
- Logger reads `process.env.NODE_ENV` directly (not from config.ts) to avoid circular dependency -- config.ts runs console.error + process.exit at module init before the logger exists
- pino-pretty transport skipped in test environment to avoid worker thread overhead; tests use raw JSON or mock the logger
- Telemetry endpoint extracts IP using TRUSTED_PROXY_COUNT from config, matching the existing request-context.ts pattern exactly
- sendBeacon uses Blob with `application/json` content type (same-origin, no CORS preflight); route handler defensively handles text/plain fallback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict mode errors in telemetry test**
- **Found during:** Task 2 (verification)
- **Issue:** `as [string, Blob]` type assertions on `mock.calls[0]` failed TypeScript strict mode because the source type `unknown[]` doesn't overlap with tuple `[string, Blob]`
- **Fix:** Changed to `as unknown as [string, Blob]` double assertion
- **Files modified:** web/src/lib/telemetry.test.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 6f1b882 (amended into Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Trivial type assertion fix. No scope creep.

## Issues Encountered
- `pnpm build` fails due to pre-existing production env var validation (CLEANUP_SECRET, Gemini API URL, USE_MOCK_AI checks). Not caused by plan changes. `npx tsc --noEmit` confirms zero type errors in all new code.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Logger singleton is ready for console.* migration (Plan 02)
- `reportErrorBoundary` is ready for error boundary wiring (Plan 02)
- `initClientTelemetry` is ready for instrumentation-client.ts (Plan 03)
- `createRequestLogger` is ready for webhook route handler trace correlation (Plan 02)
- telemetryRateLimit is active (returns null in test/dev without Redis, enforced in production)

## Self-Check: PASSED

All 7 created files verified on disk. Both commit hashes (1846984, 6f1b882) verified in git log. 37 new tests pass. Full test suite (1556 tests) passes with zero regressions. TypeScript strict mode clean.

---
*Phase: 02-structured-logging*
*Completed: 2026-03-17*
