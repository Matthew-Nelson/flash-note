import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TermsOfServicePage from './page';

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

describe('TermsOfServicePage', () => {
  it('renders MarketingNav component without showDashboardLink', () => {
    render(<TermsOfServicePage />);
    const nav = screen.getByTestId('marketing-nav');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveAttribute('data-show-dashboard', 'false');
  });

  it('renders Footer component', () => {
    render(<TermsOfServicePage />);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('renders page title h1 "Terms of Service"', () => {
    render(<TermsOfServicePage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Terms of Service' })
    ).toBeInTheDocument();
  });

  it('has main#main-content', () => {
    render(<TermsOfServicePage />);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('renders "PENDING LEGAL REVIEW" text', () => {
    render(<TermsOfServicePage />);
    expect(screen.getByText('PENDING LEGAL REVIEW')).toBeInTheDocument();
  });
});
