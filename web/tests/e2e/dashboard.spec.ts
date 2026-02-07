import { test, expect } from './fixtures/web';

/**
 * Dashboard E2E tests.
 *
 * Focus: Navigation works, sign out flow, protected route behavior.
 * Deleted: Pure visibility checks for dashboard content/cards.
 */

test.describe('Dashboard', () => {
  test.describe('Navigation', () => {
    test('settings link navigates to settings page', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('link', { name: 'Settings' }).click();
      await expect(page).toHaveURL('/dashboard/settings');
    });
  });

  test.describe('Sign Out', () => {
    test('sign out button logs out and redirects to login', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: 'Sign out' }).click();

      await expect(page).toHaveURL('/login', { timeout: 10000 });
    });

    test('cannot access dashboard after sign out', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: 'Sign out' }).click();
      await expect(page).toHaveURL('/login', { timeout: 10000 });

      // Attempting to navigate back to dashboard should redirect to login
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/login', { timeout: 10000 });
    });
  });
});
