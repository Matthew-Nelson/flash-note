# Phase 2: Structured Logging - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace all server-side `console.*` logging with Pino structured JSON, add a client-side telemetry endpoint for browser errors, wire error boundaries to the telemetry endpoint, replace the `onRequestError` instrumentation hook, and fully remove Sentry (SDK, config files, test mocks). This establishes the logging foundation required for HIPAA audit compliance and GCP-native observability.

Scope expanded from original plan: Sentry removal (originally Phase 5 / MON-06) is now included in Phase 2 since all Sentry call sites are being replaced anyway.

</domain>

<decisions>
## Implementation Decisions

### Client telemetry endpoint
- `/api/telemetry` is unauthenticated -- captures errors from login, signup, and other pre-auth pages where users can't report bugs themselves
- Rate-limited via Upstash (IP-based), same pattern as auth endpoints (~20 requests/minute/IP)
- Captures unhandled errors only: `window.onerror`, `unhandledrejection`, and React error boundary reports
- No explicit `reportError()` for handled errors -- if it's caught and handled, it doesn't need telemetry
- Validated with Zod schema (type, message, stack, digest, url -- as specified in MONITORING_SETUP.md)

### Phase scope (what's included beyond core)
- Request-scoped child loggers with Cloud Trace correlation (`X-Cloud-Trace-Context` header extraction) -- included so production logs are correlated by request from day one
- Audit tagging pattern (`{ audit: true }`) applied to auth/security log calls during console migration -- the log sink that routes these to Cloud Storage is Phase 10, but tags must be present from the start
- `DEPLOY_VERSION` env var in Pino's `serviceContext.version` -- the actual env var gets set in Phase 3 (Pipeline & Provisioning), but the logger reads it immediately when available
- Files that should keep `console.*` calls: Claude's discretion based on initialization order (e.g., `config.ts` env validation runs before Pino initializes, `migrate.ts` is a CLI script)

### Log level classification
- **error**: LLM/AI service failures (Gemini API errors, timeouts), Stripe webhook processing failures, database errors, unexpected catch blocks. These trigger Cloud Error Reporting.
- **warn**: Failed auth attempts (wrong password, expired session), rate limit hits, email delivery failures. Expected operational events that shouldn't trigger error alerts but remain visible.
- **info**: Successful auth events (login, logout), note generation completions, webhook processing successes, audit-tagged events.
- **debug**: Request/response metadata, pool stats, development diagnostics. Off in production by default.

### Sentry removal (full -- not deferred to Phase 5)
- Error boundaries (`error.tsx`, `global-error.tsx`, `dashboard/error.tsx`) replace `Sentry.captureException()` with `reportErrorBoundary()` from the new telemetry client
- `instrumentation.ts` replaces `Sentry.captureRequestError` with Pino logger in `onRequestError` hook (MON-05)
- `instrumentation-client.ts` (Sentry browser init + `onRouterTransitionStart`) is deleted entirely
- Full Sentry cleanup: delete `sentry.server.config.ts`, `sentry.edge.config.ts`, `sentry-sanitization.ts`, remove `withSentryConfig` from `next.config.ts`, uninstall `@sentry/nextjs`, remove Sentry DSN env vars, clean up Sentry mock in test setup
- MON-06 requirement is now fulfilled by Phase 2, not Phase 5. Roadmap should be updated.

### Claude's Discretion
- Client telemetry initialization location (root layout TelemetryProvider vs instrumentation-client.ts replacement vs other approach)
- Which specific files should keep `console.*` calls based on initialization order constraints
- Exact rate limit numbers for the telemetry endpoint
- PHI redaction path list in Pino config (MONITORING_SETUP.md has a baseline list)
- Pino-pretty formatting options for dev experience
- Test strategy for verifying logging behavior (mock Pino vs capture stdout vs other approach)

</decisions>

<specifics>
## Specific Ideas

- MONITORING_SETUP.md (`docs/planning/MONITORING_SETUP.md`) contains detailed code templates for the logger singleton, telemetry endpoint, client-side error handlers, and instrumentation hook -- use as reference but not as copy-paste (adapt to actual codebase state)
- The user wants a clean cut on Sentry -- no coexistence period. Replace and remove in one phase rather than the originally-planned two-phase approach.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@upstash/ratelimit` + `@upstash/redis`: Already configured for auth rate limiting. Telemetry endpoint can reuse the same Redis client and rate limit pattern from `src/server/lib/rate-limit.ts`
- `src/server/db/config.ts`: Env var validation pattern via Zod. New env vars (LOG_LEVEL, DEPLOY_VERSION) should follow the same pattern
- `src/lib/sentry-sanitization.ts`: PHI field list (patient names, note content, diagnosis, etc.) -- transfer these as Pino redaction paths before deleting this file

### Established Patterns
- Singleton modules at `src/server/lib/` (redis.ts, rate-limit.ts) -- logger.ts follows this pattern
- `'server-only'` import as first line in all `src/server/` files -- logger.ts must include this
- Server Actions return discriminated unions, never throw for expected errors -- logging calls go in catch blocks and service functions, not in actions themselves
- ESLint `no-console: warn` rule allows `console.warn` and `console.error` -- after migration, can tighten this to `error` since all logging should go through Pino

### Integration Points
- `instrumentation.ts`: Currently imports Sentry. Will import Pino logger instead for `onRequestError`
- `instrumentation-client.ts`: Currently initializes Sentry browser SDK. Will be deleted; replaced by telemetry initialization elsewhere
- Error boundaries (`error.tsx`, `global-error.tsx`, `dashboard/error.tsx`): Currently call `Sentry.captureException()`. Will call `reportErrorBoundary()` instead
- `next.config.ts`: Currently wrapped with `withSentryConfig()`. Will remove the wrapper
- `test/setup.ts`: Currently mocks `@sentry/nextjs`. Will remove the mock
- 68 `console.*` calls across 24 files (18 production + 6 test): Migration targets

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 02-structured-logging*
*Context gathered: 2026-03-17*
