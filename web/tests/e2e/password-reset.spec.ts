import { test, expect } from '@playwright/test';

import { fill, loginViaUI } from './fixtures/web';
import { createUser, issueEmailToken } from './helpers/db';

/**
 * Password reset E2E tests: the request form, invalid links, and a full reset
 * using a real token stored the way the app stores it.
 */

test.describe('Forgot Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
  });

  test('shows success message after submitting email', async ({ page }) => {
    const user = await createUser({ label: 'forgot' });
    await fill(page.getByLabel('Email address'), user.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  });

  test('shows the same success for a non-existent email (no enumeration)', async ({ page }) => {
    await fill(page.getByLabel('Email address'), 'nonexistent@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  });

  test('back to login link works', async ({ page }) => {
    await page.getByRole('link', { name: 'Back to login' }).click();
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Reset Password Page', () => {
  test('shows invalid link message when no token provided', async ({ page }) => {
    await page.goto('/reset-password');

    await expect(page.getByRole('heading', { name: 'Invalid or Expired Link' })).toBeVisible();
  });

  test('shows invalid link message for an unknown token', async ({ page }) => {
    await page.goto('/reset-password?token=invalid-token-abc123');

    await expect(page.getByRole('heading', { name: 'Invalid or Expired Link' })).toBeVisible();
  });

  test('request new reset link navigates to forgot-password', async ({ page }) => {
    await page.goto('/reset-password?token=invalid-token-abc123');

    await page.getByRole('link', { name: 'Request a new reset link' }).click();
    await expect(page).toHaveURL('/forgot-password');
  });

  test('a valid link sets a new password, replaces the old one, and is single-use', async ({ page }) => {
    const user = await createUser({ label: 'reset' });
    const token = await issueEmailToken(user.id, 'password_reset');
    const newPassword = 'BrandNewPass9';

    await page.goto(`/reset-password?token=${token}`);
    await fill(page.getByLabel('New password', { exact: true }), newPassword);
    await fill(page.getByLabel('Confirm new password'), newPassword);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.getByRole('heading', { name: 'Password Reset Successfully' })).toBeVisible();

    // The old password no longer works
    await page.goto('/login');
    await fill(page.getByLabel('Email address'), user.email);
    await fill(page.getByLabel('Password'), user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Invalid email or password.')).toBeVisible();

    // The new one does
    await loginViaUI(page, { email: user.email, password: newPassword });

    // And the link can't be used again
    await page.context().clearCookies();
    await page.goto(`/reset-password?token=${token}`);
    await expect(page.getByRole('heading', { name: 'Invalid or Expired Link' })).toBeVisible();
  });

  test('resetting the password signs out existing sessions', async ({ browser, page }) => {
    const user = await createUser({ label: 'reset-sessions' });
    const otherDevice = await browser.newContext();
    const otherPage = await otherDevice.newPage();
    await loginViaUI(otherPage, user);

    const token = await issueEmailToken(user.id, 'password_reset');
    await page.goto(`/reset-password?token=${token}`);
    await fill(page.getByLabel('New password', { exact: true }), 'BrandNewPass9');
    await fill(page.getByLabel('Confirm new password'), 'BrandNewPass9');
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.getByRole('heading', { name: 'Password Reset Successfully' })).toBeVisible();

    await otherPage.goto('/dashboard');
    await expect(otherPage).toHaveURL(/\/login/);
    await otherDevice.close();
  });
});
