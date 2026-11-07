import { test, expect } from '@playwright/test';

import { fill, loginViaUI } from './fixtures/web';
import { createUser, findUserByEmail, issueEmailToken } from './helpers/db';

/**
 * Email verification E2E tests: real tokens through verifyEmailAction, the
 * resend form, and the server-side gate that keeps unverified accounts out of
 * the dashboard (Rule 8).
 */

test.describe('Verify Email Page', () => {
  test('shows error when no token provided', async ({ page }) => {
    await page.goto('/verify-email');

    await expect(page.getByRole('heading', { name: 'Verification Failed' })).toBeVisible();
    await expect(page.getByText('No verification token provided')).toBeVisible();
  });

  test('shows error for an unknown token and links to resend', async ({ page }) => {
    await page.goto('/verify-email?token=invalid-token-abc123');

    await expect(page.getByRole('heading', { name: 'Verification Failed' })).toBeVisible();
    await page.getByRole('link', { name: 'Request a new verification link' }).click();
    await expect(page).toHaveURL('/resend-verification');
  });

  test('a valid link verifies the account, and reusing it reports already verified', async ({ page }) => {
    const user = await createUser({ label: 'verify', emailVerified: false });
    const token = await issueEmailToken(user.id, 'email_verification');

    await page.goto(`/verify-email?token=${token}`);
    await expect(page.getByRole('heading', { name: 'Email Verified!' })).toBeVisible();
    expect((await findUserByEmail(user.email))?.emailVerified).toBe(true);

    await page.goto(`/verify-email?token=${token}`);
    await expect(page.getByRole('heading', { name: 'Already Verified' })).toBeVisible();
  });

  test('a verified account can reach the dashboard it was locked out of', async ({ page }) => {
    const user = await createUser({ label: 'verify-gate', emailVerified: false });

    // Unverified: login sends the user to check-email, and the dashboard refuses them
    await page.goto('/login');
    await fill(page.getByLabel('Email address'), user.email);
    await fill(page.getByLabel('Password'), user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/check-email');
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/resend-verification');

    const token = await issueEmailToken(user.id, 'email_verification');
    await page.goto(`/verify-email?token=${token}`);
    await expect(page.getByRole('heading', { name: 'Email Verified!' })).toBeVisible();

    // The page redirects a verified, signed-in user on to the dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  });
});

test.describe('Resend Verification Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/resend-verification');
  });

  test('shows success after submitting an unverified email', async ({ page }) => {
    const user = await createUser({ label: 'resend', emailVerified: false });
    await fill(page.getByLabel('Email address'), user.email);
    await page.getByRole('button', { name: 'Send verification email' }).click();

    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByText('The link will expire in 24 hours.')).toBeVisible();
  });

  test('shows the same success for a non-existent email (no enumeration)', async ({ page }) => {
    await fill(page.getByLabel('Email address'), 'nonexistent@example.com');
    await page.getByRole('button', { name: 'Send verification email' }).click();

    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  });

  test('back to login link works', async ({ page }) => {
    await page.getByRole('link', { name: 'Back to login' }).click();
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Verified accounts', () => {
  test('settings shows the account as verified', async ({ page }) => {
    const user = await createUser({ label: 'verified-settings' });
    await loginViaUI(page, user);

    await page.goto('/dashboard/settings');
    await expect(page.getByText('Verified', { exact: true })).toBeVisible();
  });
});
