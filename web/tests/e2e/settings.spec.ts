import { test, expect } from '@playwright/test';

import { SHARED_USER_STATE, signInNewUser } from './fixtures/web';

/**
 * Settings page E2E tests.
 */

test.describe('Settings Page', () => {
  test.use({ storageState: SHARED_USER_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { name: 'Account Settings', level: 1 })).toBeVisible();
  });

  test('back link returns to the dashboard', async ({ page }) => {
    await page.getByRole('link', { name: 'Go back' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('clicking delete shows confirmation with the support contact', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete Account' }).click();

    await expect(page.getByText('Are you sure you want to delete your account?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'support@flashnote.co' })).toBeVisible();
  });

  test('cancel hides the delete confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete Account' }).click();
    await expect(page.getByText('Are you sure you want to delete your account?')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Are you sure you want to delete your account?')).toHaveCount(0);
  });
});

test.describe('Settings actions with their own account', () => {
  test('shows the signed-in account email', async ({ page }) => {
    const user = await signInNewUser(page, { label: 'settings-email' });
    await page.goto('/dashboard/settings');

    await expect(page.getByRole('main').getByText(user.email)).toBeVisible();
  });

  test('clicking the button sends a password reset email', async ({ page }) => {
    await signInNewUser(page, { label: 'settings-reset' });
    await page.goto('/dashboard/settings');

    await page.getByRole('button', { name: 'Send Password Reset Email' }).click();
    await expect(page.getByText('Password reset email sent! Check your inbox for the reset link.')).toBeVisible();
  });

  test('sign out from settings page works', async ({ page }) => {
    await signInNewUser(page, { label: 'settings-signout' });
    await page.goto('/dashboard/settings');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');
  });
});
