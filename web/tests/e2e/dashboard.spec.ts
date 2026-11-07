import { test, expect } from '@playwright/test';

import { SHARED_USER_STATE, signInNewUser } from './fixtures/web';

/**
 * Dashboard E2E tests: sidebar navigation, subscription banners, and sign out.
 */

test.describe('Sidebar navigation', () => {
  test.use({ storageState: SHARED_USER_STATE });

  for (const { link, url, heading } of [
    { link: 'Notes', url: '/dashboard/notes', heading: 'Notes' },
    { link: 'Patients', url: '/dashboard/patients', heading: 'Patients' },
    { link: 'Templates', url: '/dashboard/templates', heading: 'Templates' },
    { link: 'Settings', url: '/dashboard/settings', heading: 'Account Settings' },
    { link: 'New Note', url: '/dashboard/notes/new', heading: 'New Note' },
  ]) {
    test(`${link} link opens ${url}`, async ({ page }) => {
      await page.goto('/dashboard');
      const nav = page.getByRole('navigation', { name: 'Main navigation' });
      // Not exact: Templates carries a "Soon" badge inside its link
      await nav.getByRole('link', { name: link }).click();

      await expect(page).toHaveURL(url);
      // The top bar's title; several pages also render their own h1 (a known duplicate)
      await expect(page.getByRole('banner').getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    });
  }

  test('Dashboard link returns to the dashboard', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('Subscription status', () => {
  test('a trialing account sees the days remaining', async ({ page }) => {
    await signInNewUser(page, {
      label: 'trial-banner',
      trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });

    await expect(page.getByText('5 days remaining in your free trial. Upgrade to keep generating notes.')).toBeVisible();
  });

  test('an expired trial is told to subscribe', async ({ page }) => {
    await signInNewUser(page, { label: 'trial-ended', trialEndsAt: new Date(Date.now() - 60_000) });

    await expect(page.getByText('Your trial has ended. Subscribe to continue.')).toBeVisible();
    await page.getByRole('link', { name: 'View Plans' }).click();
    await expect(page).toHaveURL('/pricing');
  });

  test('an active subscription sees no trial banner', async ({ page }) => {
    await signInNewUser(page, { label: 'active', subscriptionStatus: 'active' });

    await expect(page.getByText('Your subscription is active.')).toBeVisible();
    await expect(page.getByText(/remaining in your free trial/)).toHaveCount(0);
  });

  test('returning from Stripe checkout shows a confirmation and cleans the URL', async ({ page }) => {
    await signInNewUser(page, { label: 'checkout-return' });
    await page.goto('/dashboard?success=true&session_id=cs_test_mock123');

    await expect(page.getByText('Subscription activated! Thank you for subscribing to FlashNote.')).toBeVisible();
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('Sign Out', () => {
  test('signs out to the login page and the dashboard is closed afterwards', async ({ page }) => {
    await signInNewUser(page, { label: 'signout' });

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');

    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('a signed-out session token cannot be replayed', async ({ context, page }) => {
    await signInNewUser(page, { label: 'replay' });
    const sessionCookie = (await context.cookies()).find((c) => c.name === 'session_id');
    expect(sessionCookie).toBeDefined();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');

    // Put the old cookie back, as an attacker who copied it would.
    // Logout must have deleted the session row, not just the cookie.
    await context.addCookies([sessionCookie!]);
    await page.goto('/dashboard');

    // The proxy lets the cookie through, the DB lookup rejects it, and the layout
    // redirects with ?reason=session_expired. Assert the message rather than the
    // URL: SessionAlert strips the param from the address bar once it renders.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Your session has expired. Please sign in again.')).toBeVisible();
  });
});
