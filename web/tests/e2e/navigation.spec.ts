import { test as baseTest, expect as baseExpect } from '@playwright/test';
import { test as authTest, expect as authExpect } from './fixtures/web';

/**
 * Navigation and routing E2E tests.
 *
 * Focus: Protected route redirects, auth-aware routing, cross-page flows.
 * These are security-critical tests for route protection.
 */

baseTest.describe('Protected Routes (Unauthenticated)', () => {
  baseTest('redirects /dashboard to /login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await baseExpect(page).toHaveURL('/login', { timeout: 10000 });
  });

  baseTest('redirects /dashboard/settings to /login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await baseExpect(page).toHaveURL('/login', { timeout: 10000 });
  });
});

authTest.describe('Authenticated Route Behavior', () => {
  authTest('login page redirects to dashboard when already authenticated', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/login');
    await authExpect(page).toHaveURL('/dashboard', { timeout: 15000 });
  });

  authTest('signup page redirects to dashboard when already authenticated', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/signup');
    await authExpect(page).toHaveURL('/dashboard', { timeout: 15000 });
  });

  authTest('dashboard is accessible when authenticated', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await authExpect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
      timeout: 15000,
    });
  });

  authTest('settings is accessible when authenticated', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard/settings');
    await authExpect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible({
      timeout: 15000,
    });
  });
});

baseTest.describe('Cross-Page Navigation Flows', () => {
  baseTest('complete signup-to-login navigation flow', async ({ page }) => {
    // Start at landing page
    await page.goto('/');

    // Navigate to signup
    await page.getByRole('link', { name: 'Get Started' }).click();
    await baseExpect(page).toHaveURL('/signup');

    // Navigate from signup to login
    await page.getByRole('link', { name: 'Sign in' }).click();
    await baseExpect(page).toHaveURL('/login');

    // Navigate from login to forgot password
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await baseExpect(page).toHaveURL('/forgot-password');

    // Navigate back to login
    await page.getByRole('link', { name: 'Back to login' }).click();
    await baseExpect(page).toHaveURL('/login');

    // Navigate to signup from login
    await page.getByRole('link', { name: 'create a new account' }).click();
    await baseExpect(page).toHaveURL('/signup');
  });
});
