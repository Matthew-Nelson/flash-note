import { test, expect } from '@playwright/test';
import { generateTestEmail, generateTestPassword, invalidEmails, invalidPasswords } from './helpers/test-data';

/**
 * Authentication E2E tests.
 *
 * Focus: Login/signup flows, validation behavior, error handling, navigation.
 * Deleted: Pure visibility checks for form elements/branding.
 */

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test.describe('Successful Login', () => {
    test('redirects to dashboard after valid login', async ({ page }) => {
      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('TestPassword123');
      await page.getByRole('button', { name: 'Sign in' }).click();

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

  test.describe('Registration Validation', () => {
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
