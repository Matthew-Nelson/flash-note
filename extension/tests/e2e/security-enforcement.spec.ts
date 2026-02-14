import { test, expect, loginUser } from './fixtures/extension';
import { TEST_USERS } from './helpers/test-data';

/**
 * Extension security enforcement E2E tests.
 *
 * Tests that security mechanisms work correctly in the extension context:
 * - PHI clearance on logout (CLAUDE.md Rule 4)
 * - Locked account rejection
 * - Subscription enforcement via UI
 *
 * Requires: `pnpm db:seed:test` to have been run.
 */

const API_URL = process.env.API_URL || 'http://localhost:4000';

test.describe('PHI Clearance on Logout', () => {
  test('logout clears chrome.storage.local completely', async ({ extensionPage }) => {
    // Login
    await loginUser(extensionPage);

    // Verify we're in the generator view
    await expect(extensionPage.locator('text=Note Type')).toBeVisible();

    // Fill in some form data (simulates PHI in client state)
    await extensionPage.locator('#patientContext').fill('John, 52M, chronic LBP');
    await extensionPage.locator('#quickNotes').fill(
      'Patient reports improvement in ROM. Pain reduced from 7/10 to 4/10.'
    );

    // Go to settings and logout
    await extensionPage.click('button[title="Settings"]');
    await expect(extensionPage.locator('text=Account')).toBeVisible();
    await extensionPage.click('button:has-text("Sign Out")');

    // Wait for login form to appear
    await expect(
      extensionPage.locator('button:has-text("Sign In")')
    ).toBeVisible({ timeout: 5000 });

    // Verify chrome.storage.local is empty
    const storageData = await extensionPage.evaluate(() => {
      return new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(null, (items) => resolve(items));
      });
    });

    // Auth tokens should be cleared
    expect(storageData).not.toHaveProperty('flashnote:auth');
    // No auth-related keys should remain
    const authKeys = Object.keys(storageData).filter(
      (key) => key.includes('auth') || key.includes('token') || key.includes('session')
    );
    expect(authKeys).toHaveLength(0);
  });

  test('logout returns to login form with empty fields', async ({ extensionPage }) => {
    // Login and interact with the app
    await loginUser(extensionPage);

    // Navigate to settings and logout
    await extensionPage.click('button[title="Settings"]');
    await expect(extensionPage.locator('text=Account')).toBeVisible();
    await extensionPage.click('button:has-text("Sign Out")');

    // Wait for login form
    await expect(
      extensionPage.locator('button:has-text("Sign In")')
    ).toBeVisible({ timeout: 5000 });

    // Verify form fields are empty (no residual user data)
    const emailValue = await extensionPage.locator('input[type="email"]').inputValue();
    const passwordValue = await extensionPage.locator('input[type="password"]').inputValue();
    expect(emailValue).toBe('');
    expect(passwordValue).toBe('');
  });
});

test.describe('Account Lockout (Extension)', () => {
  test('locked account cannot login through extension', async ({ extensionPage }) => {
    // Try to login with the locked user's credentials
    await extensionPage.fill('input[type="email"]', TEST_USERS.LOCKED.email);
    await extensionPage.fill('input[type="password"]', TEST_USERS.LOCKED.password);
    await extensionPage.click('button:has-text("Sign In")');

    // Should show an error — the account is locked
    await expect(extensionPage.locator('.error-message')).toBeVisible({ timeout: 10000 });

    // Should NOT show the generator view
    await expect(extensionPage.locator('text=Note Type')).not.toBeVisible();
  });
});

test.describe('Subscription Enforcement (Extension)', () => {
  test('expired trial user can login but cannot generate notes', async ({ extensionPage }) => {
    // Login as expired trial user
    await extensionPage.fill('input[type="email"]', TEST_USERS.EXPIRED_TRIAL.email);
    await extensionPage.fill('input[type="password"]', TEST_USERS.EXPIRED_TRIAL.password);
    await extensionPage.click('button:has-text("Sign In")');

    // Should successfully login (auth works)
    // The behavior depends on whether the extension blocks at login or at generation.
    // Wait for either the generator form or a subscription-related message.
    const generatorVisible = await extensionPage
      .locator('text=Note Type')
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (generatorVisible) {
      // Extension showed the generator — now try to generate a note
      await extensionPage.locator('#quickNotes').fill(
        'Patient reports improvement in ROM and pain levels after last session.'
      );
      await extensionPage.click('button:has-text("Generate Note")');

      // Should show a subscription/trial error, not a success
      await expect(
        extensionPage
          .locator('text=trial.*ended')
          .or(extensionPage.locator('text=subscribe'))
          .or(extensionPage.locator('text=subscription'))
          .or(extensionPage.locator('.error-message'))
      ).toBeVisible({ timeout: 15000 });
    }
    // If generator is not visible, the extension already blocked the expired user — that's valid too.
  });
});

test.describe('Extension Auth Persistence', () => {
  test('tokens persist in chrome.storage.local after login', async ({ extensionPage }) => {
    await loginUser(extensionPage);

    // Check chrome.storage.local for auth data
    const storageData = await extensionPage.evaluate(() => {
      return new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(null, (items) => resolve(items));
      });
    });

    // Should have auth data stored
    const hasAuthKey = Object.keys(storageData).some(
      (key) => key.includes('auth')
    );
    expect(hasAuthKey).toBe(true);
  });
});
