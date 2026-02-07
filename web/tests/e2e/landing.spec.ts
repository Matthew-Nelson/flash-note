import { test, expect } from '@playwright/test';

/**
 * Landing page E2E tests.
 *
 * Covers the public-facing home page including:
 * - Navigation display
 * - Hero section content
 * - How It Works section
 * - Example section
 * - Pricing preview
 * - Footer links
 */

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Navigation', () => {
    test('displays FlashNote branding with BETA badge', async ({ page }) => {
      await expect(page.getByText('FlashNote').first()).toBeVisible();
      await expect(page.getByText('BETA').first()).toBeVisible();
    });

    test('shows navigation links', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Pricing' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible();
    });

    test('Pricing link navigates to pricing page', async ({ page }) => {
      await page.getByRole('link', { name: 'Pricing' }).click();
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
    test('displays headline and description', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: /Write PT Notes in Seconds/i })
      ).toBeVisible();
      await expect(
        page.getByText(/FlashNote uses AI to transform your shorthand notes/i)
      ).toBeVisible();
    });

    test('shows call-to-action buttons', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Start Free Trial' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'See Demo' })).toBeVisible();
    });

    test('shows free trial messaging', async ({ page }) => {
      await expect(page.getByText('14-day free trial. No credit card required.')).toBeVisible();
    });

    test('Start Free Trial CTA links to signup', async ({ page }) => {
      await page.getByRole('link', { name: 'Start Free Trial' }).first().click();
      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('How It Works Section', () => {
    test('displays three steps', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'How It Works' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Type Shorthand' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'AI Generates' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Copy to EMR' })).toBeVisible();
    });
  });

  test.describe('Example Section', () => {
    test('displays input and output examples', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'See the Difference' })).toBeVisible();
      await expect(page.getByText('You Type:')).toBeVisible();
      await expect(page.getByText('You Get:')).toBeVisible();
      // Verify SOAP sections are shown in the output example
      await expect(page.getByText('SUBJECTIVE:')).toBeVisible();
      await expect(page.getByText('OBJECTIVE:')).toBeVisible();
      await expect(page.getByText('ASSESSMENT:')).toBeVisible();
      await expect(page.getByText('PLAN:')).toBeVisible();
    });
  });

  test.describe('Pricing Preview', () => {
    test('shows pricing information', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /Simple, Affordable Pricing/i })).toBeVisible();
      await expect(page.getByText('$29')).toBeVisible();
      await expect(page.getByText('Unlimited SOAP notes')).toBeVisible();
    });
  });

  test.describe('Footer', () => {
    test('displays company and legal links', async ({ page }) => {
      const footer = page.locator('footer');
      await expect(footer.getByText('FlashNote')).toBeVisible();
      await expect(footer.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
      await expect(footer.getByRole('link', { name: 'Terms of Service' })).toBeVisible();
      await expect(footer.getByRole('link', { name: 'Pricing' })).toBeVisible();
    });

    test('Privacy Policy link navigates correctly', async ({ page }) => {
      await page.locator('footer').getByRole('link', { name: 'Privacy Policy' }).click();
      await expect(page).toHaveURL('/privacy');
    });

    test('Terms of Service link navigates correctly', async ({ page }) => {
      await page.locator('footer').getByRole('link', { name: 'Terms of Service' }).click();
      await expect(page).toHaveURL('/terms');
    });
  });
});
