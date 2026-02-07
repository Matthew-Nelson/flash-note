import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright configuration for FlashNote Web App E2E tests.
 *
 * Unlike the extension tests (single worker, persistent context),
 * web tests use standard browser contexts and can run in parallel.
 *
 * Running tests:
 * - Local: `pnpm test:e2e` (automatically starts backend + Next.js dev server)
 * - CI: Backend and web server are started separately by .github/workflows/e2e.yml
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Web tests can run in parallel (unlike extension tests)
  fullyParallel: true,

  // Fail CI if .only() is left in tests
  forbidOnly: !!process.env.CI,

  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,

  // Use half the available CPUs in CI, more locally
  workers: process.env.CI ? 2 : undefined,

  // Reporter configuration
  reporter: process.env.CI ? 'github' : 'html',

  // Global test timeout
  timeout: 30000,

  // Expect timeout for assertions
  expect: {
    timeout: 10000,
  },

  use: {
    // Base URL for web app
    baseURL: process.env.WEB_URL || 'http://localhost:3000',

    // Capture trace on first retry for debugging
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on first retry
    video: 'on-first-retry',
  },

  // Output directory for test artifacts
  outputDir: './test-results',

  // Multi-browser test matrix
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Server lifecycle (local development only)
  // In CI, servers are started separately by the workflow
  webServer: process.env.CI
    ? undefined
    : [
        // Start the backend API
        {
          command: 'NODE_ENV=test pnpm dev',
          cwd: path.join(__dirname, '../backend'),
          port: 4000,
          reuseExistingServer: true,
          timeout: 120000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
        // Start the Next.js dev server
        {
          command: 'pnpm dev',
          cwd: __dirname,
          port: 3000,
          reuseExistingServer: true,
          timeout: 120000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      ],
});
