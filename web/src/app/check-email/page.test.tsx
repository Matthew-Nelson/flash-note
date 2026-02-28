import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CheckEmailPage from './page';

// Mock auth components barrel to avoid transitive server imports (LogoutButton → actions → db config)
vi.mock('@/components/auth', () => ({
  AuthLayout: ({ children, title, footer }: { children: React.ReactNode; title: string; footer?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
      {footer}
    </div>
  ),
}));

describe('CheckEmailPage', () => {
  it('renders verification message', () => {
    render(<CheckEmailPage />);
    expect(screen.getByText(/sent a verification link/i)).toBeInTheDocument();
  });

  it('renders resend link to /resend-verification', () => {
    render(<CheckEmailPage />);
    const resendLink = screen.getByRole('link', { name: /resend/i });
    expect(resendLink).toHaveAttribute('href', '/resend-verification');
  });

  it('renders back to sign in link', () => {
    render(<CheckEmailPage />);
    const link = screen.getByText('Back to sign in');
    expect(link).toHaveAttribute('href', '/login');
  });

  it('renders expiry notice', () => {
    render(<CheckEmailPage />);
    expect(screen.getByText(/expire in 24 hours/i)).toBeInTheDocument();
  });
});
