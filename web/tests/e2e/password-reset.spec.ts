import { test, expect } from '@playwright/test';

/**
 * Password reset flow E2E tests.
 *
 * Focus: Reset request flow, error states, navigation.
 * Deleted: Pure visibility checks for form elements/branding.
 */

test.describe('Forgot Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
  });

  test.describe('Password Reset Request', () => {
    test('shows success message after submitting email', async ({ page }) => {
      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByRole('button', { name: 'Send reset link' }).click();

      // Should show success regardless of whether email exists (security best practice)
      await expect(page.getByText('Check your email')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/password reset link/i)).toBeVisible();
    });

    test('shows success even for non-existent email (no enumeration)', async ({ page }) => {
      await page.getByLabel('Email address').fill('nonexistent@example.com');
      await page.getByRole('button', { name: 'Send reset link' }).click();

      // Should show same success message to prevent email enumeration
      await expect(page.getByText('Check your email')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Navigation', () => {
    test('back to login link works', async ({ page }) => {
      await page.getByRole('link', { name: 'Back to login' }).click();
      await expect(page).toHaveURL('/login');
    });
  });
});

test.describe('Reset Password Page', () => {
  test.describe('Invalid Token', () => {
    test('shows invalid link message when no token provided', async ({ page }) => {
      await page.goto('/reset-password');

      await expect(page.getByText('Invalid or Expired Link')).toBeVisible();
      await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
    });

    test('shows invalid link message for expired/bad token', async ({ page }) => {
      await page.goto('/reset-password?token=invalid-token-abc123');

      await expect(page.getByText('Invalid or Expired Link')).toBeVisible({ timeout: 10000 });
    });

    test('request new reset link navigates to forgot-password', async ({ page }) => {
      await page.goto('/reset-password?token=invalid-token-abc123');

      await page.getByRole('button', { name: 'Request a new reset link' }).click({ timeout: 10000 });
      await expect(page).toHaveURL('/forgot-password');
    });
  });
});
