import { test, expect, loginUser, TEST_USER } from './fixtures/extension';

/**
 * Settings E2E Tests
 *
 * Tests the settings view and account management features.
 */

test.describe('Settings', () => {
  // Login before each test in this suite
  test.beforeEach(async ({ extensionPage }) => {
    await loginUser(extensionPage);
  });

  test.describe('Settings Navigation', () => {
    test('can open settings from header', async ({ extensionPage }) => {
      // Click settings button in header
      await extensionPage.click('button[title="Settings"]');

      // Should show settings view
      await expect(extensionPage.locator('text=Account')).toBeVisible();
    });

    test('can close settings and return to generator', async ({
      extensionPage,
    }) => {
      // Open settings
      await extensionPage.click('button[title="Settings"]');
      await expect(extensionPage.locator('text=Account')).toBeVisible();

      // Click settings button again to close
      await extensionPage.click('button[title="Settings"]');

      // Should return to generator
      await expect(extensionPage.locator('#quickNotes')).toBeVisible();
    });
  });

  test.describe('Account Information', () => {
    test('displays user email', async ({ extensionPage }) => {
      await extensionPage.click('button[title="Settings"]');

      // Should show user's email
      await expect(
        extensionPage.locator(`text=${TEST_USER.email}`)
      ).toBeVisible();
    });

    test('displays subscription status', async ({ extensionPage }) => {
      await extensionPage.click('button[title="Settings"]');

      // Should show subscription info section
      // Look for the Subscription heading specifically
      await expect(
        extensionPage.locator('h2:has-text("Subscription")')
      ).toBeVisible();

      // Should show trial or subscription status
      await expect(
        extensionPage.locator('text=/trial|active|expired/i').first()
      ).toBeVisible();
    });
  });

  test.describe('Sign Out', () => {
    test('shows sign out button', async ({ extensionPage }) => {
      await extensionPage.click('button[title="Settings"]');

      await expect(
        extensionPage.locator('button:has-text("Sign Out")')
      ).toBeVisible();
    });

    test('sign out returns to login', async ({ extensionPage }) => {
      await extensionPage.click('button[title="Settings"]');
      await extensionPage.click('button:has-text("Sign Out")');

      // Should return to login form
      await expect(
        extensionPage.locator('button:has-text("Sign In")')
      ).toBeVisible({ timeout: 5000 });
    });

    test('sign out clears authentication state', async ({
      extensionPage,
      extensionId,
      context,
    }) => {
      // Sign out
      await extensionPage.click('button[title="Settings"]');
      await extensionPage.click('button:has-text("Sign Out")');

      // Wait for login form
      await expect(
        extensionPage.locator('button:has-text("Sign In")')
      ).toBeVisible({ timeout: 5000 });

      // Reload page
      await extensionPage.reload();

      // Should still show login form (not auto-login)
      await expect(
        extensionPage.locator('button:has-text("Sign In")')
      ).toBeVisible({ timeout: 5000 });
    });
  });
});
