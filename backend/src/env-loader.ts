/* eslint-disable no-console -- Startup diagnostic logging is intentional */
/**
 * Centralized Environment Loader
 *
 * This is the SINGLE source of truth for loading environment variables.
 * All entry points must import this file FIRST before any other modules.
 *
 * Entry points that import this:
 *   - src/index.ts (main server)
 *   - src/db/migrate.ts (standalone script)
 *   - src/db/seed-test.ts (standalone script, via dynamic import)
 *
 * File selection based on NODE_ENV:
 *   - NODE_ENV=test  -> loads .env.test
 *   - Otherwise      -> loads .env
 *
 * CI behavior:
 *   - When CI=true is set, we skip loading .env files entirely
 *   - CI environments (GitHub Actions) set env vars directly in workflows
 *   - This avoids conflicts between .env.test (local) and CI env vars
 *
 * Load priority (highest wins):
 *   1. Shell/command-line env vars (e.g., DATABASE_URL=... pnpm dev)
 *   2. .env file selected above (skipped in CI)
 *   3. Code defaults (in config.ts Zod schema)
 *
 * Production note: In production, env vars are set directly by the platform
 * (Cloud Run, etc.), so no .env file is needed or used.
 */

import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const isCI = process.env.CI === 'true';
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';

// Resolve .env path relative to this file's location (backend/src/env-loader.ts → backend/)
// Using import.meta.url instead of process.cwd() so the path is correct regardless of
// where the process is launched from (monorepo root, Docker, production platform, etc.)
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.resolve(backendRoot, envFile);

// In CI, env vars are set by the workflow - don't load from files
if (isCI) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[env-loader] CI detected - using workflow environment variables');
  }
} else {
  // Only log in non-production to avoid log noise
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[env-loader] Loading from: ${envPath} (NODE_ENV=${process.env.NODE_ENV || 'undefined'})`);
  }

  const result = dotenvConfig({ path: envPath });

  if (result.error) {
    // Zod validation in config.ts will catch missing required vars and crash with details.
    // This warning surfaces the root cause (file not found / parse error) so the developer
    // doesn't have to guess why DATABASE_URL or JWT_SECRET is missing.
    console.warn(`[env-loader] WARNING: Failed to load ${envFile}: ${result.error.message}`);
  }
}

// Debug: confirm critical env vars loaded (redact secrets)
if (process.env.NODE_ENV !== 'production') {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    // Show host/database but hide credentials
    const redacted = dbUrl.replace(/\/\/[^@]*@/, '//***@');
    console.log(`[env-loader] DATABASE_URL: ${redacted}`);
  } else {
    console.warn('[env-loader] WARNING: DATABASE_URL not set');
  }
}
