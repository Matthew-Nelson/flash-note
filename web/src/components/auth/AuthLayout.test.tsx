import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthLayout } from './AuthLayout';

// Mock next/link to render as a plain anchor
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock BetaBadge to isolate AuthLayout tests
vi.mock('../BetaBadge', () => ({
  BetaBadge: () => <span data-testid="beta-badge">BETA</span>,
}));

describe('AuthLayout', () => {
  it('should render FlashNote logo with BETA badge', () => {
    render(<AuthLayout>content</AuthLayout>);
    expect(screen.getByText('FlashNote')).toBeInTheDocument();
    expect(screen.getByTestId('beta-badge')).toBeInTheDocument();
  });

  it('should render title when provided', () => {
    render(<AuthLayout title="Create your account">content</AuthLayout>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Create your account');
  });

  it('should not render heading when title is omitted', () => {
    render(<AuthLayout>content</AuthLayout>);
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('should render subtitle when provided', () => {
    render(<AuthLayout subtitle="Start your 14-day free trial">content</AuthLayout>);
    expect(screen.getByText('Start your 14-day free trial')).toBeInTheDocument();
  });

  it('should render children inside card', () => {
    render(<AuthLayout><form data-testid="test-form">fields</form></AuthLayout>);
    expect(screen.getByTestId('test-form')).toBeInTheDocument();
  });

  it('should render footer when provided', () => {
    render(<AuthLayout footer={<a href="/login">Sign in</a>}>content</AuthLayout>);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('should not render footer container when footer is omitted', () => {
    const { container } = render(<AuthLayout>content</AuthLayout>);
    // The footer would be the mt-6 text-center div. When omitted, there should be
    // only the card div as a direct child of the width wrapper.
    const widthWrapper = container.querySelector('.sm\\:mx-auto:last-child');
    expect(widthWrapper?.children).toHaveLength(1); // just the card
  });

  it('should link logo to home page', () => {
    render(<AuthLayout>content</AuthLayout>);
    const logoLink = screen.getByText('FlashNote').closest('a');
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('applies shadow-fn-base to the card container', () => {
    const { container } = render(<AuthLayout>content</AuthLayout>);
    const card = container.querySelector('.card');
    expect(card).toHaveClass('shadow-fn-base');
  });
});
