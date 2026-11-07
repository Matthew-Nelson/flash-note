import path from 'node:path';
import type { Locator, Page } from '@playwright/test';

import { createUser, type TestUser } from '../helpers/db';

/**
 * Cookie state for the shared account, written by auth.setup.ts.
 *
 * Specs that only read pages opt in with `test.use({ storageState: SHARED_USER_STATE })`.
 * Specs that sign out, or assert on per-account data, sign in their own user
 * instead: logout deletes the session row, which would sign out every other
 * test using this state.
 */
export const SHARED_USER_STATE = path.join(__dirname, '../.auth/shared-user.json');

/** Log in through the real /login form (bcrypt, lockout, session cookie). */
export async function loginViaUI(page: Page, user: Pick<TestUser, 'email' | 'password'>): Promise<void> {
  await page.goto('/login');
  await fill(page.getByLabel('Email address'), user.email);
  await fill(page.getByLabel('Password'), user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/dashboard');
}

/** Create a fresh verified account and sign it in, for tests that need their own session or data. */
export async function signInNewUser(
  page: Page,
  options: Parameters<typeof createUser>[0] = {},
): Promise<TestUser> {
  const user = await createUser(options);
  await loginViaUI(page, user);
  return user;
}

/**
 * Fill an input once React has hydrated it. Under `next dev` a page is visible
 * well before hydration, and keystrokes sent in that window reach the DOM but
 * never fire React's onChange: a fill into a debounced search box was silently
 * lost in ~1 of 5 runs. React attaches its props to a node when it hydrates it.
 */
export async function fill(locator: Locator, value: string): Promise<void> {
  await locator.evaluate(
    (node) =>
      new Promise<void>((resolve) => {
        const hydrated = () => Object.keys(node).some((key) => key.startsWith('__reactProps'));
        if (hydrated()) return resolve();
        const timer = setInterval(() => {
          if (hydrated()) {
            clearInterval(timer);
            resolve();
          }
        }, 25);
      }),
  );
  await locator.fill(value);
}
