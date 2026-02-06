import { test, expect, TEST_USER, loginUser } from './fixtures/extension';

/**
 * Authentication E2E Tests
 *
 * Tests the login, registration, and logout flows in the extension.
 * Requires backend to be running with a seeded test user.
 */

test.describe('Authentication', () => {
  test.describe('Login Form Display', () => {
    test('shows login form when not authenticated', async ({ extensionPage }) => {
      // Should show FlashNote branding
      await expect(extensionPage.locator('text=FlashNote')).toBeVisible();
      await expect(extensionPage.locator('text=BETA')).toBeVisible();

      // Should show login form elements
      await expect(extensionPage.locator('input[type="email"]')).toBeVisible();
      await expect(extensionPage.locator('input[type="password"]')).toBeVisible();
      await expect(
        extensionPage.locator('button:has-text("Sign In")')
      ).toBeVisible();

      // Should show sign up link
      await expect(
        extensionPage.locator('text=Don\'t have an account? Sign up')
      ).toBeVisible();
    });

    test('can switch between login and signup views', async ({
      extensionPage,
    }) => {
      // Start on login view
      await expect(
        extensionPage.locator('button:has-text("Sign In")')
      ).toBeVisible();

      // Switch to signup
      await extensionPage.click('text=Don\'t have an account? Sign up');
      await expect(
        extensionPage.locator('button:has-text("Create Account")')
      ).toBeVisible();

      // Switch back to login
      await extensionPage.click('text=Already have an account? Sign in');
      await expect(
        extensionPage.locator('button:has-text("Sign In")')
      ).toBeVisible();
    });

    test('shows forgot password view', async ({ extensionPage }) => {
      // Click forgot password link
      await extensionPage.click('text=Forgot password?');

      // Should show reset form
      await expect(
        extensionPage.locator('text=Reset your password')
      ).toBeVisible();
      await expect(
        extensionPage.locator('button:has-text("Send reset link")')
      ).toBeVisible();

      // Should be able to go back
      await extensionPage.click('text=Back to sign in');
      await expect(
        extensionPage.locator('button:has-text("Sign In")')
      ).toBeVisible();
    });
  });

  test.describe('Login Validation', () => {
    test('shows error for empty email', async ({ extensionPage }) => {
      await extensionPage.fill('input[type="password"]', 'SomePassword123');
      await extensionPage.click('button:has-text("Sign In")');

      // Browser validation should prevent submission or show error
      const emailInput = extensionPage.locator('input[type="email"]');
      await expect(emailInput).toBeFocused();
    });

    test('shows error for invalid email format', async ({ extensionPage }) => {
      await extensionPage.fill('input[type="email"]', 'not-an-email');
      await extensionPage.fill('input[type="password"]', 'SomePassword123');
      await extensionPage.click('button:has-text("Sign In")');

      // Browser's HTML5 validation prevents submission for invalid email format
      // The email input should be focused and in invalid state
      const emailInput = extensionPage.locator('input[type="email"]');
      await expect(emailInput).toBeFocused();

      // Verify the input is in invalid state (HTML5 validation)
      const isInvalid = await emailInput.evaluate(
        (el: HTMLInputElement) => !el.checkValidity()
      );
      expect(isInvalid).toBe(true);
    });

    test('shows error for short password', async ({ extensionPage }) => {
      await extensionPage.fill('input[type="email"]', 'test@example.com');
      await extensionPage.fill('input[type="password"]', 'short');
      await extensionPage.click('button:has-text("Sign In")');

      // Browser's HTML5 validation prevents submission for password < minLength
      // The password input should be focused and in invalid state
      const passwordInput = extensionPage.locator('input[type="password"]');
      await expect(passwordInput).toBeFocused();

      // Verify the input is in invalid state (HTML5 validation)
      const isInvalid = await passwordInput.evaluate(
        (el: HTMLInputElement) => !el.checkValidity()
      );
      expect(isInvalid).toBe(true);
    });

    test('shows error for invalid credentials', async ({ extensionPage }) => {
      await extensionPage.fill('input[type="email"]', 'wrong@example.com');
      await extensionPage.fill('input[type="password"]', 'WrongPassword123');
      await extensionPage.click('button:has-text("Sign In")');

      // Should show error message (may take time to get response)
      await expect(extensionPage.locator('.error-message')).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe('Successful Authentication', () => {
    test('can login with valid credentials', async ({ extensionPage }) => {
      await loginUser(extensionPage);

      // Should show generator view
      await expect(extensionPage.locator('text=Note Type')).toBeVisible();
      await expect(extensionPage.locator('text=Session Notes')).toBeVisible();
      await expect(
        extensionPage.locator('button:has-text("Generate Note")')
      ).toBeVisible();

      // Should show header with settings button
      await expect(extensionPage.locator('header')).toBeVisible();
    });

    test('persists login state on page reload', async ({ extensionPage }) => {
      await loginUser(extensionPage);

      // Verify we're logged in
      await expect(extensionPage.locator('text=Note Type')).toBeVisible();

      // Reload the page
      await extensionPage.reload();

      // Should still be logged in (tokens persisted in chrome.storage)
      await expect(extensionPage.locator('text=Note Type')).toBeVisible({
        timeout: 10000,
      });
    });

    test('can logout and return to login form', async ({ extensionPage }) => {
      await loginUser(extensionPage);

      // Go to settings
      await extensionPage.click('button[title="Settings"]');
      await expect(extensionPage.locator('text=Account')).toBeVisible();

      // Click logout
      await extensionPage.click('button:has-text("Sign Out")');

      // Should return to login form
      await expect(
        extensionPage.locator('button:has-text("Sign In")')
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Registration Validation', () => {
    test('shows password requirements on signup', async ({ extensionPage }) => {
      // Switch to signup view
      await extensionPage.click('text=Don\'t have an account? Sign up');

      // Password placeholder should show requirements
      const passwordInput = extensionPage.locator('input[type="password"]');
      await expect(passwordInput).toHaveAttribute(
        'placeholder',
        /uppercase|number/i
      );
    });

    test('validates password complexity on signup', async ({
      extensionPage,
    }) => {
      // Switch to signup view
      await extensionPage.click('text=Don\'t have an account? Sign up');

      // Try weak password
      await extensionPage.fill('input[type="email"]', 'newuser@example.com');
      await extensionPage.fill('input[type="password"]', 'weakpassword');
      await extensionPage.click('button:has-text("Create Account")');

      // Should show password validation error
      await expect(extensionPage.locator('.error-message')).toBeVisible();
      await expect(
        extensionPage.locator('.error-message')
      ).toContainText(/uppercase|number/i);
    });
  });

  test.describe('Password Reset', () => {
    test('can request password reset', async ({ extensionPage }) => {
      // Go to forgot password
      await extensionPage.click('text=Forgot password?');

      // Fill email and submit
      await extensionPage.fill('input[type="email"]', TEST_USER.email);
      await extensionPage.click('button:has-text("Send reset link")');

      // Should show success message
      await expect(
        extensionPage.locator('text=Check your email')
      ).toBeVisible({ timeout: 10000 });
    });

    test('validates email on password reset', async ({ extensionPage }) => {
      // Go to forgot password
      await extensionPage.click('text=Forgot password?');

      // Try invalid email
      await extensionPage.fill('input[type="email"]', 'not-an-email');
      await extensionPage.click('button:has-text("Send reset link")');

      // Browser's HTML5 validation prevents submission for invalid email format
      // The email input should be focused and in invalid state
      const emailInput = extensionPage.locator('input[type="email"]');
      await expect(emailInput).toBeFocused();

      // Verify the input is in invalid state (HTML5 validation)
      const isInvalid = await emailInput.evaluate(
        (el: HTMLInputElement) => !el.checkValidity()
      );
      expect(isInvalid).toBe(true);
    });
  });
});
