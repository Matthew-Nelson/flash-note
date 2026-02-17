# Environment Variables Guide

This guide covers how environment variables are managed across local development, testing, CI/CD, and production deployments.

## Architecture

Environment variables are loaded by a centralized loader (`backend/src/env-loader.ts`). This single file is the source of truth for loading `.env` files and must be imported before any other modules.

**Entry points that import env-loader:**
- `src/index.ts` - Main server
- `src/db/migrate.ts` - Database migrations (standalone script)
- `src/db/seed-test.ts` - Test data seeding (standalone script)

**File selection based on NODE_ENV:**
- `NODE_ENV=test` → loads `.env.test`
- Otherwise → loads `.env`

**Load priority (highest wins):**
1. Shell/command-line environment variables
2. Selected `.env` file
3. Code defaults (in Zod schema)

## Files Overview

| File | Committed | Purpose |
|------|-----------|---------|
| `.env` | No | Local development secrets (real API keys) |
| `.env.test` | Yes | Test configuration (fake/deterministic values) |
| `.env.example` | Yes | Template showing all required variables |
| `.env.local` | No | Personal overrides (optional) |

### Why `.env.test` is safe to commit

The test environment file contains only:
- Fake API keys (`fake-key-for-testing`)
- Deterministic secrets (`test-jwt-secret-...`)
- Localhost URLs (no remote credentials)
- Mock flags (`USE_MOCK_AI=true`)

No real secrets = safe to commit.

## NPM Scripts Reference

All scripts automatically load the correct `.env` file. No manual `NODE_ENV=` prefix needed.

### Server Scripts

| Script | Environment | Description |
|--------|-------------|-------------|
| `pnpm dev` | `.env` | Development server |
| `pnpm dev:test` | `.env.test` | Server for E2E testing |

### Database Scripts

| Script | Environment | Description |
|--------|-------------|-------------|
| `pnpm db:migrate` | `.env` | Migrate development database |
| `pnpm db:migrate:test` | `.env.test` | Migrate test database |
| `pnpm db:seed:test` | `.env.test` | Seed test user (auto-sets NODE_ENV=test) |
| `pnpm test:setup` | `.env.test` | Migrate + seed test database (one command) |

### Test Scripts

| Script | Environment | Description |
|--------|-------------|-------------|
| `pnpm test` | Production validation | Unit tests (validates prod config) |
| `pnpm test:e2e` | `.env.test` | E2E tests (in extension folder) |

## Environment Configuration by Context

### Local Development

```bash
# One-time setup: copy example and add your real API keys
cp backend/.env.example backend/.env
vim backend/.env

# Run the server
pnpm dev
```

### Local Testing (E2E)

```bash
# One-time setup: create and seed test database
createdb flashnote_test
pnpm test:setup

# Terminal 1: Start backend in test mode
pnpm dev:test

# Terminal 2: Run E2E tests
cd extension && pnpm test:e2e
```

### GitHub Actions (CI)

For E2E tests, the workflow uses:
- PostgreSQL service container (ephemeral, no secrets needed)
- `.env.test` values for most config
- GitHub Secrets for any real API keys needed

**Required GitHub Secrets** (Settings → Secrets → Actions):

| Secret | Required For | Notes |
|--------|--------------|-------|
| `STRIPE_SECRET_KEY` | Billing tests | Use `sk_test_...` key |
| `STRIPE_WEBHOOK_SECRET` | Webhook tests | Use test webhook secret |
| `GEMINI_API_KEY` | AI tests | Only if `USE_MOCK_AI=false` |

Most E2E tests work without real secrets because `USE_MOCK_AI=true` in `.env.test`.

### Cloud Run Deployment

Set environment variables in the Google Cloud Console (Cloud Run → Service → Edit → Variables & Secrets) or via `gcloud` CLI. For sensitive values, use **Secret Manager** references. No `.env` files are used in production.

**Staging Environment:**
```
NODE_ENV=production
DATABASE_URL=<cloud-sql-connection-string>
JWT_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>
CSRF_SECRET=<64-char-random-string>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
GEMINI_API_KEY=<real-api-key>
SENTRY_DSN=<sentry-project-dsn>
WEB_URL=https://staging.flashnote.co
API_URL=https://api-staging.flashnote.co
ALLOWED_ORIGINS=https://staging.flashnote.co,chrome-extension://<extension-id>
RESEND_API_KEY=re_...
```

**Production Environment:**
Same structure as staging, but with:
- Production Stripe keys (`sk_live_...`, `whsec_...`)
- Production URLs
- Different random secrets (never share between environments)
- Production extension ID in `ALLOWED_ORIGINS`
- Use Secret Manager for all secrets (`JWT_SECRET`, `CSRF_SECRET`, API keys)

## Generating Secure Secrets

For JWT and CSRF secrets, generate cryptographically random strings:

```bash
# Generate a 64-character random string
openssl rand -base64 48

# Run 3 times for:
# - JWT_SECRET
# - JWT_REFRESH_SECRET
# - CSRF_SECRET
```

**Security rules:**
- Never reuse secrets between staging and production
- Never commit real secrets to version control
- Rotate secrets if they're ever exposed

## Required Variables Reference

### Always Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Access token signing (min 32 chars) | `<random-64-chars>` |
| `JWT_REFRESH_SECRET` | Refresh token signing (min 32 chars) | `<random-64-chars>` |
| `CSRF_SECRET` | CSRF token signing (min 32 chars) | `<random-64-chars>` |
| `STRIPE_SECRET_KEY` | Stripe API key | `sk_test_...` or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature | `whsec_...` |

### Conditionally Required

| Variable | Required When | Description |
|----------|---------------|-------------|
| `GEMINI_API_KEY` | `LLM_PROVIDER=gemini` and `USE_MOCK_AI=false` | Google AI API key |
| `ANTHROPIC_API_KEY` | `LLM_PROVIDER=claude` | Anthropic API key |
| `RESEND_API_KEY` | Sending real emails | Email delivery service |
| `SENTRY_DSN` | Error monitoring enabled | Sentry project DSN |

### Optional with Defaults

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `PORT` | `4000` | API server port |
| `LLM_PROVIDER` | `gemini` | `gemini` or `claude` |
| `USE_MOCK_AI` | `false` | Skip real AI calls (for testing) |
| `WEB_URL` | `http://localhost:3000` | Web app URL |
| `API_URL` | `http://localhost:4000` | API URL |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:5173` | CORS allowlist |

## Extension Environment

The Chrome extension uses Vite's environment variable system (separate from backend):

| File | Build Mode | API URL |
|------|------------|---------|
| `extension/.env.development` | `pnpm build:dev` | `http://localhost:4000` |
| `extension/.env.production` | `pnpm build` | `https://api.flashnote.co` |

Variables must be prefixed with `VITE_` to be accessible in code:
```typescript
const API_URL = import.meta.env.VITE_API_URL;
```

**Important:** E2E tests require the extension built in development mode:
```bash
cd extension
pnpm build:dev  # Not pnpm build
```

The `pretest:e2e` hook does this automatically when running `pnpm test:e2e`.

## Troubleshooting

### Wrong database being used

**Symptom:** Tests connect to production/dev database instead of test database.

**Cause:** Environment variable set in shell (`.zshrc`, `.bashrc`) takes precedence over `.env` files.

**Fix:**
```bash
# Check for DATABASE_URL in your shell config
grep DATABASE_URL ~/.zshrc ~/.bashrc

# Unset if found
unset DATABASE_URL

# Verify correct database
pnpm dev:test
# Should show: [env-loader] DATABASE_URL: postgres://localhost/flashnote_test
```

### "Invalid environment variables" on startup

**Cause:** Missing required variables or validation failure.

**Fix:** Check the error output - it shows which fields failed. Compare against `.env.example`.

### Extension hitting wrong API URL

**Symptom:** Extension calls `https://api.flashnote.co` during local testing.

**Cause:** Extension was built in production mode.

**Fix:**
```bash
cd extension
pnpm build:dev  # Not pnpm build
```

### CORS errors from Chrome extension

**Symptom:** `Failed to fetch` errors from extension.

**Cause:** Extension ID not in `ALLOWED_ORIGINS` (production only - dev mode allows all origins).

**Fix:** Add your extension ID to `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=https://yourapp.com,chrome-extension://abcdefghijklmnopabcdefghijklmnop
```

## Quick Reference

```bash
# === Local Development ===
pnpm dev                    # Start dev server (uses .env)

# === E2E Testing Setup ===
createdb flashnote_test     # One-time: create test database
pnpm test:setup             # Migrate + seed test database
pnpm dev:test               # Start server for E2E tests

# === Database Commands ===
pnpm db:migrate             # Migrate dev database
pnpm db:migrate:test        # Migrate test database
pnpm db:seed:test           # Seed test user

# === Verify Environment ===
# Look for this output to confirm correct env:
# [env-loader] Loading from: .env.test (NODE_ENV=test)
# [env-loader] DATABASE_URL: postgres://localhost/flashnote_test

# === Generate Secrets ===
openssl rand -base64 48     # Run 3x for JWT_SECRET, JWT_REFRESH_SECRET, CSRF_SECRET
```
