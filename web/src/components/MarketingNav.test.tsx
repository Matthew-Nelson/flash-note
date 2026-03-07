import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('opens mobile drawer when hamburger is clicked', () => {
    render(<MarketingNav />);
    // Drawer nav links are present in the DOM but visually translated off-screen
    // Click the hamburger to open the drawer
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    // After open, close button should be visible
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
  });

  it('closes mobile drawer when close button is clicked', () => {
    render(<MarketingNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    // After close, backdrop/presentation element should be gone
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  });

  it('closes mobile drawer on Escape key', () => {
    render(<MarketingNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    // Backdrop appears when open
    expect(screen.getByRole('presentation')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  });

  it('closes mobile drawer on backdrop click', () => {
    render(<MarketingNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const backdrop = screen.getByRole('presentation');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop);
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  });

  it('closes mobile drawer when a nav link in the drawer is clicked', () => {
    render(<MarketingNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('presentation')).toBeInTheDocument();
    // Click the first Pricing link (desktop is hidden by CSS, drawer is in the DOM)
    // The drawer's links close the menu on click
    const pricingLinks = screen.getAllByRole('link', { name: 'Pricing' });
    // Click whichever pricing link is reachable (drawer or desktop)
    fireEvent.click(pricingLinks[pricingLinks.length - 1]);
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  });

  it('renders close button with aria-label in mobile drawer', () => {
    render(<MarketingNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
  });

  it('backdrop has role="presentation" and aria-hidden="true"', () => {
    render(<MarketingNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const backdrop = screen.getByRole('presentation');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
  });
});
