import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from './page';

// Mock MarketingNav
vi.mock('@/components/MarketingNav', () => ({
  MarketingNav: ({ showDashboardLink }: { showDashboardLink?: boolean }) => (
    <nav data-testid="marketing-nav" data-show-dashboard={showDashboardLink ?? false} />
  ),
}));

// Mock Footer
vi.mock('@/components/Footer', () => ({
  Footer: () => <footer data-testid="footer" />,
}));

describe('Home (landing page)', () => {
  it('renders MarketingNav component', () => {
    render(<Home />);
    expect(screen.getByTestId('marketing-nav')).toBeInTheDocument();
  });

  it('renders Footer component', () => {
    render(<Home />);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('renders hero h1 heading', () => {
    render(<Home />);
    expect(
      screen.getByRole('heading', { level: 1, name: /write pt notes in seconds/i })
    ).toBeInTheDocument();
  });

  it('renders "Start Free Trial" CTA link to /signup', () => {
    render(<Home />);
    const links = screen.getAllByRole('link', { name: 'Start Free Trial' });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/signup');
  });

  it('renders "See Demo" CTA link to #demo', () => {
    render(<Home />);
    const demoLink = screen.getByRole('link', { name: 'See Demo' });
    expect(demoLink).toHaveAttribute('href', '#demo');
  });

  it('has main#main-content', () => {
    render(<Home />);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('renders "How It Works" section', () => {
    render(<Home />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'How It Works' })
    ).toBeInTheDocument();
  });

  it('renders "See the Difference" section', () => {
    render(<Home />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'See the Difference' })
    ).toBeInTheDocument();
  });

  it('renders pricing preview section', () => {
    render(<Home />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Simple, Affordable Pricing' })
    ).toBeInTheDocument();
  });
});
