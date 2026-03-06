import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BaaPage from './page';

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

describe('BaaPage', () => {
  it('renders MarketingNav component', () => {
    render(<BaaPage />);
    expect(screen.getByTestId('marketing-nav')).toBeInTheDocument();
  });

  it('renders Footer component', () => {
    render(<BaaPage />);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('renders page title h1 containing "Business Associate Agreement"', () => {
    render(<BaaPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /business associate agreement/i })
    ).toBeInTheDocument();
  });

  it('has main#main-content', () => {
    render(<BaaPage />);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('renders "PENDING LEGAL REVIEW" text', () => {
    render(<BaaPage />);
    expect(screen.getByText('PENDING LEGAL REVIEW')).toBeInTheDocument();
  });
});
