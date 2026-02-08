import { test, expect } from './fixtures/web';

/**
 * Settings page E2E tests.
 *
 * Focus: Navigation, password reset flow, delete account modal, sign out.
 * Deleted: Pure visibility checks for section headings/labels.
 */

test.describe('Settings Page', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible({
      timeout: 15000,
    });
  });

  test.describe('Navigation', () => {
    test('breadcrumb Dashboard link navigates back', async ({ authenticatedPage: page }) => {
      await page.getByRole('link', { name: 'Dashboard' }).first().click();
      await expect(page).toHaveURL('/dashboard');
    });

    test('back to dashboard link navigates back', async ({ authenticatedPage: page }) => {
      await page.getByRole('link', { name: /Back to Dashboard/i }).click();
      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('Change Password', () => {
    test('clicking button sends password reset email', async ({ authenticatedPage: page }) => {
      await page.getByRole('button', { name: 'Send Password Reset Email' }).click();

      await expect(
        page.getByText(/password reset email sent/i)
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Danger Zone', () => {
    test('clicking delete shows confirmation modal', async ({ authenticatedPage: page }) => {
      await page.getByRole('button', { name: 'Delete Account' }).click();

      await expect(page.getByText(/are you sure/i)).toBeVisible();
      await expect(page.getByText('support@flashnote.co')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    });

    test('cancel hides the delete confirmation', async ({ authenticatedPage: page }) => {
      await page.getByRole('button', { name: 'Delete Account' }).click();
      await expect(page.getByText(/are you sure/i)).toBeVisible();

      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByText(/are you sure/i)).not.toBeVisible();
    });
  });

  test.describe('Sign Out', () => {
    test('sign out from settings page works', async ({ authenticatedPage: page }) => {
      await page.getByRole('button', { name: 'Sign out' }).click();
      await expect(page).toHaveURL('/login', { timeout: 10000 });
    });
  });
});
