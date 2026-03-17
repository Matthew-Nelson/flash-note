# Technology Stack

**Analysis Date:** 2026-03-16

## Languages

**Primary:**
- TypeScript 5.3 - All application code in `web/src/`; strict mode enabled (`"strict": true` in `web/tsconfig.json`)

**Secondary:**
- SQL - Raw PostgreSQL queries in DAL layer (`web/src/server/dal/`)
- HTML/CSS - Email templates in `web/src/server/services/email.ts`; Tailwind utility classes throughout

## Runtime

**Environment:**
- Node.js >=20.9.0 (Alpine Linux in Docker; `node:20-alpine` in `Dockerfile`)

**Package Manager:**
- pnpm 10.28.2 (enforced via `packageManager` field and `corepack`)
- Lockfile: `pnpm-lock.yaml` present and required (`--frozen-lockfile` in Docker builds)

## Workspace

**Structure:** pnpm monorepo — single `web` package (`pnpm-workspace.yaml`)
- Root scripts delegate to workspace packages via `pnpm -r`

## Frameworks

**Core:**
- Next.js 16.1.6 - App Router, Server Components, Server Actions, Route Handlers
  - `output: 'standalone'` for Docker deployments
  - `reactStrictMode: true`
- React 19.2.4 - UI rendering (Server Components default; Client Components only where required)
- React DOM 19.2.4

**Styling:**
- Tailwind CSS 3.4.19 - Utility-first CSS; configured in `web/tailwind.config.ts`
  - Uses a shared design system preset: `web/design-system/tailwind-preset-teal.js`
  - Content paths: `src/pages/**`, `src/components/**`, `src/app/**`
- PostCSS 8 (`web/postcss.config.js`)

**Build/Dev:**
- TypeScript compiler — `noEmit: true` (Next.js handles compilation)
- Path alias: `@/*` maps to `web/src/*` (configured in `web/tsconfig.json`)
- Sentry Next.js integration wraps `nextConfig` via `withSentryConfig` in `web/next.config.ts`

## Testing

**Unit/Integration:**
- Vitest 4.0.18 - Test runner; config in `web/vitest.config.ts`
  - Environment: `jsdom` (browser API simulation)
  - Coverage: `@vitest/coverage-v8` 4.0.18
  - Coverage thresholds: 95% lines, functions, branches, statements (enforced)
  - Test pattern: `src/**/*.test.{ts,tsx}`
  - Excludes: `src/app/**` (Next.js routes — E2E tested)
- React Testing Library 16.3.2 (`@testing-library/react`)
- `@testing-library/user-event` 14.6.1
- `@testing-library/jest-dom` 6.9.1
- jsdom 28.0.0
- Setup file: `web/src/test/setup.ts`

**E2E:**
- Playwright 1.58.1 - E2E tests in `web/tests/e2e/`; config in `web/playwright.config.ts`
  - `fullyParallel: true`, 2 workers in CI
  - `retries: 2` in CI

## Linting

- ESLint 9.39.2 with `eslint.config.mjs`
  - `eslint-config-next` 16.1.6
  - `typescript-eslint` 8.54.0
  - `eslint-plugin-jsx-a11y` 6.10.2 (accessibility enforcement)
  - `eslint-plugin-react-hooks` 7.0.1

## Key Dependencies

**Critical:**
- `zod` 3.25.76 - Runtime validation for all external inputs (forms, webhooks, URL params, env vars, API responses)
- `zod-to-json-schema` 3.25.1 - Converts Zod schemas to JSON Schema for LLM response schema enforcement
- `server-only` 0.0.1 - Enforces server-only imports; importing from Client Components causes build error
- `bcryptjs` 2.4.3 - Password hashing (12 bcrypt rounds; `BCRYPT_ROUNDS = 12` in `web/src/server/db/config.ts`)

**Database:**
- `pg` 8.18.0 - PostgreSQL client with connection pooling (`pg.Pool`, max 20 connections)
- `@types/pg` 8.16.0

**Rate Limiting:**
- `@upstash/ratelimit` 2.0.8 - Sliding window rate limiting backed by Redis
- `@upstash/redis` 1.36.2 - HTTP-based Redis client for Upstash

**Billing:**
- `stripe` 20.3.0 - Stripe SDK for checkout sessions, subscriptions, webhook handling

**Email:**
- `resend` 6.9.1 - Transactional email delivery

**AI/LLM:**
- No SDK dependency — Gemini and Claude providers use raw `fetch()` calls to their REST APIs
  (`web/src/server/services/llm/gemini-provider.ts`, `web/src/server/services/llm/claude-provider.ts`)

**Error Monitoring:**
- `@sentry/nextjs` 10.38.0 - Error tracking; configured in `web/sentry.server.config.ts` and `web/sentry.edge.config.ts`

**Image:**
- `sharp` 0.34.2 - Next.js image optimization

## Configuration

**Environment:**
- All env vars validated at startup via Zod schema in `web/src/server/db/config.ts`
- Invalid env → `console.error` + `process.exit(1)` (fail-fast)
- `.env.local` for local dev; `.env.example` documents all vars

**Required env vars (production):**
- `DATABASE_URL` - Must start with `postgres://` or `postgresql://`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Billing
- `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL` - Price IDs (server-side)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Client-side Stripe
- `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`, `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL` - Client-side price IDs
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` - Rate limiting (required in production; process exits without these)
- `GEMINI_USE_ADC=true` + Vertex AI endpoint via `GEMINI_API_URL` - LLM in production (direct Gemini API URL blocked in production)
- `CLEANUP_SECRET` - Minimum 32 chars; auth for Cloud Scheduler cleanup endpoint
- `NEXT_PUBLIC_SENTRY_DSN` - Error tracking

**Optional/Dev vars:**
- `RESEND_API_KEY` - Email; falls back to `console.log` in dev/test
- `GEMINI_API_KEY` - Required in dev when `GEMINI_USE_ADC=false`
- `USE_MOCK_AI` - Skips LLM calls in dev/test; **blocked in production at startup**
- `REGISTRATION_MODE` - `open` | `closed` | `invite` (default: `open`)
- `TRUSTED_PROXY_COUNT` - Default 1 (Cloud Run); 0 for local dev without proxy
- `LLM_PROVIDER` - `gemini` (default) or `claude`; claude is **blocked in production**

**Build:**
- `web/next.config.ts` - Next.js config with Sentry wrapper
- `web/tsconfig.json` - TypeScript strict mode, `bundler` module resolution, `@/*` alias
- Security headers set globally via `next.config.ts` `headers()`: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy

## Platform Requirements

**Development:**
- Node.js >=20.9.0, pnpm >=10.0.0
- PostgreSQL (local); `pnpm db:migrate` runs migrations via `web/src/server/db/migrate.ts`
- Upstash Redis optional in dev (rate limiting bypassed when unconfigured)
- Resend optional in dev (emails logged to console)

**Production:**
- Google Cloud Run (containerized; `linux/amd64`)
- Docker multi-stage build: `deps` → `builder` → `runner` (Alpine, non-root `nextjs` user)
- `output: 'standalone'` produces self-contained server bundle
- `NEXT_MANUAL_SIG_HANDLE=true` enables graceful SIGTERM handling for pool drain
- `HOSTNAME=0.0.0.0` so server listens on all interfaces (required for Cloud Run routing)
- Port 3000

---

*Stack analysis: 2026-03-16*
