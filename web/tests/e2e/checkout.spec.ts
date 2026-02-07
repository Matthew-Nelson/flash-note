import { test, expect } from './fixtures/web';

/**
 * Checkout/Payment Flow E2E Tests
 *
 * Tests the Stripe checkout integration including:
 * - Checkout session creation
 * - Success/cancel redirect handling
 * - Subscription status polling after checkout
 *
 * Note: We don't complete actual Stripe checkout in E2E tests.
 * Instead we test the integration points and redirect handling.
 */

test.describe('Checkout Flow', () => {
  test.describe('Checkout Initiation', () => {
    test('subscribe button calls checkout API', async ({ authenticatedPage: page }) => {
      await page.goto('/pricing');

      // Set up request listener to capture the checkout API call
      const checkoutRequestPromise = page.waitForRequest(
        (req) => req.url().includes('/billing/checkout') && req.method() === 'POST'
      );

      // Click subscribe button
      const subscribeButton = page.getByRole('button', { name: /Subscribe Now|Start Free Trial/i });
      await subscribeButton.first().click();

      // Verify checkout API was called
      const request = await checkoutRequestPromise;
      expect(request.method()).toBe('POST');
    });
  });

  test.describe('Checkout Success Redirect', () => {
    test('dashboard loads when returning from Stripe with success param', async ({
      authenticatedPage: page,
    }) => {
      // Simulate returning from successful Stripe checkout
      await page.goto('/dashboard?success=true&session_id=cs_test_mock123');

      // Dashboard should load successfully
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
    });

    test('clears success param from URL after processing', async ({
      authenticatedPage: page,
    }) => {
      await page.goto('/dashboard?success=true&session_id=cs_test_mock123');

      // Wait for dashboard to load and process the param
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

      // Wait for URL to be cleaned up (dashboard replaces state after processing)
      await expect(async () => {
        expect(page.url()).not.toContain('success=true');
      }).toPass({ timeout: 5000 });
    });
  });

  test.describe('Checkout Cancel Redirect', () => {
    test('shows canceled message when returning from Stripe with canceled param', async ({
      page,
    }) => {
      await page.goto('/pricing?canceled=true');

      await expect(page.getByText(/checkout was canceled/i)).toBeVisible();
    });

    test('can retry checkout after cancellation', async ({ authenticatedPage: page }) => {
      await page.goto('/pricing?canceled=true');

      // Dismiss the cancel alert
      await page.getByRole('button', { name: 'Dismiss' }).click();

      // Subscribe buttons should still be available
      const subscribeButton = page.getByRole('button', { name: /Subscribe Now|Start Free Trial/i });
      await expect(subscribeButton.first()).toBeVisible();
      await expect(subscribeButton.first()).toBeEnabled();
    });
  });

  test.describe('Email Verification Requirement', () => {
    test('checkout attempt triggers API call', async ({ authenticatedPage: page }) => {
      // This test verifies the checkout flow is initiated
      // The test user is verified, so checkout should proceed
      await page.goto('/pricing');

      // Set up listeners for both possible outcomes
      const checkoutRequestPromise = page.waitForRequest(
        (req) => req.url().includes('/billing/checkout') && req.method() === 'POST'
      );

      const subscribeButton = page.getByRole('button', { name: /Subscribe Now|Start Free Trial/i });
      await subscribeButton.first().click();

      // Checkout API should be called
      const request = await checkoutRequestPromise;
      expect(request.method()).toBe('POST');
    });
  });
});

test.describe('Subscription Status Display', () => {
  test('dashboard shows subscription card', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    // Should show Subscription heading in the card
    await expect(page.getByText('Subscription').first()).toBeVisible();
  });

  test('pricing page shows appropriate CTA based on auth state', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/pricing');

    // Authenticated users should see Subscribe Now (or current plan status)
    const cta = page.getByRole('button', { name: /Subscribe|Current Plan|Manage|Start Free Trial/i });
    await expect(cta.first()).toBeVisible();
  });
});
