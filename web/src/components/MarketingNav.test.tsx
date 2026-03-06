import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarketingNav } from './MarketingNav';

// Mock BetaBadge to isolate MarketingNav tests
vi.mock('./BetaBadge', () => ({
  BetaBadge: () => <span data-testid="beta-badge">BETA</span>,
}));

describe('MarketingNav', () => {
  it('renders FlashNote logo link to "/"', () => {
    render(<MarketingNav />);
    const logoLink = screen.getByRole('link', { name: /flashnote/i });
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('renders BetaBadge', () => {
    render(<MarketingNav />);
    expect(screen.getByTestId('beta-badge')).toBeInTheDocument();
  });

  it('renders Pricing link', () => {
    render(<MarketingNav />);
    const pricingLink = screen.getByRole('link', { name: 'Pricing' });
    expect(pricingLink).toHaveAttribute('href', '/pricing');
  });

  it('renders Sign In and Get Started links by default', () => {
    render(<MarketingNav />);
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/signup');
  });

  it('does not render Dashboard link by default', () => {
    render(<MarketingNav />);
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('renders Dashboard link when showDashboardLink is true', () => {
    render(<MarketingNav showDashboardLink={true} />);
    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
  });

  it('does not render Sign In or Get Started when showDashboardLink is true', () => {
    render(<MarketingNav showDashboardLink={true} />);
    expect(screen.queryByRole('link', { name: 'Sign In' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Get Started' })).not.toBeInTheDocument();
  });

  it('has aria-label="Main" on nav element', () => {
    render(<MarketingNav />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});
