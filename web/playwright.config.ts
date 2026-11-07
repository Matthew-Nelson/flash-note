import { defineConfig, devices } from '@playwright/test';

import { E2E_BASE_URL, E2E_DATABASE_URL, E2E_PORT } from './tests/e2e/setup/env';

/**
 * Playwright configuration for FlashNote web E2E tests.
 *
 * `pnpm test:e2e` recreates the flashnote_e2e database, then starts its own
 * `next dev` on port 3100 against it. The same path runs locally and in CI.
 */
export default defineConfig({
  testDir: './tests/e2e',

  fullyParallel: true,

  // Fail CI if .only() is left in tests
  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 2 : undefined,

  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',

  // The dev server compiles each route on first request, so the first test to
  // hit a route pays for the compile.
  timeout: 60000,

  expect: {
    timeout: 10000,
  },

  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  outputDir: './test-results',

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      // Single browser: Chrome covers 95%+ of PT users
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'pnpm exec tsx tests/e2e/setup/prepare-db.ts && pnpm exec next dev --port ' + E2E_PORT,
    url: E2E_BASE_URL,
    // Always start fresh: a reused server would keep the previous run's data
    // and might be a developer's server pointed at the dev database.
    reuseExistingServer: false,
    timeout: 180000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // Next skips .env.local when NODE_ENV=test, so a developer's real Stripe,
      // Upstash, Resend and Gemini keys never reach the e2e server.
      NODE_ENV: 'test',
      // A separate build dir: Next allows one `next dev` per dir, and this lets
      // the suite run while a developer's own dev server is up.
      NEXT_DIST_DIR: '.next-e2e',
      DISABLE_DEV_INDICATORS: 'true',
      DATABASE_URL: E2E_DATABASE_URL,
      E2E_DATABASE_URL,
      WEB_URL: E2E_BASE_URL,
      USE_MOCK_AI: 'true',
      REGISTRATION_MODE: 'open',
      // No proxy in front of the dev server
      TRUSTED_PROXY_COUNT: '0',
      LOG_LEVEL: 'warn',
    },
  },
});
