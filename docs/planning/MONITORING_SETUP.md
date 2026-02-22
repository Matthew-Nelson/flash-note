# FlashNote Monitoring Setup Plan

> **Status: STRATEGY REVISION — GCP-Native Monitoring**
>
> This document replaces the previous Sentry + Axiom monitoring plan with a consolidated Google Cloud-native approach. See [Decision Record](#decision-record-consolidate-on-gcp-native-monitoring) for rationale.
>
> **Completed (prior work):**
> - [x] Sentry integration across backend, extension, and web (to be removed during migration)
> - [x] Logging gaps audit — 12 gaps identified and fixed (see `docs/archive/SENTRY_LOGGING_GAPS.md`)
>
> **New plan:**
> - [ ] Pino structured logger utility
> - [ ] Replace `Sentry.captureException` calls with structured logging
> - [ ] Remove `@sentry/node`, `@sentry/nextjs`, `@sentry/browser` dependencies
> - [ ] Next.js `instrumentation.ts` — `onRequestError` hook for server-side error capture
> - [ ] Client-side telemetry endpoint (`/api/telemetry`)
> - [ ] Cloud Logging log sink for HIPAA audit retention (6 years)
> - [ ] Cloud Monitoring alert policies
> - [ ] UptimeRobot monitors
> - [ ] GitHub Dependabot configuration

---

## Decision Record: Consolidate on GCP-Native Monitoring

### Context

FlashNote is deploying on Google Cloud (Cloud Run + Cloud SQL + Vertex AI) with a single Google Cloud BAA covering all services. The previous monitoring plan used Sentry for error tracking and Axiom for log aggregation — both external vendors requiring separate compliance relationships.

### Decision

Replace Sentry and Axiom with Google Cloud's native observability stack: **Cloud Logging + Cloud Error Reporting + Cloud Monitoring**. These are already covered under the GCP BAA at no additional cost.

### Why

**1. Single BAA, zero additional compliance overhead.**

Every external monitoring vendor that could receive error data (which may inadvertently contain PHI despite sanitization) requires its own BAA. Managing multiple BAAs means annual vendor risk assessments, compliance documentation, and contractual overhead.

| Approach | BAAs Required | Vendors to Manage |
|----------|--------------|-------------------|
| GCP-native | 1 (Google Cloud) | 1 |
| Sentry + Axiom + GCP | 3 | 3 |

The Google Cloud BAA we are already signing for Cloud Run, Cloud SQL, and Vertex AI covers Cloud Logging, Cloud Error Reporting, and Cloud Monitoring at no extra cost.

**2. Cost elimination.**

| Service | Free Tier Cost | HIPAA-Ready Cost |
|---------|---------------|-----------------|
| Sentry | $0 (no BAA) | $26/mo (Team plan w/ BAA) |
| Axiom | $0 (no BAA) | $225+/mo (mandatory RBAC + Audit Log + SSO add-ons) |
| **GCP Logging + Error Reporting** | **$0 (50 GB/mo free, BAA included)** | **$0** |

Sentry's free tier has no BAA — meaning we have zero contractual protection if PHI leaks through our sanitization filters. To be HIPAA-compliant with Sentry requires the $26/mo Team plan. Axiom's HIPAA-ready setup requires $225+/mo in mandatory add-ons plus an undisclosed minimum annual spend.

GCP's observability tools are free within the 50 GB/month ingestion tier (our backend will generate single-digit GB/month) and are covered under the BAA we're already signing.

**3. Cloud Run integration is automatic.**

Cloud Run captures all stdout/stderr and sends it to Cloud Logging with zero configuration — no SDK, no API keys, no transport setup. Cloud Error Reporting automatically parses stack traces from Cloud Logging entries, groups them by root cause, and provides alerting. This is less code to write and maintain than Sentry's per-component integration.

**4. The architecture shift makes this the right time.**

Moving to a full Next.js DAL architecture shifts ~95% of application logic server-side (Server Components, Server Actions, Route Handlers, DAL functions). All server-side code runs on Cloud Run where Cloud Logging captures everything automatically. The client-side surface area (React hydration, UI interactions) becomes minimal — a simple telemetry endpoint handles the remaining browser errors.

**5. Reduced vendor surface area.**

Fewer external services means fewer potential failure points, fewer credentials to manage, fewer dependency updates, and fewer third-party data processors in our HIPAA compliance documentation.

### What We Lose

Being explicit about tradeoffs:

| Capability | Sentry | GCP-Native Replacement | Impact |
|---|---|---|---|
| Server-side error tracking | Yes | Cloud Error Reporting (automatic, free) | **No loss** |
| Client-side error capture | Yes | Telemetry endpoint → Cloud Logging | **No loss** (small code investment) |
| Source map deobfuscation | Yes | Not available | **Real loss**, mitigated by DAL architecture (most errors are server-side with full stack traces) |
| Error grouping/dedup | Excellent | Cloud Error Reporting (decent, not as polished) | **Minor loss** |
| Breadcrumbs (user action trail) | Yes | Not available | **Loss**, but questionable value — we don't use Session Replay (PHI risk) and server-side request context provides equivalent debugging value |
| Release tracking | Yes | Tag logs with deploy version via Pino `base` config | **No loss** |
| Alerting | Yes | Cloud Monitoring alert policies | **No loss** |

### When to Revisit

Re-evaluate this decision if:
- Client-side error volume becomes significant and source map deobfuscation is needed for debugging
- Cloud Error Reporting's grouping quality proves insufficient for triage
- We need advanced anomaly detection or log analysis beyond Cloud Logging's query capabilities
- Team size grows beyond solo operation and we need collaborative triage workflows

At that point, consider Sentry Team ($26/mo with BAA) for client-side only, or Grafana Cloud Pro ($19/mo, BAA status TBD) for advanced dashboarding.

---

## Monitoring Architecture

### Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Google Cloud                          │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Cloud Run (Next.js)                  │   │
│  │                                                   │   │
│  │  Server Components ─┐                             │   │
│  │  Server Actions ────┤                             │   │
│  │  Route Handlers ────┼── Pino → stdout ──┐        │   │
│  │  Middleware ─────────┤                   │        │   │
│  │  DAL Functions ─────┘                   │        │   │
│  │                                          │        │   │
│  │  /api/telemetry ◄── browser errors ──────┤        │   │
│  └──────────────────────────────────────────┼────────┘   │
│                                              │            │
│                                              ▼            │
│                                     ┌────────────────┐   │
│                                     │ Cloud Logging  │   │
│                                     └───────┬────────┘   │
│                                             │             │
│                        ┌────────────────────┼──────────┐  │
│                        │                    │          │  │
│                        ▼                    ▼          ▼  │
│              ┌──────────────┐    ┌──────────────┐  ┌─────────────┐
│              │ Cloud Error  │    │    Cloud      │  │   Cloud     │
│              │ Reporting    │    │  Monitoring   │  │  Storage    │
│              │ (auto-group) │    │  (alerts)     │  │  (6yr HIPAA │
│              └──────────────┘    └──────────────┘  │   retention)│
│                                                     └─────────────┘
└─────────────────────────────────────────────────────────┘

  Browser (Client Components)
  ┌────────────────────────────┐
  │  Global error handlers     │
  │  React Error Boundaries    │
  │         │                  │
  │         ▼                  │
  │  POST /api/telemetry ──────┼──► Cloud Run ──► Cloud Logging
  └────────────────────────────┘
```

### What Runs Where

| Layer | Runs On | Logging Method | Cloud Logging? |
|---|---|---|---|
| Server Components | Cloud Run | Pino → stdout | Yes (automatic) |
| Server Actions | Cloud Run | Pino → stdout | Yes (automatic) |
| Route Handlers | Cloud Run | Pino → stdout | Yes (automatic) |
| Next.js Middleware | Cloud Run | Pino → stdout | Yes (automatic) |
| DAL functions | Cloud Run | Pino → stdout | Yes (automatic) |
| Client Components | Browser | POST `/api/telemetry` | Yes (via endpoint) |

---

## Structured Logging with Pino

### Why Pino

- **Fastest Node.js JSON logger** — 5-10x faster than Winston, negligible overhead
- **Structured JSON output** — Cloud Logging natively parses JSON from stdout
- **Child loggers** — attach request context (trace ID, user ID) without passing logger through every function
- **Redaction** — built-in path-based redaction for PHI protection
- **Google Cloud integration** — `@google-cloud/pino-logging-gcp-config` maps Pino output to Cloud Logging's expected field format (severity levels, trace correlation, Error Reporting `@type` field)
- **Zero transport configuration** — writes to stdout, Cloud Run handles the rest

### Dependencies

```bash
pnpm add pino @google-cloud/pino-logging-gcp-config
pnpm add -D pino-pretty  # local dev only — human-readable output
```

### Logger Utility

```typescript
// src/lib/logger.ts
import pino from 'pino';
import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config';

const isProduction = process.env.NODE_ENV === 'production';

const SERVICE_NAME = 'flashnote-api';
const SERVICE_VERSION = process.env.DEPLOY_VERSION || 'local';

// In production (Cloud Run): structured JSON for Cloud Logging
// In development: human-readable pretty-printed output
const logger = isProduction
  ? pino(
      createGcpLoggingPinoConfig(
        {
          serviceContext: {
            service: SERVICE_NAME,
            version: SERVICE_VERSION,
          },
        },
        {
          level: process.env.LOG_LEVEL || 'info',
          // Remove pid/hostname — Cloud Run provides these in metadata
          base: undefined,
          // Redact paths that could contain PHI
          redact: {
            paths: [
              'patient',
              'patientName',
              'diagnosis',
              'treatment',
              'noteContent',
              'soapNote',
              'quickNotes',
              'patientContext',
              'dateOfBirth',
              'medicalRecordNumber',
              'req.body',
              'res.body',
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

export { logger };
```

### Request-Scoped Child Loggers

Cloud Run injects an `X-Cloud-Trace-Context` header on every request. Including the trace ID in log entries causes Cloud Logging to nest application logs under the corresponding request log — critical for debugging.

```typescript
// src/middleware/request-logger.ts
import { type NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

export function createRequestLogger(req: NextRequest) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const traceHeader = req.headers.get('x-cloud-trace-context');

  const bindings: Record<string, unknown> = {};

  if (traceHeader && projectId) {
    const [traceId, spanAndOptions] = traceHeader.split('/');
    const [spanId] = (spanAndOptions || '').split(';');
    bindings['logging.googleapis.com/trace'] =
      `projects/${projectId}/traces/${traceId}`;
    if (spanId) {
      bindings['logging.googleapis.com/spanId'] = spanId;
    }
  }

  return logger.child(bindings);
}
```

Usage in Server Actions and Route Handlers:

```typescript
// In a Server Action or Route Handler
import { logger } from '@/lib/logger';

export async function generateNote(formData: FormData) {
  // For server actions without direct request access, use the base logger
  logger.info({ userId: user.id, action: 'generate_note' }, 'Note generation started');

  try {
    const result = await llmService.generate(prompt);
    logger.info(
      { userId: user.id, durationMs: elapsed, tokenCount: result.tokens },
      'Note generation completed'
    );
    return result;
  } catch (err) {
    logger.error(
      { err, userId: user.id, source: 'ai_service', errorType: 'generation_failed' },
      'Note generation failed'
    );
    throw err;
  }
}
```

### How Cloud Error Reporting Picks Up Errors

When Pino logs an error with a stack trace, the `@google-cloud/pino-logging-gcp-config` package formats it so Cloud Error Reporting automatically detects and groups it. Specifically:

1. It sets the `@type` field to `type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent`
2. It formats the stack trace in the `stack_trace` field
3. It includes `serviceContext` for grouping by service/version

No additional configuration needed — Cloud Error Reporting is always on and free.

```typescript
// This automatically appears in Cloud Error Reporting, grouped by stack trace
logger.error({ err: new Error('Database connection timeout') }, 'Connection failed');

// Output (what Cloud Logging receives):
// {
//   "severity": "ERROR",
//   "@type": "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent",
//   "message": "Connection failed",
//   "stack_trace": "Error: Database connection timeout\n    at connectDB (src/db.ts:42)...",
//   "serviceContext": { "service": "flashnote-api", "version": "1.0.0" }
// }
```

---

## Client-Side Error Capture

Browser errors cannot reach Cloud Logging directly. A lightweight telemetry endpoint proxies them through Cloud Run.

### Telemetry Route Handler

```typescript
// src/app/api/telemetry/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const telemetrySchema = z.object({
  type: z.enum(['unhandled_error', 'unhandled_rejection', 'error_boundary']),
  message: z.string().max(1000),
  stack: z.string().max(5000).optional(),
  digest: z.string().max(100).optional(),
  url: z.string().max(500).optional(),
  componentStack: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = telemetrySchema.parse(body);

    // Log as error so Cloud Error Reporting picks it up
    logger.error(
      {
        source: 'client',
        errorType: event.type,
        stack_trace: event.stack,
        url: event.url,
        digest: event.digest,
      },
      `[Client] ${event.message}`
    );

    return NextResponse.json({ ok: true });
  } catch {
    // Don't leak validation errors — telemetry failures are silent
    return NextResponse.json({ ok: true });
  }
}
```

### Client-Side Global Error Handlers

```typescript
// src/lib/telemetry.ts
const TELEMETRY_URL = '/api/telemetry';

function sendTelemetry(payload: Record<string, unknown>) {
  // Fire-and-forget — never block the UI for telemetry
  try {
    const body = JSON.stringify(payload);
    // Prefer sendBeacon for reliability during page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon(TELEMETRY_URL, body);
    } else {
      fetch(TELEMETRY_URL, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Telemetry must never throw
  }
}

export function initClientTelemetry() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    sendTelemetry({
      type: 'unhandled_error',
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
      url: window.location.pathname,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    sendTelemetry({
      type: 'unhandled_rejection',
      message: String(event.reason?.message || event.reason || 'Unknown rejection'),
      stack: event.reason?.stack,
      url: window.location.pathname,
    });
  });
}

// For use in React Error Boundaries
export function reportErrorBoundary(error: Error, digest?: string) {
  sendTelemetry({
    type: 'error_boundary',
    message: error.message,
    stack: error.stack,
    digest,
    url: typeof window !== 'undefined' ? window.location.pathname : undefined,
  });
}
```

### Next.js Error Boundary Integration

```typescript
// src/app/global-error.tsx
'use client';

import { useEffect } from 'react';
import { reportErrorBoundary } from '@/lib/telemetry';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportErrorBoundary(error, error.digest);
  }, [error]);

  return (
    <html>
      <body>
        <h2>Something went wrong.</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
```

### Next.js Instrumentation Hook

The `onRequestError` hook in `instrumentation.ts` captures errors from Server Components, Server Actions, Route Handlers, and middleware — all server-side, all written to stdout for Cloud Logging.

```typescript
// src/instrumentation.ts
import { type Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  // Dynamic import to avoid loading Pino during build
  const { logger } = await import('@/lib/logger');

  logger.error(
    {
      err,
      source: 'next_server',
      errorType: context.routeType, // 'page' | 'route' | 'middleware'
      routePath: context.routePath,
      method: request.method,
      url: request.url,
    },
    `[${context.routeType}] ${err.message}`
  );
};
```

---

## Sentry Migration Plan

### Phase 1: Add Pino Logger

Add the Pino logger utility and start using it alongside Sentry. Both systems run in parallel — no risk of losing visibility.

1. Install `pino` and `@google-cloud/pino-logging-gcp-config`
2. Create `src/lib/logger.ts`
3. Add trace correlation middleware
4. Begin replacing `console.log` / `console.error` calls with `logger.info` / `logger.error`

### Phase 2: Add Client Telemetry Endpoint

1. Create `/api/telemetry` route handler
2. Create `src/lib/telemetry.ts` with global error handlers
3. Initialize telemetry in the root layout
4. Update error boundaries to use `reportErrorBoundary`

### Phase 3: Verify GCP Coverage

Deploy to Cloud Run and verify:
- Structured logs appear in Cloud Logging with correct severity levels
- Errors with stack traces appear in Cloud Error Reporting, properly grouped
- Trace correlation works (application logs nest under request logs)
- Client-side errors arrive via the telemetry endpoint
- Log-based alerts fire correctly

### Phase 4: Remove Sentry

Only after Phase 3 is verified in production:

1. Remove `@sentry/node` from backend
2. Remove `@sentry/nextjs` from web app (including `withSentryConfig` in `next.config.ts`)
3. Remove `@sentry/browser` from extension (if extension is still active)
4. Remove all `Sentry.captureException` / `captureException` calls (replace with `logger.error`)
5. Remove all `sentry.*.config.ts` files
6. Remove all `sentry-sanitization.ts` files
7. Remove Sentry DSN environment variables
8. Clean up `beforeSend` / `beforeBreadcrumb` hooks (PHI redaction moves to Pino's `redact` config)

### Files to Modify/Remove

**Remove entirely:**
- `backend/src/instrument.ts`
- `backend/src/utils/sentry-sanitization.ts`
- `web/sentry.client.config.ts`
- `web/sentry.server.config.ts`
- `web/sentry.edge.config.ts`
- `web/src/lib/sentry-sanitization.ts`
- `extension/src/shared/sentry.ts`
- `extension/src/shared/sentry-sanitization.ts`

**Modify (replace Sentry calls with logger):**
- All files containing `captureException` (~42 files, ~104 call sites)
- `web/next.config.ts` (remove `withSentryConfig` wrapper)
- `web/src/instrumentation.ts` (replace Sentry init with `onRequestError` logger)
- `web/src/app/global-error.tsx` (use `reportErrorBoundary` instead of Sentry)
- `web/src/components/ErrorBoundary.tsx` (use `reportErrorBoundary`)

---

## HIPAA Compliance

### PHI Protection

**Defense in depth — two layers of PHI protection:**

1. **Application layer**: Never pass PHI to the logger. All logging calls use safe metadata only (user IDs, timestamps, error types, durations). This is the primary defense.
2. **Pino redaction layer**: The `redact` configuration in the logger catches accidental PHI inclusion. If a developer mistakenly passes a field named `patient`, `diagnosis`, `noteContent`, etc., Pino replaces the value with `[PHI_REDACTED]` before it reaches stdout.

### What's Safe to Log

| Safe | Not Safe |
|------|----------|
| User ID (`userId`) | Patient name |
| Timestamp | Date of birth |
| Error type / error code | Note content (SOAP, quickNotes) |
| Request path | Diagnosis / treatment details |
| Response status code | Medical record numbers |
| Duration (ms) | Request/response bodies |
| Token counts | Email addresses (use userId) |
| Deploy version | Full error messages from user input |

### Audit Log Retention

The PostgreSQL `audit_logs` table remains the **source of truth** for HIPAA compliance audits. Cloud Logging provides supplementary operational visibility.

**Retention strategy:**

| Log Type | Retention | Method |
|---|---|---|
| Admin Activity audit logs | 400 days (automatic, free) | GCP `_Required` bucket — cannot be disabled |
| Application logs (info/debug) | 30 days (default, free) | GCP `_Default` bucket — sufficient for operational use |
| HIPAA audit logs | **6 years** | Log sink → Cloud Storage bucket with locked retention policy |
| Application error logs | 90-365 days | Custom log bucket with extended retention |

### Log Sink for 6-Year HIPAA Retention

```bash
# 1. Create a Cloud Storage bucket with locked retention
gcloud storage buckets create gs://flashnote-hipaa-audit-logs \
  --location=us-central1 \
  --uniform-bucket-level-access

# 2. Set 6-year (2190 day) retention policy
gcloud storage buckets update gs://flashnote-hipaa-audit-logs \
  --retention-period=2190d

# 3. Lock the retention policy (IRREVERSIBLE — objects cannot be deleted until retention expires)
gcloud storage buckets update gs://flashnote-hipaa-audit-logs \
  --lock-retention-period

# 4. Create a log sink that routes audit-tagged logs to the bucket
gcloud logging sinks create hipaa-audit-sink \
  storage.googleapis.com/flashnote-hipaa-audit-logs \
  --log-filter='resource.type="cloud_run_revision" jsonPayload.audit=true'

# 5. Grant the sink's service account write access to the bucket
# (the sink create command outputs the service account — use that)
gcloud storage buckets add-iam-policy-binding gs://flashnote-hipaa-audit-logs \
  --member="serviceAccount:SINK_SERVICE_ACCOUNT" \
  --role="roles/storage.objectCreator"
```

To tag a log entry for HIPAA audit retention:

```typescript
logger.info({ audit: true, userId: user.id, action: 'login' }, 'User authenticated');
logger.info({ audit: true, userId: user.id, action: 'note_generated' }, 'Note generation completed');
```

---

## Alerting

### Cloud Monitoring Alert Policies

Set up in the Google Cloud Console or via Terraform/gcloud.

**Critical alerts (notify immediately):**

| Alert | Log Filter | Condition |
|---|---|---|
| 5xx error spike | `severity>=ERROR resource.type="cloud_run_revision"` | >10 errors in 5 minutes |
| Auth failures spike | `jsonPayload.source="auth_service" jsonPayload.errorType="invalid_credentials"` | >20 in 15 minutes (brute force indicator) |
| Database errors | `jsonPayload.source="database" severity=ERROR` | Any occurrence |
| Billing webhook failures | `jsonPayload.source="billing_webhook" severity=ERROR` | Any occurrence |

**Warning alerts (review within hours):**

| Alert | Log Filter | Condition |
|---|---|---|
| LLM service errors | `jsonPayload.source="ai_service" severity=ERROR` | >5 in 30 minutes |
| Elevated 4xx rate | Via Cloud Run metrics, not logs | >50% of requests are 4xx |

**Notification channels:** Email (immediate), Slack webhook (if configured). PagerDuty/Opsgenie can be added at growth stage.

### UptimeRobot (External Monitoring)

Cloud Monitoring alert policies monitor from inside GCP. UptimeRobot provides external validation that the service is reachable from the internet.

| Monitor | URL | Interval |
|---|---|---|
| API Health | `https://api.flashnote.co/health` | 5 min |
| Web App | `https://flashnote.co` | 5 min |

---

## Dependabot Setup

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "npm"
    directory: "/extension"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "npm"
    directory: "/web"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

---

## Environment Variables

### Production (Cloud Run)

```bash
# Automatically available on Cloud Run — no configuration needed:
# - GOOGLE_CLOUD_PROJECT (for trace correlation)
# - Logs to stdout are automatically captured

# Application config
LOG_LEVEL=info              # Pino log level (debug|info|warn|error)
DEPLOY_VERSION=abc123       # Git SHA or deploy tag (for release tracking in Error Reporting)
```

### Local Development

```bash
# No GCP credentials needed — Pino uses pino-pretty for local output
LOG_LEVEL=debug
```

---

## Cost Summary

### Monitoring Stack

| Service | Monthly Cost | What You Get |
|---------|-------------|--------------|
| Cloud Logging | $0 (50 GB/mo free) | Structured log aggregation, search, analytics |
| Cloud Error Reporting | $0 (always free) | Automatic error grouping, alerting, dashboards |
| Cloud Monitoring | $0 (alerting free) | Log-based alerts, uptime checks |
| Cloud Storage (audit sink) | ~$0.50/mo | 6-year HIPAA audit log retention (pennies/GB) |
| UptimeRobot | $0 | External uptime monitoring |
| Dependabot | $0 | Dependency security alerts |
| **Total** | **~$0.50/mo** | Full observability with HIPAA BAA coverage |

### Compared to Previous Plan

| | Previous (Sentry + Axiom) | New (GCP-Native) |
|---|---|---|
| Pre-launch (no BAA) | $0/mo | $0/mo |
| HIPAA-ready (with BAA) | $26/mo (Sentry) + $225/mo (Axiom) = **$251/mo** | **~$0.50/mo** |
| BAAs to manage | 3 (GCP + Sentry + Axiom) | 1 (GCP) |
| Dependencies to maintain | `@sentry/node`, `@sentry/nextjs`, `@sentry/browser`, sentry-sanitization, winston, `@axiomhq/winston` | `pino`, `@google-cloud/pino-logging-gcp-config` |

---

## Maintenance Schedule

### Weekly
- Review Cloud Error Reporting for new error groups
- Check UptimeRobot for downtime incidents
- Merge or close Dependabot PRs
- Glance at Stripe dashboard for failed payments

### Monthly
- Review PostgreSQL audit logs for suspicious patterns
- Test database backup restoration
- Update dependencies with breaking changes
- Review Cloud Monitoring metrics and costs

### Quarterly
- Full dependency audit (`pnpm audit`)
- Review and rotate secrets if needed
- Test disaster recovery process
- Review error trends in Cloud Error Reporting

### Annually
- Security audit review
- HIPAA compliance documentation update
- Architecture review for scale
- Update Node.js to latest LTS

---

## Incident Response Runbook

### API Down (UptimeRobot Alert)

1. Check Cloud Error Reporting for recent error spikes
2. Check Cloud Logging: filter by `severity>=ERROR resource.type="cloud_run_revision"`
3. Check Cloud Run console for instance health, crash loops, OOM
4. Check database connectivity (Cloud SQL)
5. Check external services (Vertex AI / Gemini, Stripe)
6. If unrecoverable, rollback to previous Cloud Run revision

### Spike in Errors (Cloud Error Reporting Alert)

1. Open the error group — identify affected endpoint/function from stack trace
2. Check Cloud Logging with trace correlation — what happened in the full request?
3. Check recent deploys — was anything changed? (`DEPLOY_VERSION` in logs)
4. Check if isolated to one user or widespread (filter by `jsonPayload.userId`)
5. If critical, rollback Cloud Run revision and investigate
6. If minor, hotfix and deploy

### Payment Failures (Stripe Alert)

1. Check Stripe dashboard for webhook delivery status
2. Filter Cloud Logging: `jsonPayload.source="billing_webhook"`
3. Check webhook signature validation errors
4. Review recent billing code changes
5. Manually sync subscription status if needed

### Suspected Security Incident

1. **Immediately**: Rotate affected secrets in Secret Manager
2. Query Cloud Logging for the affected user/IP: `jsonPayload.userId="xxx"` or `httpRequest.remoteIp="xxx"`
3. Review PostgreSQL audit logs for unauthorized access patterns
4. Check for unusual login patterns (failed auth spikes)
5. If PHI exposed: Begin HIPAA breach notification protocol
6. Document everything — Cloud Logging entries are timestamped and immutable within retention

---

## Quick Reference

### Useful Cloud Logging Queries

```
# All errors from the backend
resource.type="cloud_run_revision"
severity>=ERROR

# Errors from a specific source
jsonPayload.source="ai_service"
severity=ERROR

# All activity for a specific user
jsonPayload.userId="user-uuid-here"

# HIPAA audit events
jsonPayload.audit=true

# Client-side errors
jsonPayload.source="client"

# Errors in the last hour with trace correlation
resource.type="cloud_run_revision"
severity>=ERROR
timestamp>="2026-01-01T00:00:00Z"
```

### Common Issues

| Symptom | Check | Fix |
|---|---|---|
| Logs not appearing in Cloud Logging | Verify Cloud Run service is using stdout, not a file | Pino defaults to stdout — ensure no file transport |
| Errors not in Error Reporting | Check log severity is ERROR+ and stack trace is present | Pass `{ err }` to Pino, not `{ message: err.message }` |
| No trace correlation | Check `X-Cloud-Trace-Context` header extraction | Verify `GOOGLE_CLOUD_PROJECT` env var is set |
| Client errors not arriving | Check `/api/telemetry` endpoint is deployed | Test with `curl -X POST /api/telemetry` |
| 401 on all requests | JWT secret mismatch | Check `JWT_SECRET` in Secret Manager |
| Webhook failures | Stripe signature mismatch | Verify `STRIPE_WEBHOOK_SECRET` |
