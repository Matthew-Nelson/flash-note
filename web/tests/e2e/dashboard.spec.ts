import { test, expect } from './fixtures/web';

/**
 * Dashboard E2E tests.
 *
 * Covers:
 * - Dashboard content display (usage, subscription, getting started)
 * - Navigation elements
 * - Sign out flow
 * - Subscription status display
 *
 * Uses authenticatedPage fixture for pre-logged-in state.
 */

test.describe('Dashboard', () => {
  test.describe('Page Content', () => {
    test('displays dashboard heading', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
    });

    test('displays usage card with notes count', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByText('Usage This Month')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('SOAP notes generated')).toBeVisible();
    });

    test('displays subscription card', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByText('Subscription')).toBeVisible({ timeout: 15000 });
    });

    test('displays getting started section', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/Chrome extension/i)).toBeVisible();
      await expect(page.getByText(/Start generating SOAP notes/i)).toBeVisible();
    });

    test('displays support section', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: /Need Help/i })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('link', { name: 'Contact Support' })).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('shows FlashNote branding in nav', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByText('FlashNote').first()).toBeVisible({ timeout: 15000 });
    });

    test('shows user email in nav', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByText('test@example.com')).toBeVisible({ timeout: 15000 });
    });

    test('shows settings link', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    });

    test('settings link navigates to settings page', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('link', { name: 'Settings' }).click();
      await expect(page).toHaveURL('/dashboard/settings');
    });

    test('shows sign out button', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
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

  test.describe('Subscription Status', () => {
    test('displays subscription badge', async ({ authenticatedPage: page }) => {
      await page.goto('/dashboard');
      await expect(page.getByText('Subscription')).toBeVisible({ timeout: 15000 });
      // The test user should have some subscription status badge displayed
      const subscriptionCard = page.locator('text=Subscription').locator('..');
      await expect(subscriptionCard).toBeVisible();
    });
  });
});
