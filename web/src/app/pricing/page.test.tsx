import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PricingPage from './page';
import type { SessionData } from '@/server/types';

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

function createMockSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 'session-uuid',
    userId: 'user-uuid',
    email: 'therapist@example.com',
    subscriptionStatus: 'active',
    trialEndsAt: new Date('2026-03-15'),
    emailVerified: true,
    organizationId: null,
    ...overrides,
  };
}

describe('PricingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes showDashboardLink={true} to MarketingNav when session exists', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await PricingPage());

    const nav = screen.getByTestId('marketing-nav');
    expect(nav).toHaveAttribute('data-show-dashboard', 'true');
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

  it('passes price IDs to CheckoutButtons', async () => {
    mockGetSession.mockResolvedValue(null);

    render(await PricingPage());

    // Both env vars default to '' in test env
    const checkoutButtons = screen.getByTestId('checkout-buttons');
    expect(checkoutButtons).toBeInTheDocument();
  });
});
