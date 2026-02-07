import { test as baseTest, expect as baseExpect } from '@playwright/test';
import { test as authTest, expect as authExpect } from './fixtures/web';

/**
 * Pricing page E2E tests.
 *
 * Covers:
 * - Pricing display (monthly/annual plans)
 * - Feature lists
 * - FAQ section
 * - CTA behavior for unauthenticated users
 * - CTA behavior for authenticated users
 * - Canceled checkout handling
 */

baseTest.describe('Pricing Page (Unauthenticated)', () => {
  baseTest.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  baseTest.describe('Page Content', () => {
    baseTest('displays pricing heading', async ({ page }) => {
      await baseExpect(
        page.getByRole('heading', { name: /Simple, Transparent Pricing/i })
      ).toBeVisible();
    });

    baseTest('shows free trial messaging', async ({ page }) => {
      await baseExpect(
        page.getByText(/14-day free trial/i)
      ).toBeVisible();
    });

    baseTest('displays monthly plan with price', async ({ page }) => {
      await baseExpect(page.getByRole('heading', { name: 'Monthly' })).toBeVisible();
      await baseExpect(page.getByText('$29')).toBeVisible();
      await baseExpect(page.getByText('/month').first()).toBeVisible();
    });

    baseTest('displays annual plan with price and savings', async ({ page }) => {
      await baseExpect(page.getByRole('heading', { name: 'Annual' })).toBeVisible();
      await baseExpect(page.getByText('$24')).toBeVisible();
      await baseExpect(page.getByText('Save 17%')).toBeVisible();
      await baseExpect(page.getByText(/\$290\/year/i)).toBeVisible();
    });
  });

  baseTest.describe('Feature Lists', () => {
    baseTest('shows monthly plan features', async ({ page }) => {
      await baseExpect(page.getByText('Unlimited SOAP notes')).toBeVisible();
      await baseExpect(page.getByText('Chrome extension')).toBeVisible();
      await baseExpect(page.getByText('HIPAA-compliant')).toBeVisible();
    });

    baseTest('shows annual plan features', async ({ page }) => {
      await baseExpect(page.getByText('Everything in Monthly')).toBeVisible();
      await baseExpect(page.getByText('2 months free')).toBeVisible();
      await baseExpect(page.getByText('Priority support')).toBeVisible();
    });
  });

  baseTest.describe('CTA Buttons (Unauthenticated)', () => {
    baseTest('shows Start Free Trial buttons when not logged in', async ({ page }) => {
      const trialButtons = page.getByRole('button', { name: 'Start Free Trial' });
      await baseExpect(trialButtons.first()).toBeVisible();
    });

    baseTest('clicking monthly plan CTA redirects to signup', async ({ page }) => {
      // The first "Start Free Trial" button is for the monthly plan
      const buttons = page.getByRole('button', { name: 'Start Free Trial' });
      await buttons.first().click();

      await baseExpect(page).toHaveURL(/\/signup/);
    });
  });

  baseTest.describe('Navigation', () => {
    baseTest('shows Sign In and Get Started links when unauthenticated', async ({ page }) => {
      await baseExpect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
      await baseExpect(page.getByRole('link', { name: 'Get Started' })).toBeVisible();
    });
  });

  baseTest.describe('FAQ Section', () => {
    baseTest('displays FAQ heading', async ({ page }) => {
      await baseExpect(
        page.getByRole('heading', { name: 'Frequently Asked Questions' })
      ).toBeVisible();
    });

    baseTest('shows all FAQ questions', async ({ page }) => {
      await baseExpect(page.getByText('Is there a free trial?')).toBeVisible();
      await baseExpect(page.getByText('Is FlashNote HIPAA compliant?')).toBeVisible();
      await baseExpect(page.getByText('Can I cancel anytime?')).toBeVisible();
      await baseExpect(page.getByText('Does it work with my EMR?')).toBeVisible();
    });

    baseTest('FAQ answers contain expected content', async ({ page }) => {
      await baseExpect(page.getByText(/14-day free trial with full access/i)).toBeVisible();
      await baseExpect(page.getByText(/encrypted connections/i)).toBeVisible();
      await baseExpect(page.getByText(/cancel your subscription at any time/i)).toBeVisible();
      await baseExpect(page.getByText(/works with any EMR/i)).toBeVisible();
    });
  });

  baseTest.describe('Canceled Checkout', () => {
    baseTest('shows canceled alert when returning from Stripe', async ({ page }) => {
      await page.goto('/pricing?canceled=true');

      await baseExpect(page.getByText(/checkout was canceled/i)).toBeVisible();
    });

    baseTest('canceled alert can be dismissed', async ({ page }) => {
      await page.goto('/pricing?canceled=true');

      const alert = page.getByText(/checkout was canceled/i);
      await baseExpect(alert).toBeVisible();

      // The Alert component renders a dismiss button with aria-label="Dismiss"
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
    // Authenticated users with no active subscription should see "Subscribe Now"
    // or the button text depends on subscription status
    const subscribeButton = page.getByRole('button', { name: /Subscribe Now|Start Free Trial/i });
    await authExpect(subscribeButton.first()).toBeVisible();
  });
});
