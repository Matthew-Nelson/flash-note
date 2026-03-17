# Deferred Items - Phase 02: Structured Logging

## Pre-existing Lint Errors (discovered during 02-03)

These errors existed before plan 02-03 and are not caused by any Phase 02 changes.

1. **web/src/lib/telemetry.ts:68** - `Unsafe member access .stack on an 'any' value` (@typescript-eslint/no-unsafe-member-access)
2. **web/src/lib/telemetry.ts:74** - `Unsafe assignment of an 'any' value` (@typescript-eslint/no-unsafe-assignment)
3. **web/src/server/lib/logger.test.ts:40** - `Unsafe argument of type 'any' assigned to a parameter of type 'string'` (@typescript-eslint/no-unsafe-argument)
4. **web/src/server/lib/logger.test.ts:40** - `Unsafe call of an 'any' typed value` (@typescript-eslint/no-unsafe-call)

**Recommendation:** Fix as part of a future cleanup pass. The telemetry.ts errors need proper typing for the `reason` variable in the unhandledrejection handler. The logger.test.ts errors need proper typing for test assertions.
