import {
  test as base,
  chromium,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Custom Playwright fixtures for Chrome extension testing.
 *
 * Chrome extensions require special handling:
 * 1. Must use persistent context (not regular browser context)
 * 2. Must pass --load-extension and --disable-extensions-except flags
 * 3. Must use chromium channel for headless support
 * 4. Extension ID is extracted from service worker URL
 *
 * Headless mode:
 * - The `chromium` channel supports headless extension testing (since Playwright 1.21+)
 * - Headless is enabled by default for CI performance
 * - Use `--headed` flag for local debugging: `pnpm test:e2e --headed`
 */

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect if running in headed mode (via --headed CLI flag or HEADED env var)
const isHeaded = process.argv.includes('--headed') || process.env.HEADED === 'true';

// Path to built extension (dist folder)
const EXTENSION_PATH = path.join(__dirname, '../../../dist');

// Test user credentials (must match seeded test data)
export const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123',
};

// Extended test type with extension-specific fixtures
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  extensionPage: Page;
}>({
  /**
   * Custom browser context that loads the extension.
   * Overrides the default context fixture.
   */
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      // Headless mode works with extensions when using 'chromium' channel
      // Use --headed flag for local debugging: pnpm test:e2e --headed
      headless: !isHeaded,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        // Disable various Chrome features that can interfere with tests
        '--disable-background-networking',
        '--disable-client-side-phishing-detection',
        '--disable-default-apps',
        '--disable-hang-monitor',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
      ],
    });

    await use(context);
    await context.close();
  },

  /**
   * Extract the extension ID from the service worker URL.
   * For Manifest V3, we use serviceWorkers() instead of backgroundPages().
   */
  extensionId: async ({ context }, use) => {
    // Wait for service worker to be available
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', {
        timeout: 30000,
      });
    }

    // Extension ID is the third segment of the service worker URL
    // e.g., chrome-extension://abcdefghijklmnop/background/service-worker.js
    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  },

  /**
   * Pre-configured page pointing to the extension's side panel.
   * Most tests will use this as the starting point.
   */
  extensionPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);

    // Wait for React to hydrate
    await page.waitForLoadState('domcontentloaded');

    await use(page);
  },
});

export const expect = test.expect;

/**
 * Helper to login a user in the extension.
 * Use this in test.beforeEach() when tests require authenticated state.
 */
export async function loginUser(
  page: Page,
  credentials: { email: string; password: string } = TEST_USER
): Promise<void> {
  // Fill login form
  await page.fill('input[type="email"]', credentials.email);
  await page.fill('input[type="password"]', credentials.password);
  await page.click('button:has-text("Sign In")');

  // Wait for navigation to generator view
  await expect(page.locator('text=Note Type')).toBeVisible({ timeout: 15000 });
}

/**
 * Helper to clear extension storage between tests.
 * Useful for ensuring clean state.
 */
export async function clearExtensionStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.clear(() => resolve());
    });
  });
}
