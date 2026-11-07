import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PricingPage from './page';
import type { SessionData } from '@/server/types';
import { createMockSession } from '@/test/factories/session-factory';

// Mock getSession
const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
}));

// Mock MarketingNav to capture showDashboardLink prop
vi.mock('@/components/MarketingNav', () => ({
  MarketingNav: ({ showDashboardLink }: { showDashboardLink?: boolean }) => (
    <nav data-testid="marketing-nav" data-show-dashboard={String(showDashboardLink ?? false)} />
  ),
}));

// Mock Footer
vi.mock('@/components/Footer', () => ({
  Footer: () => <footer data-testid="footer" />,
}));

// Mock CheckoutButtons (Client Component)
vi.mock('./CheckoutButtons', () => ({
  CheckoutButtons: ({
    isAuthenticated,
    priceMonthly,
    priceAnnual,
  }: {
    isAuthenticated: boolean;
    priceMonthly: string;
    priceAnnual: string;
  }) => (
    <div
      data-testid="checkout-buttons"
      data-authenticated={isAuthenticated}
      data-price-monthly={priceMonthly}
      data-price-annual={priceAnnual}
    />
  ),
}));

describe('PricingPage', () => {
  it('passes showDashboardLink={true} to MarketingNav when session exists', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await PricingPage());

    const nav = screen.getByTestId('marketing-nav');
    expect(nav).toHaveAttribute('data-show-dashboard', 'true');
    expect(screen.getByTestId('checkout-buttons')).toHaveAttribute('data-authenticated', 'true');
  });

  it('passes showDashboardLink={false} to MarketingNav when session is null', async () => {
    mockGetSession.mockResolvedValue(null);

    render(await PricingPage());

    const nav = screen.getByTestId('marketing-nav');
    expect(nav).toHaveAttribute('data-show-dashboard', 'false');
  });

  it('renders Footer component', async () => {
    mockGetSession.mockResolvedValue(null);

    render(await PricingPage());

    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('has main#main-content', async () => {
    mockGetSession.mockResolvedValue(null);

    render(await PricingPage());

    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('renders h1 "Simple, Transparent Pricing"', async () => {
    mockGetSession.mockResolvedValue(null);

    render(await PricingPage());

    expect(
      screen.getByRole('heading', { level: 1, name: 'Simple, Transparent Pricing' })
    ).toBeInTheDocument();
  });

  it('renders FAQ section', async () => {
    mockGetSession.mockResolvedValue(null);

    render(await PricingPage());

    expect(
      screen.getByRole('heading', { level: 2, name: 'Frequently Asked Questions' })
    ).toBeInTheDocument();
  });

  it('passes the configured Stripe price IDs to CheckoutButtons', async () => {
    // Price IDs are read from env at module load, so reload the page module after stubbing
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PRICE_MONTHLY', 'price_monthly_test');
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PRICE_ANNUAL', 'price_annual_test');
    vi.resetModules();
    const { default: ReloadedPricingPage } = await import('./page');
    mockGetSession.mockResolvedValue(null);

    render(await ReloadedPricingPage());

    const checkoutButtons = screen.getByTestId('checkout-buttons');
    expect(checkoutButtons).toHaveAttribute('data-price-monthly', 'price_monthly_test');
    expect(checkoutButtons).toHaveAttribute('data-price-annual', 'price_annual_test');
  });
});
