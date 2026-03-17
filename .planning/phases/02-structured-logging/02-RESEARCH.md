# Phase 2: Structured Logging - Research

**Researched:** 2026-03-17
**Domain:** Node.js structured logging, GCP Cloud Logging integration, client-side error telemetry, Sentry removal
**Confidence:** HIGH

## Summary

This phase replaces all `console.*` logging with Pino structured JSON, adds a client-side telemetry endpoint, wires error boundaries to the telemetry endpoint, replaces the Sentry-based `onRequestError` hook, and fully removes Sentry. The codebase has 56 `console.*` calls across 20 non-test files (not 44 as originally estimated -- the count has grown), 11 files importing `@sentry/nextjs`, and 6 Sentry-specific files to delete.

The standard stack is well-established: `pino` (v10.3.1) for structured logging, `@google-cloud/pino-logging-gcp-config` (v1.3.3) for GCP Cloud Logging compatibility, and `pino-pretty` (v13.1.3) for dev-time readability. The GCP config package uses a spread merge for the Pino options mixin, meaning custom options like `redact` and `base` are preserved -- only `messageKey`, `formatters`, and `timestamp` are overridden. This is verified from the package source code.

**Primary recommendation:** Single PR approach (per CONTEXT.md -- "clean cut on Sentry"). Create the logger singleton, telemetry client, and telemetry endpoint first, then migrate all console calls, update error boundaries, update instrumentation, and remove all Sentry artifacts in one cohesive phase.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `/api/telemetry` is unauthenticated -- captures errors from login, signup, and other pre-auth pages
- Rate-limited via Upstash (IP-based), same pattern as auth endpoints (~20 requests/minute/IP)
- Captures unhandled errors only: `window.onerror`, `unhandledrejection`, and React error boundary reports
- No explicit `reportError()` for handled errors
- Validated with Zod schema (type, message, stack, digest, url)
- Request-scoped child loggers with Cloud Trace correlation (`X-Cloud-Trace-Context` header extraction) included
- Audit tagging pattern (`{ audit: true }`) applied to auth/security log calls during console migration
- `DEPLOY_VERSION` env var in Pino's `serviceContext.version`
- Log level classification: error (LLM failures, Stripe webhook failures, DB errors, unexpected catch blocks), warn (failed auth, rate limits, email delivery), info (successful auth, note generation, webhooks, audit), debug (request metadata, pool stats)
- Full Sentry removal in this phase (not deferred to Phase 5)
- Error boundaries replace `Sentry.captureException()` with `reportErrorBoundary()` from new telemetry client
- `instrumentation.ts` replaces `Sentry.captureRequestError` with Pino logger
- `instrumentation-client.ts` deleted entirely, replaced by telemetry initialization elsewhere
- Full Sentry cleanup: delete config files, remove SDK, remove build wrapper, clean test mocks

### Claude's Discretion
- Client telemetry initialization location (root layout TelemetryProvider vs instrumentation-client.ts replacement vs other approach)
- Which specific files should keep `console.*` calls based on initialization order constraints
- Exact rate limit numbers for the telemetry endpoint
- PHI redaction path list in Pino config
- Pino-pretty formatting options for dev experience
- Test strategy for verifying logging behavior

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MON-01 | Server-side logging uses Pino structured logger with GCP JSON format in production and pino-pretty in dev | Logger singleton pattern (Standard Stack + Architecture Patterns), GCP config package API (verified from source) |
| MON-02 | All ~44 console.* calls across 18 production files replaced with structured Pino logging | Actual count is 56 calls across 20 files (verified via grep). Migration classification table provided |
| MON-03 | Client-side errors are captured via `/api/telemetry` endpoint and logged server-side through Pino | Telemetry endpoint pattern, sendBeacon pitfall (must use Blob or text/plain), rate limiting pattern |
| MON-04 | Error boundaries (global-error.tsx, ErrorBoundary.tsx) report to telemetry endpoint | All 4 error boundary files identified and integration pattern documented |
| MON-05 | `instrumentation.ts` `onRequestError` hook uses Pino instead of Sentry | Next.js 16 onRequestError API verified (full type signature documented), dynamic import pattern for Pino |
| MON-06 | Sentry fully removed (config files, SDK dependency, build args, test mocks) | All 11 Sentry-importing files catalogued, 6 files to delete, 5 files to modify |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| [pino](https://www.npmjs.com/package/pino) | 10.3.1 | Structured JSON logger | Fastest Node.js JSON logger (5-10x faster than Winston), zero-config stdout transport, built-in redaction |
| [@google-cloud/pino-logging-gcp-config](https://www.npmjs.com/package/@google-cloud/pino-logging-gcp-config) | 1.3.3 | GCP Cloud Logging format adapter | Official Google Cloud package. Maps Pino levels to GCP severity, adds `stack_trace` for Error Reporting, sequential `insertId`, timestamp format |
| [pino-pretty](https://www.npmjs.com/package/pino-pretty) | 13.1.3 | Human-readable dev output | Standard companion for Pino. Dev-only dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3.25.76 (already installed) | Telemetry payload validation | Validate incoming telemetry POST body |
| @upstash/ratelimit | ^2.0.8 (already installed) | Rate limit telemetry endpoint | Prevent abuse of unauthenticated endpoint |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pino | winston | Winston is 5-10x slower. Pino's JSON-first design is a better fit for Cloud Logging |
| @google-cloud/pino-logging-gcp-config | pino-cloud-logging (community) | Official Google package has better maintenance guarantees and correct Error Reporting format |
| pino-pretty (dev only) | Raw JSON in dev | Unreadable during development. pino-pretty is zero-cost in production |

**Installation:**
```bash
cd web && pnpm add pino @google-cloud/pino-logging-gcp-config && pnpm add -D pino-pretty
```

**Uninstallation (Sentry):**
```bash
cd web && pnpm remove @sentry/nextjs
```

## Architecture Patterns

### New Files
```
web/src/
├── server/lib/logger.ts            # Pino logger singleton (server-only)
├── lib/telemetry.ts                # Client-side error capture + reportErrorBoundary()
├── app/api/telemetry/route.ts      # Telemetry ingestion endpoint
└── instrumentation-client.ts       # Replaces Sentry init: calls initClientTelemetry()
```

### Deleted Files
```
web/
├── sentry.server.config.ts         # Sentry server init
├── sentry.edge.config.ts           # Sentry edge init
├── src/lib/sentry-sanitization.ts  # PHI redaction (replaced by Pino redact)
└── src/lib/sentry-sanitization.test.ts  # Tests for deleted file
```

### Pattern 1: Logger Singleton with GCP Config

**What:** Single Pino instance at `src/server/lib/logger.ts`, gated by `'server-only'` import. Production uses `createGcpLoggingPinoConfig` for GCP-formatted JSON; dev uses `pino-pretty` transport.

**When to use:** All server-side logging.

**Key finding (verified from source):** `createGcpLoggingPinoConfig` accepts a second `pinoLoggerOptionsMixin` parameter. It spreads this mixin into the returned config:
```typescript
// From @google-cloud/pino-logging-gcp-config source (pino_gcp_config.ts:189-199)
buidPinoLoggerOptions(pinoOptionsMixin?: pino.LoggerOptions): pino.LoggerOptions {
  const formattersMixin = pinoOptionsMixin?.formatters;
  return {
    ...pinoOptionsMixin,        // <-- redact, base, level all preserved
    messageKey: 'message',      // <-- overrides messageKey
    formatters: { ... },        // <-- merges formatters specially
    timestamp: () => ...,       // <-- overrides timestamp
  };
}
```

This means `redact` and `base: undefined` passed in the mixin **are preserved**. The MONITORING_SETUP.md pattern is correct.

**Example:**
```typescript
// src/server/lib/logger.ts
import 'server-only';
import pino from 'pino';
import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = isProduction
  ? pino(
      createGcpLoggingPinoConfig(
        {
          serviceContext: {
            service: 'flashnote-web',
            version: process.env.DEPLOY_VERSION || 'unknown',
          },
        },
        {
          level: process.env.LOG_LEVEL || 'info',
          base: undefined,  // Remove pid/hostname -- Cloud Run metadata provides these
          redact: {
            paths: [
              'patient', 'patientName', 'diagnosis', 'treatment',
              'noteContent', 'soapNote', 'quickNotes', 'patientContext',
              'dateOfBirth', 'medicalRecordNumber', 'req.body', 'res.body',
            ],
            censor: '[PHI_REDACTED]',
          },
        }
      )
    )
  : pino({
      level: process.env.LOG_LEVEL || 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'HH:MM:ss.l',
        },
      },
    });
```

### Pattern 2: Request-Scoped Child Loggers (Cloud Trace Correlation)

**What:** Child logger created from the `X-Cloud-Trace-Context` header. In production on Cloud Run, this header is injected by the GCP load balancer. Including the trace ID in log entries causes Cloud Logging to nest app logs under the request log entry.

**When to use:** Route Handlers and any code path with access to the request headers. Server Actions and DAL functions use the base logger (no direct request access in Server Actions).

**Key detail:** The GCP config package handles OpenTelemetry trace properties (`trace_id`, `span_id`) automatically via `formatLogObject()`, but Cloud Run's `X-Cloud-Trace-Context` header uses a different format (`TRACE_ID/SPAN_ID;o=TRACE_TRUE`). The child logger pattern manually extracts this.

**Where to create child loggers:** The most practical location is in the telemetry Route Handler (it has request access) and the webhook Route Handler. Server Actions do NOT have access to request headers directly -- they use the base logger with structured context fields (`source`, `userId`, `action`).

### Pattern 3: Client Telemetry with instrumentation-client.ts

**What:** Next.js `instrumentation-client.ts` is the designated place for client-side initialization that runs before React hydration. It runs once, early, and is the documented pattern for error tracking setup.

**Recommendation (Claude's Discretion):** Use `instrumentation-client.ts` as the initialization location for the telemetry client rather than a TelemetryProvider in root layout. Reasons:
1. Next.js docs explicitly show error tracking setup in this file
2. It runs before hydration -- catches errors during hydration itself
3. No React component tree dependency -- captures errors even if React fails to mount
4. The file already exists (currently initializing Sentry) -- this is a replacement, not a new concept
5. Avoids adding a client component wrapper to the server root layout

**Example:**
```typescript
// src/instrumentation-client.ts
import { initClientTelemetry } from '@/lib/telemetry';
initClientTelemetry();
```

### Pattern 4: sendBeacon Content-Type Pitfall

**What:** `navigator.sendBeacon()` with a plain string sends `Content-Type: text/plain`. Sending a `Blob` with type `application/json` triggers CORS preflight, which can fail in some browsers. The Route Handler must handle both.

**Implementation approach:** Use `sendBeacon` with a `Blob` of type `application/json` for same-origin requests (telemetry is same-origin, so CORS preflight is not an issue). Alternatively, send as `text/plain` and parse as JSON server-side.

**Recommendation:** Since `/api/telemetry` is same-origin, the Blob approach with `application/json` works. But the route handler should defensively try `request.json()` and fall back to `request.text()` + `JSON.parse()`.

### Pattern 5: Audit Tagging for Future Log Sink

**What:** Add `{ audit: true }` to log entries that correspond to HIPAA audit events. The Cloud Logging log sink that routes these to Cloud Storage is Phase 10, but the tags must be present from the start so no re-migration is needed.

**Where to apply:** Auth events (login, logout, login_failed), note generation completions, session creation/destruction, authorization failures.

### Anti-Patterns to Avoid
- **Passing `err.message` instead of `{ err }`:** Pino needs the full Error object to extract `stack_trace` for Cloud Error Reporting. Always use `logger.error({ err }, 'message')`, never `logger.error({ message: err.message }, '...')`.
- **Importing logger in client components:** The logger is `server-only`. Client components use the telemetry client (`src/lib/telemetry.ts`), not Pino.
- **Logging PHI in structured fields:** Even with Pino redaction as a safety net, the primary defense is never passing PHI fields to the logger. Redaction is defense-in-depth, not the primary guard.
- **Using `console.*` in new code after migration:** Tighten ESLint `no-console` rule to `error` (currently `warn`) after migration to prevent regression.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GCP severity mapping | Custom level-to-severity mapper | `@google-cloud/pino-logging-gcp-config` | Handles severity, timestamps, insertId, stack_trace, serviceContext in one package |
| Log redaction | Regex-based PHI scrubber | Pino's built-in `redact` (uses `fast-redact`) | ~2% overhead, battle-tested, path-based not regex-based |
| Error Reporting format | Custom `@type` field injection | GCP config package handles this | It sets `@type` to `type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent` automatically when `err` is an Error with a stack |
| Client error capture | Custom fetch-based reporter | `navigator.sendBeacon` with fetch fallback | sendBeacon survives page unloads, fetch with `keepalive` as fallback |

**Key insight:** The GCP config package does 90% of the heavy lifting -- severity mapping, Error Reporting integration, timestamps, and insertId. The only custom code needed is the logger singleton, redaction config, child logger creation, and the telemetry endpoint.

## Common Pitfalls

### Pitfall 1: Logger Import Timing in config.ts and db/index.ts
**What goes wrong:** `config.ts` runs at module evaluation time to validate env vars. If the logger imports `config.ts` (for `NODE_ENV`), and `config.ts` tries to use the logger for its error path, you get a circular dependency.
**Why it happens:** `config.ts` uses `console.error` + `process.exit(1)` for env validation failures. This runs during module initialization, before the logger singleton is ready.
**How to avoid:** `config.ts` and `redis.ts` should keep their `console.error` calls for fatal startup errors. The logger reads `process.env.NODE_ENV` directly (not from config.ts) to avoid the circular dependency. Similarly, `db/index.ts` pool error handler and shutdown handler should use the logger (imported after config is resolved), but `migrate.ts` is a CLI script and should keep `console.*`.
**Files that should keep `console.*`:**
- `src/server/db/config.ts:158` -- env validation failure (runs before logger is available; `process.exit(1)` follows immediately)
- `src/server/db/migrate.ts` -- CLI script, not server code (7 calls)
- `src/server/lib/redis.ts:19` -- fatal startup error with `process.exit(1)` (runs during module init, same issue as config.ts)

### Pitfall 2: Pino Transport in Production vs Dev
**What goes wrong:** Using `transport: { target: 'pino-pretty' }` in production causes Pino to spawn a worker thread, adding overhead and potentially breaking in some environments.
**Why it happens:** `pino-pretty` is a dev dependency. If the production code path accidentally uses the transport config, it will fail.
**How to avoid:** Hard branch on `NODE_ENV === 'production'` at the top level. Production path uses `createGcpLoggingPinoConfig` (no transport). Dev path uses `transport: { target: 'pino-pretty' }`. The `isProduction` check must use `process.env.NODE_ENV` directly, not the config import.

### Pitfall 3: Error Object Serialization
**What goes wrong:** Passing an Error as a direct property like `{ error: err }` loses the stack trace. Pino only serializes Error objects through its built-in serializer when the key is `err`.
**Why it happens:** Pino's default error serializer is bound to the `err` key specifically.
**How to avoid:** Always use `logger.error({ err: myError }, 'message')`, never `{ error: myError }` or `{ err: myError.message }`.

### Pitfall 4: GCP Config Package Async Initialization
**What goes wrong:** `createGcpLoggingPinoConfig` performs async auto-detection of `serviceContext` and `traceGoogleCloudProjectId` from the GCP environment. The logger is usable immediately, but `serviceContext` may not be populated on the first few log entries.
**Why it happens:** The constructor stores a `pendingInit` promise for async operations (detecting project ID and service name from GCP metadata).
**How to avoid:** Always provide `serviceContext` explicitly in the options (as the MONITORING_SETUP.md pattern does). This skips the async auto-detection entirely for the service name. For `traceGoogleCloudProjectId`, pass it explicitly via `traceGoogleCloudProjectId` option if `GOOGLE_CLOUD_PROJECT` is available, or rely on child loggers for trace correlation.

### Pitfall 5: Test Files Spying on console.error
**What goes wrong:** After migration, tests that `vi.spyOn(console, 'error')` to verify error logging will break because the code now uses `logger.error()` instead.
**Why it happens:** Tests were written against the `console.error` API.
**How to avoid:** Mock the logger module in tests. Create a shared mock pattern. Identified test files that spy on console.error:
- `src/server/services/email-devmode.test.ts` (console.log spies for dev email logging)
- `src/server/services/audit.test.ts` (console.error spy)
- `src/server/lib/get-session.test.ts` (console.error spy)
- `src/server/dal/usage.test.ts` (console.error spy)
- `src/components/ErrorBoundary.test.tsx` (Sentry.captureException mock)

### Pitfall 6: ESLint no-console Rule After Migration
**What goes wrong:** Current ESLint rule is `'no-console': ['warn', { allow: ['warn', 'error'] }]`. After migration, developers might still use `console.error` without realizing they should use the logger.
**Why it happens:** The rule allows `console.warn` and `console.error`.
**How to avoid:** After migration, tighten ESLint to `'no-console': 'error'` with exceptions only for the specific files that legitimately use console (config.ts, migrate.ts, redis.ts). Use ESLint inline comments in those files.

## Code Examples

### Logger Singleton (Production Path)
```typescript
// Source: Verified from @google-cloud/pino-logging-gcp-config source code
// The GCP config function spreads pinoOptionsMixin, preserving redact and base
import pino from 'pino';
import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config';

const logger = pino(
  createGcpLoggingPinoConfig(
    { serviceContext: { service: 'flashnote-web', version: process.env.DEPLOY_VERSION || 'unknown' } },
    {
      level: process.env.LOG_LEVEL || 'info',
      base: undefined,
      redact: { paths: ['patient', 'noteContent', /* ... */], censor: '[PHI_REDACTED]' },
    }
  )
);
```

### Cloud Trace Child Logger
```typescript
// Source: MONITORING_SETUP.md + GCP Cloud Logging structured logging docs
import { logger } from '@/server/lib/logger';
import type { NextRequest } from 'next/server';

export function createRequestLogger(request: NextRequest) {
  const traceHeader = request.headers.get('x-cloud-trace-context');
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;

  if (!traceHeader || !projectId) return logger;

  const [traceId, spanAndOptions] = traceHeader.split('/');
  const spanId = spanAndOptions?.split(';')[0];

  return logger.child({
    'logging.googleapis.com/trace': `projects/${projectId}/traces/${traceId}`,
    ...(spanId ? { 'logging.googleapis.com/spanId': spanId } : {}),
  });
}
```

### Telemetry Endpoint with Rate Limiting
```typescript
// Source: Pattern from existing rate-limit.ts + MONITORING_SETUP.md telemetry schema
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { logger } from '@/server/lib/logger';
import { checkRateLimit, telemetryRateLimit } from '@/server/lib/rate-limit';

const telemetrySchema = z.object({
  type: z.enum(['unhandled_error', 'unhandled_rejection', 'error_boundary']),
  message: z.string().max(1000),
  stack: z.string().max(5000).optional(),
  digest: z.string().max(100).optional(),
  url: z.string().max(500).optional(),
  componentStack: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  // Rate limit by IP (unauthenticated endpoint)
  const ip = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown';
  const { success } = await checkRateLimit(telemetryRateLimit, ip);
  if (!success) {
    return NextResponse.json({ ok: true }); // Silent rate limit -- don't leak info
  }

  try {
    const body = await request.json();
    const event = telemetrySchema.parse(body);
    logger.error({
      source: 'client',
      errorType: event.type,
      stack_trace: event.stack,  // Key name matches GCP Error Reporting expectation
      url: event.url,
      digest: event.digest,
    }, `[Client] ${event.message}`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Silent failure
  }
}
```

### onRequestError Hook (Pino)
```typescript
// Source: Next.js 16 instrumentation API docs
import { type Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const { logger } = await import('@/server/lib/logger');
  logger.error({
    err,
    source: 'next_server',
    errorType: context.routeType,  // 'render' | 'route' | 'action' | 'proxy'
    routePath: context.routePath,
    method: request.method,
    url: request.path,
  }, `[${context.routeType}] ${err.message}`);
};
```

### Console Migration Examples
```typescript
// BEFORE (current code in billing.ts)
console.error('Webhook handler failed:', { eventType: event.type, error: error });

// AFTER (structured Pino)
logger.error({ err: error, source: 'billing_webhook', errorType: 'webhook_handler_failed',
  eventType: event.type }, 'Webhook handler failed');

// BEFORE (current code in auth.ts)
console.error('Lockout service error during status check:', error);

// AFTER (structured Pino)
logger.error({ err: error, source: 'dal_auth', errorType: 'lockout_check_failed' },
  'Lockout service error during status check');

// BEFORE (email dev mode logging)
console.log('EMAIL SERVICE: Resend not configured, logging email:');
console.log(`Subject: ${subject}`);

// AFTER (structured Pino -- dev only path)
logger.info({ source: 'email_service', subject, to: '[redacted]' },
  'Dev mode: email would be sent');
```

### Error Boundary Integration
```typescript
// Source: MONITORING_SETUP.md pattern + Next.js error boundary convention
// In error.tsx, global-error.tsx, dashboard/error.tsx:
import { reportErrorBoundary } from '@/lib/telemetry';

useEffect(() => {
  reportErrorBoundary(error, error.digest);
}, [error]);

// In ErrorBoundary.tsx (class component):
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  reportErrorBoundary(error);
}
```

## Console Call Migration Classification

### Production Files -- Replace with Logger (13 files, 42 calls)

| File | Calls | Severity | Notes |
|------|-------|----------|-------|
| `server/services/billing.ts` | 9 | error/warn/info | Webhook processing, Stripe events |
| `server/services/email.ts` | 8 | info/error | Dev-mode logging (7 info), send failure (1 error) |
| `server/db/index.ts` | 5 | error/warn | Pool error handler, shutdown handler |
| `server/services/auth.ts` | 4 | error | Lockout service errors, verification email |
| `actions/auth.ts` | 3 | error | Session deletion, token/email failures |
| `actions/notes.ts` | 2 | warn/error | Suspicious patterns, generation failure |
| `actions/billing.ts` | 2 | error | Checkout/portal failures |
| `server/services/llm/gemini-provider.ts` | 2 | error | HTTP errors, API errors |
| `server/services/llm/claude-provider.ts` | 2 | error | HTTP errors, API errors |
| `server/lib/get-session.ts` | 2 | error | Session refresh, session validation |
| `server/services/audit.ts` | 1 | error | Audit log failure |
| `server/dal/health.ts` | 1 | error | DB health check |
| `server/dal/usage.ts` | 1 | error | Usage tracking failure |
| `server/services/llm/provider.ts` | 1 | warn | LLM retry attempt |
| `app/api/cleanup/webhook-events/route.ts` | 2 | info/error | Cleanup success/failure |

### Production Files -- Replace with Telemetry (4 files, 4 calls)

| File | Calls | Change |
|------|-------|--------|
| `app/error.tsx` | 1 (console.error + Sentry) | Replace with `reportErrorBoundary()` |
| `app/global-error.tsx` | 0 (Sentry only) | Replace Sentry with `reportErrorBoundary()` |
| `app/dashboard/error.tsx` | 1 (console.error) | Replace with `reportErrorBoundary()` |
| `components/ErrorBoundary.tsx` | 0 (Sentry only) | Replace Sentry with `reportErrorBoundary()` |

### Files That Keep console.* (3 files, 9 calls)

| File | Calls | Reason |
|------|-------|--------|
| `server/db/config.ts` | 1 | Runs at module init before logger exists; followed by `process.exit(1)` |
| `server/db/migrate.ts` | 7 | CLI script, not server code |
| `server/lib/redis.ts` | 1 | Fatal startup error with `process.exit(1)`; runs during module init |

### Test Files Requiring Updates (5 files)

| File | Change Needed |
|------|---------------|
| `server/services/email-devmode.test.ts` | Replace `console.log` spies with logger mock |
| `server/services/audit.test.ts` | Replace `console.error` spy with logger mock |
| `server/lib/get-session.test.ts` | Replace `console.error` spy with logger mock |
| `server/dal/usage.test.ts` | Replace `console.error` spy with logger mock |
| `components/ErrorBoundary.test.tsx` | Replace `Sentry.captureException` mock with `reportErrorBoundary` mock |

### Sentry Removal (11 files)

| Action | File |
|--------|------|
| DELETE | `web/sentry.server.config.ts` |
| DELETE | `web/sentry.edge.config.ts` |
| DELETE | `web/src/lib/sentry-sanitization.ts` |
| DELETE | `web/src/lib/sentry-sanitization.test.ts` |
| REWRITE | `web/src/instrumentation.ts` (remove Sentry, add Pino onRequestError) |
| REWRITE | `web/src/instrumentation-client.ts` (replace Sentry init with telemetry init) |
| MODIFY | `web/next.config.ts` (remove `withSentryConfig` wrapper) |
| MODIFY | `web/src/test/setup.ts` (remove `@sentry/nextjs` mock) |
| MODIFY | `web/src/app/error.tsx` (Sentry.captureException -> reportErrorBoundary) |
| MODIFY | `web/src/app/global-error.tsx` (Sentry.captureException -> reportErrorBoundary) |
| MODIFY | `web/src/components/ErrorBoundary.tsx` (Sentry.captureException -> reportErrorBoundary) |
| MODIFY | `web/package.json` (remove @sentry/nextjs) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@sentry/nextjs` + Sentry DSN | Pino + Cloud Logging + Cloud Error Reporting | Decision: March 2026 | Eliminates external vendor, BAA requirement, $26/mo cost |
| `console.*` throughout codebase | Structured JSON via Pino | This phase | Enables Cloud Logging queries, Error Reporting, audit retention |
| Next.js instrumentation-client.ts for Sentry SDK | instrumentation-client.ts for telemetry init | This phase | Same file convention, different initialization code |
| `@sentry/nextjs` `captureRequestError` | Direct Pino logging in `onRequestError` | This phase | Simpler, no external dependency |
| Sentry breadcrumbs + session replay | None (server-side logging covers 95%+ of errors) | This phase | Known tradeoff documented in MONITORING_SETUP.md |

**Deprecated/outdated:**
- `@sentry/nextjs` v10.38.0: Being removed entirely. No coexistence period.
- `sentry-sanitization.ts`: PHI field patterns move to Pino `redact.paths` config. The regex-based approach is replaced by path-based redaction.

## Open Questions

1. **`db/index.ts` pool error handler and shutdown handler**
   - What we know: These run after module initialization, so the logger IS available. They use callbacks (`db.on('error', ...)` and `process.on('SIGTERM', ...)`).
   - What's unclear: Whether importing the logger singleton in `db/index.ts` creates any circular dependency issues since the logger itself reads `process.env.NODE_ENV`.
   - Recommendation: The logger reads `process.env.NODE_ENV` directly (not via config.ts), so there is no circular dependency. Use `logger` for pool error handler and shutdown handler. If any edge case emerges during implementation, fall back to `console.error` for just those two handlers.

2. **Email dev-mode logging format**
   - What we know: Currently prints a decorated block (separators, headers) via multiple `console.log` calls for dev readability.
   - What's unclear: Whether a single structured `logger.info` call with all fields provides the same dev experience via pino-pretty.
   - Recommendation: Replace with a single `logger.info({ source: 'email_service', subject, to: '[redacted]', body: text }, 'Dev mode: email logged (Resend not configured)')`. In pino-pretty mode, this will display as a readable line with the message. For full body inspection, the developer can look at the JSON. This is a slight UX downgrade in dev but avoids 7 separate log calls.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4.0.18 + React Testing Library v16.3.2 + jsdom |
| Config file | `web/vitest.config.ts` |
| Quick run command | `cd web && pnpm test` |
| Full suite command | `cd web && pnpm test:coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MON-01 | Logger singleton produces structured JSON in prod, pino-pretty in dev | unit | `cd web && pnpm vitest run src/server/lib/logger.test.ts -x` | Wave 0 |
| MON-02 | No `console.*` calls remain in production code (except exempted files) | lint | `cd web && pnpm lint` (after tightening no-console rule) | Existing ESLint |
| MON-03 | Telemetry endpoint validates input, rate limits, and logs through Pino | unit | `cd web && pnpm vitest run src/app/api/telemetry/route.test.ts -x` | Wave 0 |
| MON-04 | Error boundaries call reportErrorBoundary | unit | `cd web && pnpm vitest run src/components/ErrorBoundary.test.tsx -x` | Existing (needs update) |
| MON-05 | onRequestError logs through Pino | unit | `cd web && pnpm vitest run src/instrumentation.test.ts -x` | Wave 0 |
| MON-06 | No @sentry/nextjs imports remain, build succeeds without Sentry | build + grep | `cd web && pnpm build` | N/A (build verification) |

### Sampling Rate
- **Per task commit:** `cd web && pnpm test`
- **Per wave merge:** `cd web && pnpm test:coverage`
- **Phase gate:** Full coverage suite green + `pnpm build` succeeds + zero `@sentry/nextjs` imports

### Wave 0 Gaps
- [ ] `src/server/lib/logger.test.ts` -- unit tests for logger singleton (prod/dev branch, redaction, child logger)
- [ ] `src/app/api/telemetry/route.test.ts` -- tests for telemetry endpoint (validation, rate limiting, Pino integration)
- [ ] `src/lib/telemetry.test.ts` -- tests for client telemetry functions (sendTelemetry, initClientTelemetry, reportErrorBoundary)
- [ ] `src/instrumentation.test.ts` -- test for onRequestError hook
- [ ] Update `src/components/ErrorBoundary.test.tsx` -- replace Sentry mock with telemetry mock
- [ ] Update `src/server/services/email-devmode.test.ts` -- replace console.log spies with logger mock
- [ ] Update `src/server/services/audit.test.ts` -- replace console.error spy with logger mock
- [ ] Update `src/server/lib/get-session.test.ts` -- replace console.error spy with logger mock
- [ ] Update `src/server/dal/usage.test.ts` -- replace console.error spy with logger mock
- [ ] Update `src/test/setup.ts` -- remove @sentry/nextjs mock
- [ ] Test helper: shared logger mock pattern (reusable across test files)

## Discretion Recommendations

### Client Telemetry Initialization: `instrumentation-client.ts`
Use `instrumentation-client.ts` (see Pattern 3 above for rationale). This is the documented Next.js pattern for client-side error tracking initialization.

### Files to Keep `console.*`: config.ts, migrate.ts, redis.ts
See Pitfall 1 for rationale. These 3 files (9 total calls) should keep `console.*` with inline ESLint disable comments.

### Telemetry Rate Limit: 20 requests per minute per IP
Matches the user's stated preference (~20 requests/minute/IP). Add a new `telemetryRateLimit` entry to `src/server/lib/rate-limit.ts` using `createLimiter(20, '1 m', 'telemetry')`.

### PHI Redaction Paths
Transfer from `sentry-sanitization.ts` PHI patterns to Pino `redact.paths`. The Pino approach is path-based (not regex), so exact field names are needed:
```
patient, patientName, patientData, patientContext,
diagnosis, treatment, noteContent, soapNote,
quickNotes, shorthand, dateOfBirth, medicalRecordNumber,
req.body, res.body
```
Note: Pino redaction is path-based, not regex-based. It cannot match patterns like `/patient/i`. This means `PATIENT` (uppercase) or `patient_id` won't be caught. This is acceptable because:
1. The primary defense is never passing PHI to the logger
2. All log call sites are controlled by us -- we don't log arbitrary user-supplied objects
3. The redaction is defense-in-depth only

### Pino-Pretty Dev Formatting
```typescript
transport: {
  target: 'pino-pretty',
  options: {
    colorize: true,
    ignore: 'pid,hostname',
    translateTime: 'HH:MM:ss.l',
  },
}
```
This provides timestamps, colorized severity, and message without noise from pid/hostname.

### Test Strategy: Mock the Logger Module
Create a reusable mock pattern for the logger:
```typescript
// In test files that verify logging behavior:
vi.mock('@/server/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));
```
For the telemetry client tests, mock `fetch` and `navigator.sendBeacon`.

## Sources

### Primary (HIGH confidence)
- [@google-cloud/pino-logging-gcp-config source code](https://github.com/GoogleCloudPlatform/cloud-solutions/tree/main/projects/pino-logging-gcp-config) -- full source reviewed via GitHub API, confirmed spread merge behavior for `pinoOptionsMixin`
- [Next.js 16 instrumentation.ts docs](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation) -- full `onRequestError` type signature with `routeType: 'render' | 'route' | 'action' | 'proxy'`
- [Next.js 16 instrumentation-client.ts docs](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client) -- confirmed as proper location for client-side error tracking init
- [Pino redaction docs](https://github.com/pinojs/pino/blob/main/docs/redaction.md) -- path syntax, censor options, performance characteristics
- [GCP pino-logging-gcp-config official docs](https://googlecloudplatform.github.io/cloud-solutions/pino-logging-gcp-config/) -- API reference
- Codebase audit: all 56 console.* calls in 20 files, all 11 Sentry-importing files catalogued

### Secondary (MEDIUM confidence)
- [pino npm package](https://www.npmjs.com/package/pino) -- version 10.3.1 confirmed
- [@google-cloud/pino-logging-gcp-config npm](https://www.npmjs.com/package/@google-cloud/pino-logging-gcp-config) -- version 1.3.3 confirmed
- [pino-pretty npm package](https://www.npmjs.com/package/pino-pretty) -- version 13.1.3 confirmed
- [MDN sendBeacon](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) -- CORS behavior with Blob content types
- `docs/planning/MONITORING_SETUP.md` -- project-specific monitoring architecture and code templates

### Tertiary (LOW confidence)
- None -- all findings verified against primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- versions verified on npm, GCP config source code reviewed
- Architecture: HIGH -- patterns verified against Next.js 16 docs and GCP config source
- Pitfalls: HIGH -- derived from source code analysis and codebase audit
- Migration scope: HIGH -- exact file/call counts from grep, all Sentry imports catalogued

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable stack, 30-day validity)
