import { test, expect, type Page } from '@playwright/test';

import { fill } from './fixtures/web';
import { createUser, findUserByEmail, uniqueEmail } from './helpers/db';
import { invalidPasswords } from './helpers/test-data';

/**
 * Authentication E2E tests: login, lockout, and registration against the real
 * session, bcrypt and lockout code paths.
 */

async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await fill(page.getByLabel('Email address'), email);
  await fill(page.getByLabel('Password'), password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('redirects to dashboard after valid login', async ({ page }) => {
    const user = await createUser({ label: 'login' });
    await submitLogin(page, user.email, user.password);

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  });

  test('shows error for wrong password and stays on login', async ({ page }) => {
    const user = await createUser({ label: 'wrong-password' });
    await submitLogin(page, user.email, 'WrongPassword1');

    await expect(page.getByText('Invalid email or password.')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('shows the same error for a non-existent account (no enumeration)', async ({ page }) => {
    await submitLogin(page, uniqueEmail('nobody'), 'SomePassword1');

    await expect(page.getByText('Invalid email or password.')).toBeVisible();
  });

  test('sends an unverified account to check-email instead of the dashboard', async ({ page }) => {
    const user = await createUser({ label: 'unverified', emailVerified: false });
    await submitLogin(page, user.email, user.password);

    await expect(page).toHaveURL('/check-email');
  });

  test('sign up link goes to signup', async ({ page }) => {
    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL('/signup');
  });

  test('forgot password link goes to forgot-password page', async ({ page }) => {
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL('/forgot-password');
  });
});

test.describe('Account Lockout', () => {
  // The lockout threshold is 5 failed attempts (server/services/lockout.ts).
  async function failLogins(page: Page, email: string, count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await submitLogin(page, email, 'WrongPassword1');
      await expect(page.getByText('Invalid email or password.')).toBeVisible();
      // Clear the alert so the next attempt's result can't be confused with this one
      await page.goto('/login');
    }
  }

  test('rejects the correct password after 5 failed attempts', async ({ page }) => {
    const user = await createUser({ label: 'locked' });
    await page.goto('/login');
    await failLogins(page, user.email, 5);

    await submitLogin(page, user.email, user.password);

    // Same message as a wrong password: a locked account must not confirm the password was right
    await expect(page.getByText('Invalid email or password.')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('still accepts the correct password after 4 failed attempts', async ({ page }) => {
    const user = await createUser({ label: 'not-locked' });
    await page.goto('/login');
    await failLogins(page, user.email, 4);

    await submitLogin(page, user.email, user.password);

    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('Signup Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  async function fillSignup(page: Page, email: string, password: string, confirm = password): Promise<void> {
    await fill(page.getByLabel('Email address'), email);
    await fill(page.getByLabel('Password', { exact: true }), password);
    await fill(page.getByLabel('Confirm Password'), confirm);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create account' }).click();
  }

  test('shows error for short password', async ({ page }) => {
    await fillSignup(page, uniqueEmail('signup'), invalidPasswords.tooShort);
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test('shows error for password without uppercase', async ({ page }) => {
    await fillSignup(page, uniqueEmail('signup'), invalidPasswords.noUppercase);
    await expect(page.getByText('Password must contain at least one uppercase letter')).toBeVisible();
  });

  test('shows error for password without lowercase', async ({ page }) => {
    await fillSignup(page, uniqueEmail('signup'), invalidPasswords.noLowercase);
    await expect(page.getByText('Password must contain at least one lowercase letter')).toBeVisible();
  });

  test('shows error for password without number', async ({ page }) => {
    await fillSignup(page, uniqueEmail('signup'), invalidPasswords.noNumber);
    await expect(page.getByText('Password must contain at least one number')).toBeVisible();
  });

  test('shows error when passwords do not match', async ({ page }) => {
    await fillSignup(page, uniqueEmail('signup'), 'ValidPass1', 'DifferentPass1');
    await expect(page.getByText(/do not match/i)).toBeVisible();
  });

  test('creates an unverified account and asks the user to check email', async ({ page }) => {
    const email = uniqueEmail('signup');
    await fillSignup(page, email, 'ValidPass123');

    await expect(page).toHaveURL('/check-email');
    const user = await findUserByEmail(email);
    expect(user).not.toBeNull();
    expect(user?.emailVerified).toBe(false);
  });

  test('rejects a duplicate email without creating a second account', async ({ page }) => {
    const existing = await createUser({ label: 'duplicate' });
    await fillSignup(page, existing.email, 'ValidPass123');

    // Generic on purpose: saying "email already registered" would enumerate accounts
    await expect(
      page.getByText('Registration could not be completed. Please try again or sign in.'),
    ).toBeVisible();
    await expect(page).toHaveURL('/signup');
  });

  test('sign in link goes to login', async ({ page }) => {
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/login');
  });
});
