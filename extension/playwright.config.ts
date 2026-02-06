import { defineConfig } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for FlashNote Chrome Extension E2E tests.
 *
 * Key considerations for extension testing:
 * - Extensions require persistent context (handled in fixtures)
 * - Single worker to avoid conflicts with extension state
 * - Chromium channel required for headless extension support
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

  // Web server configuration for CI
  // In CI, we start the backend before running tests
  // Locally, you should start the backend manually
  webServer: process.env.CI
    ? {
        command: 'pnpm --filter backend dev',
        port: 4000,
        reuseExistingServer: false,
        cwd: path.join(__dirname, '..'),
        env: {
          DATABASE_URL:
            process.env.DATABASE_URL ||
            'postgres://test:test@localhost:5432/flashnote_test',
          JWT_SECRET: process.env.JWT_SECRET || 'test-secret-for-ci',
          NODE_ENV: 'test',
          PORT: '4000',
        },
        timeout: 120000,
      }
    : undefined,
});
