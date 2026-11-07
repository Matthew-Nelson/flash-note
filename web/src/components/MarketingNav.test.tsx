import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    const pricingLinks = screen.getAllByRole('link', { name: 'Pricing' });
    expect(pricingLinks.length).toBeGreaterThan(0);
    expect(pricingLinks[0]).toHaveAttribute('href', '/pricing');
  });

  it('renders Sign In and Get Started links by default', () => {
    render(<MarketingNav />);
    const signInLinks = screen.getAllByRole('link', { name: 'Sign In' });
    expect(signInLinks.length).toBeGreaterThan(0);
    expect(signInLinks[0]).toHaveAttribute('href', '/login');
    const getStartedLinks = screen.getAllByRole('link', { name: 'Get Started' });
    expect(getStartedLinks.length).toBeGreaterThan(0);
    expect(getStartedLinks[0]).toHaveAttribute('href', '/signup');
  });

  it('does not render Dashboard link by default', () => {
    render(<MarketingNav />);
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('renders Dashboard link when showDashboardLink is true', () => {
    render(<MarketingNav showDashboardLink={true} />);
    const dashboardLinks = screen.getAllByRole('link', { name: 'Dashboard' });
    expect(dashboardLinks.length).toBeGreaterThan(0);
    expect(dashboardLinks[0]).toHaveAttribute('href', '/dashboard');
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

  it('renders hamburger button with aria-label="Open menu"', () => {
    render(<MarketingNav />);
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  });

  it('opens mobile drawer when hamburger is clicked', async () => {
    const user = userEvent.setup();
    render(<MarketingNav />);
    // Drawer is aria-hidden while closed, so its Close button is not in the accessibility tree
    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
  });

  it('closes mobile drawer when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<MarketingNav />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-backdrop')).not.toBeInTheDocument();
  });

  it('closes mobile drawer on Escape key', async () => {
    const user = userEvent.setup();
    render(<MarketingNav />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    // Backdrop appears when open
    expect(screen.getByTestId('menu-backdrop')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('menu-backdrop')).not.toBeInTheDocument();
  });

  it('closes mobile drawer on backdrop click', async () => {
    const user = userEvent.setup();
    render(<MarketingNav />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const backdrop = screen.getByTestId('menu-backdrop');
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop);
    expect(screen.queryByTestId('menu-backdrop')).not.toBeInTheDocument();
  });

  it('closes mobile drawer when a nav link in the drawer is clicked', async () => {
    const user = userEvent.setup();
    render(<MarketingNav />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByTestId('menu-backdrop')).toBeInTheDocument();
    // Desktop nav renders before the drawer in the DOM, so the last Pricing link is the drawer's
    const pricingLinks = screen.getAllByRole('link', { name: 'Pricing' });
    await user.click(pricingLinks[pricingLinks.length - 1]);
    expect(screen.queryByTestId('menu-backdrop')).not.toBeInTheDocument();
  });

  it('renders close button with aria-label in mobile drawer', async () => {
    const user = userEvent.setup();
    render(<MarketingNav />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
  });

  it('backdrop has role="presentation" and aria-hidden="true"', async () => {
    const user = userEvent.setup();
    render(<MarketingNav />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const backdrop = screen.getByTestId('menu-backdrop');
    expect(backdrop).toHaveAttribute('role', 'presentation');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
  });

  it('desktop nav links have min-h-[44px] for touch target compliance', () => {
    render(<MarketingNav />);
    const pricingLinks = screen.getAllByRole('link', { name: 'Pricing' });
    // Desktop pricing link is the first one
    expect(pricingLinks[0].className).toContain('min-h-[44px]');
  });

  it('Get Started CTA has min-h-[44px] for touch target compliance', () => {
    render(<MarketingNav />);
    const ctaLinks = screen.getAllByRole('link', { name: 'Get Started' });
    expect(ctaLinks[0].className).toContain('min-h-[44px]');
  });
});
