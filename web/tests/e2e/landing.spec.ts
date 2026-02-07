import { test, expect } from '@playwright/test';

/**
 * Landing page E2E tests.
 *
 * Focus: Navigation works, CTAs lead to correct destinations.
 * Deleted: Pure visibility checks for marketing copy (breaks on content changes).
 */

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Navigation', () => {
    test('Pricing link navigates to pricing page', async ({ page }) => {
      await page.getByRole('navigation').getByRole('link', { name: 'Pricing' }).click();
      await expect(page).toHaveURL('/pricing');
    });

    test('Sign In link navigates to login page', async ({ page }) => {
      await page.getByRole('link', { name: 'Sign In' }).click();
      await expect(page).toHaveURL('/login');
    });

    test('Get Started link navigates to signup page', async ({ page }) => {
      await page.getByRole('link', { name: 'Get Started' }).click();
      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('Hero Section', () => {
    test('Start Free Trial CTA links to signup', async ({ page }) => {
      await page.getByRole('link', { name: 'Start Free Trial' }).first().click();
      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('Footer', () => {
    test('Privacy Policy link navigates correctly', async ({ page }) => {
      await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy Policy' }).click();
      await expect(page).toHaveURL('/privacy');
    });

    test('Terms of Service link navigates correctly', async ({ page }) => {
      await page.getByRole('contentinfo').getByRole('link', { name: 'Terms of Service' }).click();
      await expect(page).toHaveURL('/terms');
    });
  });
});
