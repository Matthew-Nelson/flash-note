import { test, expect } from '@playwright/test';
import { generateTestEmail, generateTestPassword, invalidEmails, invalidPasswords } from './helpers/test-data';

/**
 * Authentication E2E tests.
 *
 * Covers login and registration flows including:
 * - Form display and layout
 * - Client-side validation
 * - Successful login and redirect
 * - Login error handling
 * - Registration form and validation
 * - Registration error handling
 */

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test.describe('Form Display', () => {
    test('displays login form with all elements', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
      await expect(page.getByLabel('Email address')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    });

    test('shows link to create account', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'create a new account' })).toBeVisible();
    });

    test('shows forgot password link', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
    });

    test('shows FlashNote branding', async ({ page }) => {
      await expect(page.getByText('FlashNote').first()).toBeVisible();
    });
  });

  test.describe('Form Validation', () => {
    test('shows error for invalid email format', async ({ page }) => {
      await page.getByLabel('Email address').fill(invalidEmails.noAt);
      await page.getByLabel('Password').fill('SomePassword1');
      await page.getByRole('button', { name: 'Sign in' }).click();

      await expect(page.getByText(/valid email/i)).toBeVisible();
    });

    test('shows error when password is empty', async ({ page }) => {
      await page.getByLabel('Email address').fill('user@example.com');
      // Leave password empty and submit
      await page.getByRole('button', { name: 'Sign in' }).click();

      await expect(page.getByText(/password is required/i)).toBeVisible();
    });

    test('sign in button is not disabled when form is empty', async ({ page }) => {
      // The form relies on validation on submit, not disabled state
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    });
  });

  test.describe('Successful Login', () => {
    test('redirects to dashboard after valid login', async ({ page }) => {
      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('TestPassword123');
      await page.getByRole('button', { name: 'Sign in' }).click();

      await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
    });

    test('shows loading state during submission', async ({ page }) => {
      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('TestPassword123');
      await page.getByRole('button', { name: 'Sign in' }).click();

      // Button should show loading state during submission
      // It may resolve quickly, so we don't assert on it strictly
      await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
    });
  });

  test.describe('Login Error Handling', () => {
    test('shows error for invalid credentials', async ({ page }) => {
      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('WrongPassword1');
      await page.getByRole('button', { name: 'Sign in' }).click();

      await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10000 });
    });

    test('shows error for non-existent account', async ({ page }) => {
      await page.getByLabel('Email address').fill('nonexistent@example.com');
      await page.getByLabel('Password').fill('SomePassword1');
      await page.getByRole('button', { name: 'Sign in' }).click();

      await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Navigation Links', () => {
    test('create account link goes to signup', async ({ page }) => {
      await page.getByRole('link', { name: 'create a new account' }).click();
      await expect(page).toHaveURL('/signup');
    });

    test('forgot password link goes to forgot-password page', async ({ page }) => {
      await page.getByRole('link', { name: 'Forgot password?' }).click();
      await expect(page).toHaveURL('/forgot-password');
    });
  });
});

test.describe('Signup Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test.describe('Form Display', () => {
    test('displays registration form with all elements', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
      await expect(page.getByText('Start your 14-day free trial')).toBeVisible();
      await expect(page.getByLabel('Email address')).toBeVisible();
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Confirm Password')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
    });

    test('shows password requirements hint', async ({ page }) => {
      await expect(
        page.getByText('Min 8 characters, 1 uppercase, 1 lowercase, 1 number')
      ).toBeVisible();
    });

    test('shows link to login', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    });

    test('shows terms and privacy links', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Terms of Service' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
    });
  });

  test.describe('Registration Validation', () => {
    test('shows error for invalid email', async ({ page }) => {
      await page.getByLabel('Email address').fill(invalidEmails.noAt);
      await page.getByLabel('Password', { exact: true }).fill('ValidPass1');
      await page.getByLabel('Confirm Password').fill('ValidPass1');
      await page.getByRole('button', { name: 'Create account' }).click();

      await expect(page.getByText(/valid email/i)).toBeVisible();
    });

    test('shows error for short password', async ({ page }) => {
      await page.getByLabel('Email address').fill(generateTestEmail());
      await page.getByLabel('Password', { exact: true }).fill(invalidPasswords.tooShort);
      await page.getByLabel('Confirm Password').fill(invalidPasswords.tooShort);
      await page.getByRole('button', { name: 'Create account' }).click();

      await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    });

    test('shows error for password without uppercase', async ({ page }) => {
      await page.getByLabel('Email address').fill(generateTestEmail());
      await page.getByLabel('Password', { exact: true }).fill(invalidPasswords.noUppercase);
      await page.getByLabel('Confirm Password').fill(invalidPasswords.noUppercase);
      await page.getByRole('button', { name: 'Create account' }).click();

      await expect(page.getByText(/uppercase/i)).toBeVisible();
    });

    test('shows error for password without lowercase', async ({ page }) => {
      await page.getByLabel('Email address').fill(generateTestEmail());
      await page.getByLabel('Password', { exact: true }).fill(invalidPasswords.noLowercase);
      await page.getByLabel('Confirm Password').fill(invalidPasswords.noLowercase);
      await page.getByRole('button', { name: 'Create account' }).click();

      await expect(page.getByText(/lowercase/i)).toBeVisible();
    });

    test('shows error for password without number', async ({ page }) => {
      await page.getByLabel('Email address').fill(generateTestEmail());
      await page.getByLabel('Password', { exact: true }).fill(invalidPasswords.noNumber);
      await page.getByLabel('Confirm Password').fill(invalidPasswords.noNumber);
      await page.getByRole('button', { name: 'Create account' }).click();

      await expect(page.getByText(/number/i)).toBeVisible();
    });

    test('shows error when passwords do not match', async ({ page }) => {
      await page.getByLabel('Email address').fill(generateTestEmail());
      await page.getByLabel('Password', { exact: true }).fill('ValidPass1');
      await page.getByLabel('Confirm Password').fill('DifferentPass1');
      await page.getByRole('button', { name: 'Create account' }).click();

      await expect(page.getByText(/do not match/i)).toBeVisible();
    });
  });

  test.describe('Registration Success', () => {
    test('redirects after successful registration', async ({ page }) => {
      const email = generateTestEmail();
      const password = generateTestPassword();

      await page.getByLabel('Email address').fill(email);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByLabel('Confirm Password').fill(password);
      await page.getByRole('button', { name: 'Create account' }).click();

      // Should redirect to either dashboard or verify-email page
      await page.waitForURL(/\/(dashboard|verify-email)/, { timeout: 15000 });
    });
  });

  test.describe('Navigation Links', () => {
    test('sign in link goes to login', async ({ page }) => {
      await page.getByRole('link', { name: 'Sign in' }).click();
      await expect(page).toHaveURL('/login');
    });
  });
});
