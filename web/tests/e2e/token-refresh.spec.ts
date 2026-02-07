import { test, expect } from '@playwright/test';

/**
 * Token Refresh Flow E2E Tests
 *
 * Tests the automatic JWT token refresh mechanism:
 * - Token structure is stored correctly after login
 * - Session persists across page navigations
 * - Sign out clears tokens
 *
 * Note: Testing actual token refresh requires forcing token expiry,
 * which is complex in E2E. These tests verify the token infrastructure works.
 */

const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123',
};

test.describe('Token Storage', () => {
  test('stores auth tokens after successful login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // Verify auth data structure in sessionStorage
    const authData = await page.evaluate(() => {
      const stored = sessionStorage.getItem('flashnote:auth');
      return stored ? JSON.parse(stored) : null;
    });

    expect(authData).not.toBeNull();
    expect(authData.accessToken).toBeDefined();
    expect(authData.refreshToken).toBeDefined();
    expect(authData.csrfToken).toBeDefined();
    expect(authData.expiresAt).toBeDefined();
    expect(authData.user).toBeDefined();
    expect(authData.user.email).toBe(TEST_USER.email);
  });

  test('expiresAt is set to approximately 55 minutes in the future', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    const authData = await page.evaluate(() => {
      const stored = sessionStorage.getItem('flashnote:auth');
      return stored ? JSON.parse(stored) : null;
    });

    // expiresAt should be ~55 minutes from now (55 * 60 * 1000 = 3,300,000 ms)
    const now = Date.now();
    const expectedExpiry = now + 55 * 60 * 1000;
    const tolerance = 60000; // 1 minute tolerance

    expect(authData.expiresAt).toBeGreaterThan(now);
    expect(authData.expiresAt).toBeLessThan(expectedExpiry + tolerance);
    expect(authData.expiresAt).toBeGreaterThan(expectedExpiry - tolerance);
  });
});

test.describe('Session Persistence', () => {
  test('maintains session across page navigations', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // Navigate to multiple protected pages
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible({
      timeout: 15000,
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
      timeout: 15000,
    });

    // Visit public page
    await page.goto('/pricing');
    // Should show authenticated state (Dashboard link instead of Sign In)
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    // Return to protected page - should still work
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
      timeout: 15000,
    });
  });

  test('tokens persist in sessionStorage during navigation', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // Get initial tokens
    const initialAuth = await page.evaluate(() => {
      const stored = sessionStorage.getItem('flashnote:auth');
      return stored ? JSON.parse(stored) : null;
    });

    // Navigate around
    await page.goto('/dashboard/settings');
    await page.goto('/pricing');
    await page.goto('/dashboard');

    // Get tokens again
    const finalAuth = await page.evaluate(() => {
      const stored = sessionStorage.getItem('flashnote:auth');
      return stored ? JSON.parse(stored) : null;
    });

    // Tokens should be the same (no refresh triggered)
    expect(finalAuth.accessToken).toBe(initialAuth.accessToken);
    expect(finalAuth.refreshToken).toBe(initialAuth.refreshToken);
  });
});

test.describe('Sign Out', () => {
  test('clears tokens from sessionStorage on sign out', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // Verify tokens exist
    let authData = await page.evaluate(() => {
      return sessionStorage.getItem('flashnote:auth');
    });
    expect(authData).not.toBeNull();

    // Sign out
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login', { timeout: 10000 });

    // Verify tokens are cleared
    authData = await page.evaluate(() => {
      return sessionStorage.getItem('flashnote:auth');
    });
    expect(authData).toBeNull();
  });

  test('cannot access protected routes after sign out', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // Sign out
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login', { timeout: 10000 });

    // Try to access protected route
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });
});

test.describe('Auth Context', () => {
  test('user data is available in authenticated state', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // User email should be displayed in the nav
    await expect(page.getByText(TEST_USER.email).first()).toBeVisible();
  });

  test('dashboard shows user-specific data', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(TEST_USER.email);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // Settings page should show the user's email
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible({
      timeout: 15000,
    });

    // The settings page shows the email in the Account Information section
    const emailInSettings = page.getByText(TEST_USER.email);
    await expect(emailInSettings.first()).toBeVisible();
  });
});
