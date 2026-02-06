import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for FlashNote Chrome Extension E2E tests.
 *
 * Key considerations for extension testing:
 * - Extensions require persistent context (handled in fixtures)
 * - Single worker to avoid conflicts with extension state
 * - Chromium channel required for headless extension support
 *
 * Note: The backend server is started separately in CI (see .github/workflows/e2e.yml)
 * and should be started manually for local development.
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Extensions don't parallelize well - use single worker
  fullyParallel: false,
  workers: 1,

  // Fail CI if .only() is left in tests
  forbidOnly: !!process.env.CI,

  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: process.env.CI ? 'github' : 'html',

  // Global test timeout
  timeout: 30000,

  // Expect timeout for assertions
  expect: {
    timeout: 10000,
  },

  use: {
    // Capture trace on first retry for debugging
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on first retry
    video: 'on-first-retry',

    // Base URL for API calls (used by helpers)
    baseURL: process.env.API_URL || 'http://localhost:4000',
  },

  // Output directory for test artifacts
  outputDir: './test-results',

  // Projects configuration
  projects: [
    {
      name: 'chromium',
      use: {
        // Chromium channel is required for extension headless support
        channel: 'chromium',
      },
    },
  ],

  // Note: Backend server is started separately
  // - CI: Started by .github/workflows/e2e.yml before tests run
  // - Local: Start manually with `cd backend && pnpm dev`
});
