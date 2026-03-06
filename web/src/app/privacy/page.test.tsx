import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrivacyPolicyPage from './page';

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

describe('PrivacyPolicyPage', () => {
  it('renders MarketingNav component', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByTestId('marketing-nav')).toBeInTheDocument();
  });

  it('renders Footer component', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('renders page title h1 "Privacy Policy"', () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })
    ).toBeInTheDocument();
  });

  it('has main#main-content', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('renders "PENDING LEGAL REVIEW" text', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByText('PENDING LEGAL REVIEW')).toBeInTheDocument();
  });
});
