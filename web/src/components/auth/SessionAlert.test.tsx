import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSearchParams } from 'next/navigation';
import { SessionAlert } from './SessionAlert';

vi.mock('../ui', () => ({
  Alert: ({ children, variant }: { children: React.ReactNode; variant: string }) => (
    <div data-testid="alert" data-variant={variant}>{children}</div>
  ),
}));

const mockReplaceState = vi.fn();

describe('SessionAlert', () => {
  beforeEach(() => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );
    vi.stubGlobal('history', { replaceState: mockReplaceState });
  });

  it('should render nothing when no reason param', () => {
    const { container } = render(<SessionAlert />);
    expect(container.innerHTML).toBe('');
  });

  it('should render nothing for invalid reason param', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=bogus_value') as ReturnType<typeof useSearchParams>
    );
    const { container } = render(<SessionAlert />);
    expect(container.innerHTML).toBe('');
  });

  it('should show message for session_expired', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=session_expired') as ReturnType<typeof useSearchParams>
    );
    render(<SessionAlert />);
    expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  });

  it('should show message for session_invalidated', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=session_invalidated') as ReturnType<typeof useSearchParams>
    );
    render(<SessionAlert />);
    expect(
      screen.getByText(
        'Your session was invalidated. This may happen after a password reset. Please sign in again.'
      )
    ).toBeInTheDocument();
  });

  it('should show message for session_limit', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=session_limit') as ReturnType<typeof useSearchParams>
    );
    render(<SessionAlert />);
    expect(
      screen.getByText('You were signed out because you signed in on another device.')
    ).toBeInTheDocument();
  });

  it('should show message for session_revoked', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=session_revoked') as ReturnType<typeof useSearchParams>
    );
    render(<SessionAlert />);
    expect(
      screen.getByText('Your session was revoked for security reasons. Please sign in again.')
    ).toBeInTheDocument();
  });

  it('should clear URL param on mount', () => {
    vi.stubGlobal('location', { href: 'http://localhost:3000/login?reason=session_expired' });
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=session_expired') as ReturnType<typeof useSearchParams>
    );
    render(<SessionAlert />);
    expect(mockReplaceState).toHaveBeenCalledWith({}, '', 'http://localhost:3000/login');
  });

  it('should dismiss when dismiss button is clicked', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=session_expired') as ReturnType<typeof useSearchParams>
    );
    const user = userEvent.setup();
    render(<SessionAlert />);

    expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('Your session has expired. Please sign in again.')).not.toBeInTheDocument();
  });

  it('should render as warning variant', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=session_expired') as ReturnType<typeof useSearchParams>
    );
    render(<SessionAlert />);
    expect(screen.getByTestId('alert')).toHaveAttribute('data-variant', 'warning');
  });
});
