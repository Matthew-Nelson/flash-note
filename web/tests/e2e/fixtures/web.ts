import { test as base, type Page } from '@playwright/test';

/**
 * Custom Playwright fixtures for FlashNote web app E2E testing.
 *
 * Provides:
 * - Authenticated page fixture (auto-login)
 * - Login/logout helpers
 * - Session storage helpers
 */

// Test user credentials (must match seeded test data in backend)
export const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123',
};

// API URL for direct backend calls (token setup, etc.)
const API_URL = process.env.API_URL || 'http://localhost:4000';

/**
 * Extended test fixtures for web app testing.
 *
 * `authenticatedPage` provides a page that is already logged in,
 * with valid auth tokens injected into sessionStorage.
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  /**
   * A page fixture that is pre-authenticated via the backend API.
   * Logs in via API, injects tokens into sessionStorage, then navigates.
   */
  authenticatedPage: async ({ page }, use) => {
    // Login via API to get tokens
    const response = await page.request.post(`${API_URL}/auth/login`, {
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    const body = await response.json();

    if (!body.success) {
      throw new Error(`Test login failed: ${JSON.stringify(body.error)}`);
    }

    const { accessToken, refreshToken, csrfToken, user } = body.data;

    // Calculate expiry (55 minutes - matches ACCESS_TOKEN_EXPIRY_MS in web/src/lib/api.ts)
    const expiresAt = Date.now() + 55 * 60 * 1000;

    // Navigate to the app first (required before setting sessionStorage)
    const baseURL = process.env.WEB_URL || 'http://localhost:3000';
    await page.goto(baseURL);

    // Inject auth state into sessionStorage as a single JSON object.
    // Must match the StoredAuth interface used by web/src/lib/storage.ts
    // Key: "flashnote:auth", Value: { user, accessToken, refreshToken, csrfToken, expiresAt }
    await page.evaluate(
      (authData) => {
        sessionStorage.setItem('flashnote:auth', JSON.stringify(authData));
      },
      { accessToken, refreshToken, csrfToken, user, expiresAt }
    );

    await use(page);
  },
});

export const expect = test.expect;

/**
 * Helper to log in a user through the UI login form.
 * Use this when testing the actual login flow.
 */
export async function loginViaUI(
  page: Page,
  credentials: { email: string; password: string } = TEST_USER
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for navigation to dashboard
  await page.waitForURL('/dashboard', { timeout: 15000 });
}

/**
 * Helper to clear sessionStorage (logout state).
 */
export async function clearSession(page: Page): Promise<void> {
  await page.evaluate(() => {
    sessionStorage.clear();
  });
}

/**
 * Helper to check if a page has valid auth tokens in sessionStorage.
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return !!sessionStorage.getItem('flashnote:auth');
  });
}

/**
 * Helper to authenticate as any seeded test user via the backend API.
 * Returns the auth tokens and user data (does NOT inject into sessionStorage).
 * Use this when you need tokens for direct API calls or custom injection.
 */
export async function loginViaAPI(
  page: Page,
  credentials: { email: string; password: string }
): Promise<{
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  user: Record<string, unknown>;
}> {
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: { email: credentials.email, password: credentials.password },
  });

  const body = await response.json();
  if (!body.success) {
    throw new Error(`API login failed for ${credentials.email}: ${JSON.stringify(body.error)}`);
  }

  return body.data;
}

/**
 * Helper to inject auth tokens into sessionStorage for a given user.
 * Combines loginViaAPI + sessionStorage injection.
 * Use this when you need an authenticated page for a non-primary user.
 */
export async function authenticateAs(
  page: Page,
  credentials: { email: string; password: string }
): Promise<void> {
  const { accessToken, refreshToken, csrfToken, user } = await loginViaAPI(page, credentials);
  const expiresAt = Date.now() + 55 * 60 * 1000;

  const baseURL = process.env.WEB_URL || 'http://localhost:3000';
  await page.goto(baseURL);

  await page.evaluate(
    (authData) => {
      sessionStorage.setItem('flashnote:auth', JSON.stringify(authData));
    },
    { accessToken, refreshToken, csrfToken, user, expiresAt }
  );
}
