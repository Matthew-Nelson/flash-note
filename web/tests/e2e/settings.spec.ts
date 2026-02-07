import { test, expect } from './fixtures/web';

/**
 * Settings page E2E tests.
 *
 * Covers:
 * - Account information display
 * - Password change request
 * - Delete account flow
 * - Navigation (breadcrumbs, back link)
 *
 * Uses authenticatedPage fixture for pre-logged-in state.
 */

test.describe('Settings Page', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible({
      timeout: 15000,
    });
  });

  test.describe('Navigation', () => {
    test('shows breadcrumb with Dashboard link', async ({ authenticatedPage: page }) => {
      await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible();
      await expect(page.getByText('Settings').first()).toBeVisible();
    });

    test('breadcrumb Dashboard link navigates back', async ({ authenticatedPage: page }) => {
      await page.getByRole('link', { name: 'Dashboard' }).first().click();
      await expect(page).toHaveURL('/dashboard');
    });

    test('back to dashboard link navigates back', async ({ authenticatedPage: page }) => {
      await page.getByRole('link', { name: /Back to Dashboard/i }).click();
      await expect(page).toHaveURL('/dashboard');
    });

    test('shows user email and sign out in nav', async ({ authenticatedPage: page }) => {
      await expect(page.getByText('test@example.com')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    });
  });

  test.describe('Account Information', () => {
    test('displays account information section', async ({ authenticatedPage: page }) => {
      await expect(page.getByRole('heading', { name: 'Account Information' })).toBeVisible();
    });

    test('shows user email', async ({ authenticatedPage: page }) => {
      const accountSection = page.locator('text=Account Information').locator('..');
      await expect(accountSection.getByText('test@example.com')).toBeVisible();
    });

    test('shows email verification status', async ({ authenticatedPage: page }) => {
      await expect(page.getByText('Email Status')).toBeVisible();
      // Should show either "Verified" or "Not verified"
      const statusText = page.getByText(/verified|not verified/i);
      await expect(statusText).toBeVisible();
    });

    test('shows subscription status', async ({ authenticatedPage: page }) => {
      const subscriptionLabel = page.getByText('Subscription').first();
      await expect(subscriptionLabel).toBeVisible();
    });
  });

  test.describe('Change Password', () => {
    test('displays change password section', async ({ authenticatedPage: page }) => {
      await expect(page.getByRole('heading', { name: 'Change Password' })).toBeVisible();
      await expect(
        page.getByText(/send a password reset link/i)
      ).toBeVisible();
    });

    test('shows send password reset email button', async ({ authenticatedPage: page }) => {
      await expect(
        page.getByRole('button', { name: 'Send Password Reset Email' })
      ).toBeVisible();
    });

    test('clicking button sends password reset email', async ({ authenticatedPage: page }) => {
      await page.getByRole('button', { name: 'Send Password Reset Email' }).click();

      // Should show success message
      await expect(
        page.getByText(/password reset email sent/i)
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Danger Zone', () => {
    test('displays danger zone section', async ({ authenticatedPage: page }) => {
      await expect(page.getByRole('heading', { name: 'Danger Zone' })).toBeVisible();
      await expect(page.getByText(/no going back/i)).toBeVisible();
    });

    test('shows delete account button', async ({ authenticatedPage: page }) => {
      await expect(
        page.getByRole('button', { name: 'Delete Account' })
      ).toBeVisible();
    });

    test('clicking delete shows confirmation with contact support info', async ({
      authenticatedPage: page,
    }) => {
      await page.getByRole('button', { name: 'Delete Account' }).click();

      await expect(page.getByText(/are you sure/i)).toBeVisible();
      await expect(page.getByText('support@flashnote.com')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Contact Support' })).toBeVisible();
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
