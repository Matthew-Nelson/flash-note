import { test, expect } from '@playwright/test';

import { SHARED_USER_STATE } from './fixtures/web';

/**
 * Pricing page E2E tests.
 *
 * The e2e server has no Stripe keys, so these cover everything up to the
 * Stripe redirect: auth-aware CTAs and the canceled-checkout return.
 */

test.describe('Pricing Page (Unauthenticated)', () => {
  test('plan CTA sends a visitor to signup with the plan', async ({ page }) => {
    await page.goto('/pricing');
    await page.getByRole('button', { name: 'Start Free Trial' }).first().click();
    await expect(page).toHaveURL(/\/signup\?plan=/);
  });

  test('returning from a canceled checkout shows a dismissible alert and cleans the URL', async ({ page }) => {
    await page.goto('/pricing?canceled=true');

    const alert = page.getByText('Checkout was canceled. No charges were made.');
    await expect(alert).toBeVisible();
    await expect(page).toHaveURL('/pricing');

    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(alert).toHaveCount(0);
  });
});

test.describe('Pricing Page (Authenticated)', () => {
  test.use({ storageState: SHARED_USER_STATE });

  test('nav shows a Dashboard link instead of sign in', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign In' })).toHaveCount(0);
  });

  test('plan buttons offer to subscribe rather than start a trial', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('button', { name: 'Subscribe Now' })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Start Free Trial' })).toHaveCount(0);
  });
});
