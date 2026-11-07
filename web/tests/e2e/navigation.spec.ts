import { test, expect } from '@playwright/test';

import { SHARED_USER_STATE } from './fixtures/web';

/**
 * Navigation and routing E2E tests: protected-route redirects and auth-aware
 * routing. Route protection is security-critical (Rule 8).
 */

test.describe('Protected Routes (Unauthenticated)', () => {
  for (const path of [
    '/dashboard',
    '/dashboard/settings',
    '/dashboard/notes',
    '/dashboard/notes/new',
    '/dashboard/patients',
    '/dashboard/templates',
  ]) {
    test(`redirects ${path} to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL('/login');
    });
  }

  test('a forged session cookie is rejected by the server, not just the proxy', async ({ context, page }) => {
    // The proxy only checks that a cookie exists; getSession() must reject an unknown token
    await context.addCookies([
      { name: 'session_id', value: 'forged-token', domain: 'localhost', path: '/' },
    ]);
    await page.goto('/dashboard');
    // The message only appears on the server-rejection path (?reason=session_expired);
    // SessionAlert then strips the param, so the URL alone is racy.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Your session has expired. Please sign in again.')).toBeVisible();
  });
});

test.describe('Authenticated Route Behavior', () => {
  test.use({ storageState: SHARED_USER_STATE });

  test('login page redirects to dashboard when already authenticated', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL('/dashboard');
  });

  test('signup page redirects to dashboard when already authenticated', async ({ page }) => {
    await page.goto('/signup');
    await expect(page).toHaveURL('/dashboard');
  });

  test('settings is accessible when authenticated', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { name: 'Account Settings', level: 1 })).toBeVisible();
  });
});

test.describe('Cross-Page Navigation Flows', () => {
  test('landing → signup → login → forgot password → login → signup', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Get Started' }).click();
    await expect(page).toHaveURL('/signup');

    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/login');

    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL('/forgot-password');

    await page.getByRole('link', { name: 'Back to login' }).click();
    await expect(page).toHaveURL('/login');

    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL('/signup');
  });
});
