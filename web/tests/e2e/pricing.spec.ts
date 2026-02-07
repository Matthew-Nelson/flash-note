import { test as baseTest, expect as baseExpect } from '@playwright/test';
import { test as authTest, expect as authExpect } from './fixtures/web';

/**
 * Pricing page E2E tests.
 *
 * Focus: CTAs work correctly, checkout flow handling, auth-aware behavior.
 * Deleted: Pure visibility checks for pricing copy/FAQ content.
 */

baseTest.describe('Pricing Page (Unauthenticated)', () => {
  baseTest.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  baseTest.describe('CTA Buttons', () => {
    baseTest('clicking plan CTA redirects to signup', async ({ page }) => {
      const buttons = page.getByRole('button', { name: 'Start Free Trial' });
      await buttons.first().click();
      await baseExpect(page).toHaveURL(/\/signup/);
    });
  });

  baseTest.describe('Checkout Flow', () => {
    baseTest('shows canceled alert when returning from Stripe', async ({ page }) => {
      await page.goto('/pricing?canceled=true');
      await baseExpect(page.getByText(/checkout was canceled/i)).toBeVisible();
    });

    baseTest('canceled alert can be dismissed', async ({ page }) => {
      await page.goto('/pricing?canceled=true');
      const alert = page.getByText(/checkout was canceled/i);
      await baseExpect(alert).toBeVisible();

      await page.getByRole('button', { name: 'Dismiss' }).click();
      await baseExpect(alert).not.toBeVisible();
    });
  });
});

authTest.describe('Pricing Page (Authenticated)', () => {
  authTest('shows Dashboard link when authenticated', async ({ authenticatedPage: page }) => {
    await page.goto('/pricing');
    await authExpect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });

  authTest('shows Subscribe Now buttons when authenticated', async ({ authenticatedPage: page }) => {
    await page.goto('/pricing');
    const subscribeButton = page.getByRole('button', { name: /Subscribe Now|Start Free Trial/i });
    await authExpect(subscribeButton.first()).toBeVisible();
  });
});
