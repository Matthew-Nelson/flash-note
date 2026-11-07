/**
 * Shared e2e environment values, read by the Playwright config, the database
 * reset script, and the test-side database helpers so they always agree.
 */

// Postgres.app accepts the local OS user without a password; CI overrides this.
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://localhost:5432/flashnote_e2e';

// Not 3000, so the suite never reuses a developer's `pnpm dev` server
// (which points at the dev database).
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);

export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
