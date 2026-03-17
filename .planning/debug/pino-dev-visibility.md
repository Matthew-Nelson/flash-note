---
status: diagnosed
trigger: "Investigate why Pino structured logs are not visible in the dev terminal when running pnpm dev"
created: 2026-03-17T21:00:00Z
updated: 2026-03-17T21:30:00Z
---

## Current Focus

hypothesis: Two co-occurring root causes — (1) no logger calls exist in happy paths, (2) pino-pretty transport worker thread stdout may be suppressed by Turbopack
test: Exhaustive grep of all logger.info/warn/debug/error calls in src/; diagnostic endpoint testing logger output in running dev server
expecting: Either logger calls exist and output is suppressed, or no calls exist
next_action: Report findings and recommend fixes

## Symptoms

expected: Pino-formatted output (colored, timestamped, with source/level key-value pairs) visible in the `pnpm dev` terminal during normal operations (login, page loads, API calls)
actual: Only Next.js built-in request logs appear (GET / 200 in 668ms). No Pino output visible. Telemetry endpoint returns 200 but no log output.
errors: None — app works correctly, just no log visibility
reproduction: Run `pnpm dev`, navigate the app, login, generate notes — no Pino output in terminal
started: Since Pino logger was introduced (no prior baseline of working Pino output in dev)

## Eliminated

- hypothesis: Logger level set too high (e.g., 'silent' in dev)
  evidence: Diagnostic endpoint confirmed logger.level='debug', logger.levelVal=20, all levels debug+ enabled. No LOG_LEVEL env var set. logger.ts defaults to 'debug' in non-production.
  timestamp: 2026-03-17T21:10:00Z

- hypothesis: pino-pretty transport not configured or fails to load
  evidence: Diagnostic endpoint confirmed hasTransport=true. pino and pino-pretty are both in Next.js 16.1.6's default serverExternalPackages list (node_modules/next/dist/lib/server-external-packages.jsonc lines 71-74). Module loads without error in Turbopack context. NOTE: pino-pretty DOES fail to resolve outside Turbopack context (bare node -e) due to pnpm strict hoisting — pino's worker thread can't find pino-pretty from the .pnpm store. But Turbopack externalization solves this.
  timestamp: 2026-03-17T21:15:00Z

- hypothesis: Logger writes to file/stream instead of stdout
  evidence: logger.ts configures pino-pretty transport with colorize:true and no destination override. pino-pretty defaults to process.stdout. No file destination configured.
  timestamp: 2026-03-17T21:12:00Z

- hypothesis: Logger module not imported/executed at runtime
  evidence: 15 files import from '@/server/lib/logger'. Health endpoint (/api/health) imports logger via dal/health.ts and responds correctly. Diagnostic endpoint confirmed NODE_ENV=development and logger functions are callable.
  timestamp: 2026-03-17T21:08:00Z

- hypothesis: @google-cloud/pino-logging-gcp-config interferes in dev
  evidence: GCP config is only used in the production branch (isProduction=true). In dev, the plain pino({...}) branch runs. Confirmed via diagnostic endpoint showing NODE_ENV=development.
  timestamp: 2026-03-17T21:11:00Z

## Evidence

- timestamp: 2026-03-17T21:05:00Z
  checked: logger.ts configuration (web/src/server/lib/logger.ts)
  found: Correct branching — production uses GCP config, dev/test uses pino-pretty transport. Test mode skips transport (raw JSON). Level defaults to 'debug' in dev.
  implication: Configuration is correct. The logger SHOULD produce pino-pretty output in dev.

- timestamp: 2026-03-17T21:08:00Z
  checked: All logger.info() calls in src/ (excluding test files and debug endpoint)
  found: Only 3 logger.info calls in production code — billing webhook duplicate skip (rare), email dev mode logging (only when Resend not configured), cleanup job (cron). ZERO logger.info calls in auth, session validation, page rendering, or any common request path.
  implication: Normal user operations (login, page load, dashboard, note generation) produce ZERO Pino info output.

- timestamp: 2026-03-17T21:09:00Z
  checked: All logger.debug() calls in src/ (excluding test files and debug endpoint)
  found: ZERO logger.debug() calls in any production code file.
  implication: Even at debug level, the logger is never called during normal operations.

- timestamp: 2026-03-17T21:10:00Z
  checked: All logger.warn() calls in src/ (excluding test files and debug endpoint)
  found: 4 warn calls — suspicious prompt patterns (rare), unhandled webhook event type (rare), LLM retry attempt (occasional), SIGTERM shutdown (never in dev). None fire during normal request handling.
  implication: Warn-level output only appears during unusual conditions.

- timestamp: 2026-03-17T21:11:00Z
  checked: All logger.error() calls in src/ (excluding test files and debug endpoint)
  found: ~25 error calls — ALL inside catch blocks or error-handling paths. None in happy paths. Examples: lockout service failures, session delete failures, email send failures, webhook handler failures, health check failures.
  implication: Error-level output only appears when something actively fails. During normal operation = zero output.

- timestamp: 2026-03-17T21:14:00Z
  checked: Telemetry endpoint (web/src/app/api/telemetry/route.ts)
  found: Always returns { ok: true } regardless of outcome (rate limit, parse failure, validation failure, or success). The reqLogger.error() call on line 82 only fires AFTER successful Zod validation. The endpoint silently swallows all errors. User sees 200 but may not realize payload was rejected.
  implication: Telemetry POST returning 200 does NOT mean the logger was called. The payload may have failed validation silently.

- timestamp: 2026-03-17T21:18:00Z
  checked: pnpm package layout for pino and pino-pretty
  found: pino lives at node_modules/.pnpm/pino@10.3.1/node_modules/pino/. pino-pretty lives at node_modules/.pnpm/pino-pretty@13.1.3/node_modules/pino-pretty/. pino-pretty is NOT symlinked into pino's node_modules directory. However, both are in Next.js 16.1.6's serverExternalPackages list, so Turbopack does not bundle them.
  implication: Outside Next.js (bare node), pino cannot resolve pino-pretty due to pnpm hoisting. Inside Next.js, externalization handles it.

- timestamp: 2026-03-17T21:20:00Z
  checked: Diagnostic endpoint in running dev server
  found: Logger level=debug, NODE_ENV=development, hasTransport=true, all level checks pass. Logger functions are callable. Logger module loads without error.
  implication: The pino-pretty transport IS configured and operational in the dev server. If logger calls were made, they should produce output.

- timestamp: 2026-03-17T21:22:00Z
  checked: Whether pino-pretty worker thread stdout is visible to the terminal
  found: pino-pretty uses a worker thread (via thread-stream) that writes to its own stdout. Next.js Turbopack may not relay worker thread stdout to the terminal in all cases. This is a known class of issue (GitHub issues #84766, #86099, #87342 on vercel/next.js). However, this is a SECONDARY concern — the PRIMARY issue is that no logger calls exist in happy paths.
  implication: Even if worker thread stdout works perfectly, there would be no visible output because the logger is never called during normal operations.

## Resolution

root_cause: |
  TWO co-occurring issues:

  **Primary (ROOT CAUSE): No logger calls in happy paths.**
  The Pino logger is imported by 15 files but is only called in error/catch paths.
  During normal operations (login, page loads, session validation, note generation,
  health checks), ZERO logger calls are made. There are 0 logger.debug() calls,
  3 logger.info() calls (all in rare/edge-case paths), 4 logger.warn() calls
  (all in unusual conditions), and ~25 logger.error() calls (all in catch blocks).
  The application was migrated from console.* to Pino at the module level (imports,
  singleton creation) but the actual log statements were only added for error paths.
  No operational logging (request handling, auth flow, DB queries) was implemented.

  **Secondary: pino-pretty may have worker thread stdout visibility issues with Turbopack.**
  pino-pretty uses a worker thread via thread-stream. Turbopack has known issues
  with worker thread stdout relay (vercel/next.js #84766, #86099, #87342). While
  pino and pino-pretty are in Next.js 16.1.6's default serverExternalPackages
  (preventing bundling), the worker thread stdout may not be fully relayed to the
  dev terminal. This is secondary because even if stdout relay works perfectly,
  there is no output to relay during normal operations.

  **Tertiary: pnpm strict hoisting prevents pino from resolving pino-pretty outside Turbopack.**
  When running `node -e` or scripts outside Next.js, pino's transport.js cannot
  resolve 'pino-pretty' because pnpm does not hoist pino-pretty into pino's
  node_modules. This doesn't affect the Next.js dev server (Turbopack
  externalization handles it) but would affect any standalone scripts using the logger.

fix: |
  Not yet applied. Recommended approach:

  **1. Add operational logging to key paths (PRIMARY FIX):**
  Add logger.info/debug calls at critical operational points:

  - `get-session.ts`: Log session validation (debug level) — session found/not found, refresh triggered
  - `auth.ts` (service): Log login attempts (info level) — success/failure with userId (no email)
  - `db/index.ts`: Log pool creation (info level) on startup
  - `actions/auth.ts`: Log action entry points (debug level)
  - `actions/notes.ts`: Log note generation start/complete (info level) with userId, noteType, duration
  - `dal/health.ts`: Log health check result (debug level)
  - Telemetry route: Add debug-level log for received payloads (before validation) to diagnose silent drops

  **2. Verify pino-pretty worker thread stdout in Turbopack (SECONDARY FIX):**
  Test whether pino-pretty output actually appears in the terminal by adding a
  startup log message (e.g., in db/index.ts pool creation). If output does NOT
  appear, add `serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream']`
  to next.config.ts explicitly (even though they're in the default list, explicit
  config may resolve worker thread stdout issues).

  If worker thread stdout is still not relayed, switch to synchronous Pino in dev:
  ```typescript
  // Dev-only: use sync mode to avoid worker thread stdout issues
  ...(process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, ignore: 'pid,hostname', translateTime: 'HH:MM:ss.l', sync: true },
        },
      }
    : {}),
  ```

  **3. Fix pnpm resolution for standalone scripts (TERTIARY FIX):**
  Move pino-pretty from devDependencies to dependencies in package.json, OR
  use require.resolve('pino-pretty') as the transport target instead of the
  bare string 'pino-pretty':
  ```typescript
  transport: {
    target: require.resolve('pino-pretty'),
    options: { ... },
  },
  ```

verification: Not yet verified — diagnosis only.
files_changed: []
