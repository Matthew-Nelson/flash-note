# External Integrations

**Analysis Date:** 2026-03-16

## APIs & External Services

**AI/LLM (Primary — Production):**
- Google Gemini via Vertex AI - SOAP note generation from PT shorthand input
  - SDK/Client: Raw `fetch()` — no Google SDK dependency (`web/src/server/services/llm/gemini-provider.ts`)
  - Auth: Application Default Credentials (ADC) on Cloud Run (`GEMINI_USE_ADC=true`); service account bearer token fetched from GCP metadata server at `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token`
  - API Key auth: `GEMINI_API_KEY` (dev only; `x-goog-api-key` header)
  - Endpoint: `GEMINI_API_URL` env var (must point to `aiplatform.googleapis.com` in production; direct `generativelanguage.googleapis.com` is **blocked in production by config validation**)
  - Default model: `gemini-2.5-flash` (`GEMINI_MODEL`)
  - ADC token cache: in-memory, refreshed 60s before expiry in `GeminiProvider` singleton
  - Uses JSON mode with `responseMimeType: 'application/json'` and `responseSchema` for structured output
  - Structured response validated against Zod schema in `web/src/server/services/llm/schemas.ts`

**AI/LLM (Secondary — Dev/Test Only):**
- Anthropic Claude — dev/test only; **blocked in production** (no Anthropic BAA)
  - SDK/Client: Raw `fetch()` to `https://api.anthropic.com/v1/messages` (`web/src/server/services/llm/claude-provider.ts`)
  - Auth: `ANTHROPIC_API_KEY` header (`x-api-key`)
  - Default model: `claude-sonnet-4-20250514` (`ANTHROPIC_MODEL`)
  - Uses tool use (forced `generate_pt_note` tool) for structured output
  - Config enforcement: `LLM_PROVIDER=claude` in production causes `process.exit(1)` in config validation

**LLM Provider Abstraction:**
- `LLMProvider` interface defined in `web/src/server/services/llm/provider.ts`
- `BaseLLMProvider` base class provides retry logic (exponential backoff with jitter, max retries, retryable error codes)
- Factory: `createLLMProvider()` / `getConfiguredProvider()` in `web/src/server/services/llm/provider-factory.ts`
- Singleton cached by config key; ADC token cache survives request boundaries

**Billing:**
- Stripe - Subscription management and checkout
  - SDK/Client: `stripe` npm package v20 (`web/src/server/services/billing.ts`)
  - Auth: `STRIPE_SECRET_KEY` (server-side only)
  - Client-side key: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - API version pinned: `2025-12-15.clover` (locked to match Dashboard webhook endpoint)
  - Features used: Checkout Sessions, Customer Portal, Subscription lifecycle webhooks

**Email:**
- Resend - Transactional email delivery
  - SDK/Client: `resend` npm package v6 (`web/src/server/services/email.ts`)
  - Auth: `RESEND_API_KEY`
  - From address: `EMAIL_FROM_ADDRESS` (default: `noreply@flashnote.app`)
  - From name: `EMAIL_FROM_NAME` (default: `FlashNote`)
  - Dev mode: when `RESEND_API_KEY` not set, emails are logged to `console.log` (no API calls)
  - Email types: verification email, password reset, organization invite

**Error Monitoring:**
- Sentry (`@sentry/nextjs` v10) - Error tracking for client and server
  - Auth: `NEXT_PUBLIC_SENTRY_DSN` (build-time injection via Docker `ARG`)
  - Org/project: `flashnote` / `flashnote-web` (configured in `web/next.config.ts`)
  - HIPAA: `sendDefaultPii: false`; `beforeSend` hook strips request body, cookies, query strings, and sanitizes `event.extra` via `sanitizeObject()` (`web/src/lib/sentry-sanitization.ts`)
  - Sentry auth token: `SENTRY_AUTH_TOKEN` (CI only, for source map uploads)
  - Coverage: server-side config (`web/sentry.server.config.ts`), edge runtime config (`web/sentry.edge.config.ts`)

## Data Storage

**Databases:**
- PostgreSQL on Google Cloud SQL
  - Connection: `DATABASE_URL` env var (must start with `postgres://` or `postgresql://`)
  - Client: `pg` npm package (raw SQL, no ORM)
  - Pool: singleton `pg.Pool` (max 20 connections, idle timeout 30s, connection timeout 2s, statement timeout 30s)
  - Pool initialization: `web/src/server/db/index.ts`; uses `globalThis` cache to survive Next.js HMR
  - Cloud Run connection: via Cloud SQL Auth Proxy sidecar (encrypted tunnel; no application-level SSL needed)
  - Migration runner: `web/src/server/db/migrate.ts` (run via `pnpm db:migrate`)
  - Migrations directory: `web/src/server/db/migrations/`
  - 11 tables: `users`, `sessions`, `audit_logs`, `usage`, `email_tokens`, `organizations`, `organization_members`, `legal_acceptances`, `invite_codes`, `processed_webhook_events`, `migrations`

**Caching / Rate Limiting:**
- Upstash Redis (serverless Redis over HTTP)
  - Connection: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
  - Client: `@upstash/redis` (HTTP-based; works across Cloud Run instances)
  - Used for: Redis-backed sliding window rate limiting via `@upstash/ratelimit`
  - Rate limit config: `web/src/server/lib/rate-limit.ts`; key prefixed `flashnote:{limiter_name}`
  - Client init: `web/src/server/lib/redis.ts`; returns `null` in dev/test when unconfigured; calls `process.exit(1)` in production without credentials
  - Dev/test: all rate limiters return `{ success: true }` when Redis unavailable

**File Storage:**
- None — PHI is pass-through only (no notes stored in v1); no file storage integration

## Authentication & Identity

**Auth Provider:**
- Custom (no third-party auth provider)
  - Implementation: Cookie-based sessions with opaque UUIDs
  - Cookie: `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`; contains only session ID (no PHI)
  - Session state: stored in `sessions` DB table (hashed tokens)
  - Token hashing: SHA-256 (`hashSessionToken()` in `web/src/server/lib/session-cookie.ts`)
  - Session validation: `getSession()` in `web/src/server/lib/get-session.ts`; wrapped with `React.cache()` to deduplicate per request
  - Session TTL: 24h idle, 7-day absolute max; sliding window refresh at >50% idle TTL elapsed
  - Max sessions per user: 5
  - Password hashing: bcryptjs, 12 rounds
  - Email verification: token-based (`email_tokens` table; 24h expiry)
  - Password reset: token-based (15-minute expiry)

## Monitoring & Observability

**Error Tracking:**
- Sentry (`@sentry/nextjs`) — see above under APIs & External Services

**Logs:**
- Current: `console.error()` / `console.warn()` / `console.log()` throughout server code
- Planned (not yet implemented): Pino structured logger + `@google-cloud/pino-logging-gcp-config` → Cloud Logging → Cloud Error Reporting (documented in `docs/planning/MONITORING_SETUP.md`)

**Health Check:**
- `GET /api/health` — `web/src/app/api/health/route.ts`
- Reports `{ status: 'ok' | 'degraded', db: 'connected' | 'unreachable' }`
- Always returns 200 (Cloud Run liveness/startup probe compatible)

**HIPAA Audit Logs:**
- All auth events, authorization failures, and note generation metadata written to `audit_logs` DB table
- Immutable append-only design
- Audit writes in same DB transaction as the action they document when using `auditService.logWithClient()` (`web/src/server/services/audit.ts`)

## CI/CD & Deployment

**Hosting:**
- Google Cloud Run (containerized, `linux/amd64`, non-root user)
- Docker multi-stage build defined in `Dockerfile` at project root

**CI Pipeline:**
- Not directly observed in codebase scan; Playwright config references `process.env.CI` for reporter and worker settings

**Graceful Shutdown:**
- `NEXT_MANUAL_SIG_HANDLE=true` + `SIGTERM`/`SIGINT` handlers in `web/src/server/db/index.ts` drain the pg pool before exit (5s timeout)

**Scheduled Jobs:**
- Cloud Scheduler calls `POST /api/cleanup/webhook-events` to purge old `processed_webhook_events` records
  - Auth: `Bearer {CLEANUP_SECRET}` (timing-safe comparison)
  - Handler: `web/src/app/api/cleanup/webhook-events/route.ts`

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhooks/stripe` — Stripe webhook handler (`web/src/app/api/webhooks/stripe/route.ts`)
  - Signature verified via `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`
  - Raw body preserved as `ArrayBuffer` before signature check (body parsing would invalidate signature)
  - Returns 400 on invalid signature (tells Stripe not to retry)
  - Returns 500 on handler failure (tells Stripe to retry)
  - Idempotency: `processed_webhook_events` table prevents duplicate processing (`web/src/server/dal/webhooks.ts`)
  - Events handled: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

**Outgoing:**
- None (no webhooks sent to external services)

## Environment Configuration

**Required in production:**
- `DATABASE_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`, `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `GEMINI_USE_ADC=true`, `GEMINI_API_URL` (Vertex AI endpoint)
- `CLEANUP_SECRET` (min 32 chars)
- `NEXT_PUBLIC_SENTRY_DSN`

**Optional / Dev-only:**
- `RESEND_API_KEY`, `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`
- `GEMINI_API_KEY` (dev/test only when `GEMINI_USE_ADC=false`)
- `GEMINI_MODEL`, `GEMINI_MAX_TOKENS`, `GEMINI_TEMPERATURE`, `GEMINI_TIMEOUT_MS`
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_MAX_TOKENS`, `ANTHROPIC_TEMPERATURE`, `ANTHROPIC_TIMEOUT_MS`
- `USE_MOCK_AI` (dev/test only; hard-blocked in production)
- `LLM_PROVIDER` (default: `gemini`; `claude` hard-blocked in production)
- `REGISTRATION_MODE` (default: `open`)
- `TRUSTED_PROXY_COUNT` (default: `1`)
- `WEB_URL` (default: `http://localhost:3000`)
- `SENTRY_AUTH_TOKEN` (CI only)

**Secrets location:**
- `.env.local` for local development (gitignored)
- Cloud Run environment variables for production
- Docker build arg: `NEXT_PUBLIC_SENTRY_DSN` (build-time only)

---

*Integration audit: 2026-03-16*
