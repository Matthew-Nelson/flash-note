import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardError from './error';

// Mock UI components
vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

describe('DashboardError', () => {
  it('renders a curated error message (not error.message)', () => {
    const error = new Error('Internal DB connection pool exhausted');
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument();
    // Rule 2 + Rule 7: raw error message must NOT be displayed
    expect(screen.queryByText('Internal DB connection pool exhausted')).not.toBeInTheDocument();
  });

  it('calls reset when Try Again button is clicked', async () => {
    const user = userEvent.setup();
    const error = new Error('test error');
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    await user.click(screen.getByText('Try Again'));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('renders link to login page to escape the error loop', () => {
    const error = new Error('test error');
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    const link = screen.getByText('Return to sign in');
    expect(link.closest('a')).toHaveAttribute('href', '/login?reason=session_expired');
  });

  it('logs error digest for observability', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = Object.assign(new Error('secret details'), { digest: 'abc123' });
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    expect(consoleSpy).toHaveBeenCalledWith('Dashboard error:', 'abc123');
    consoleSpy.mockRestore();
  });
});
