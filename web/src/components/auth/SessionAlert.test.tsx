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
    vi.clearAllMocks();
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );
    // Mock window.history.replaceState
    Object.defineProperty(window, 'history', {
      value: { replaceState: mockReplaceState },
      writable: true,
    });
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

  it('should show message for logged_out', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=logged_out') as ReturnType<typeof useSearchParams>
    );
    render(<SessionAlert />);
    expect(screen.getByText('You have been signed out.')).toBeInTheDocument();
  });

  it('should show message for session_expired', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=session_expired') as ReturnType<typeof useSearchParams>
    );
    render(<SessionAlert />);
    expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
  });

  it('should show message for session_invalidated', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=session_invalidated') as ReturnType<typeof useSearchParams>
    );
    render(<SessionAlert />);
    expect(screen.getByText(/session was invalidated/i)).toBeInTheDocument();
  });

  it('should show message for session_limit', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=session_limit') as ReturnType<typeof useSearchParams>
    );
    render(<SessionAlert />);
    expect(screen.getByText(/signed in on another device/i)).toBeInTheDocument();
  });

  it('should show message for session_revoked', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=session_revoked') as ReturnType<typeof useSearchParams>
    );
    render(<SessionAlert />);
    expect(screen.getByText(/revoked for security reasons/i)).toBeInTheDocument();
  });

  it('should clear URL param on mount', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=logged_out') as ReturnType<typeof useSearchParams>
    );
    render(<SessionAlert />);
    expect(mockReplaceState).toHaveBeenCalled();
  });

  it('should dismiss when dismiss button is clicked', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=session_expired') as ReturnType<typeof useSearchParams>
    );
    const user = userEvent.setup();
    render(<SessionAlert />);

    expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/session has expired/i)).not.toBeInTheDocument();
  });

  it('should render as warning variant', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('reason=logged_out') as ReturnType<typeof useSearchParams>
    );
    render(<SessionAlert />);
    expect(screen.getByTestId('alert')).toHaveAttribute('data-variant', 'warning');
  });
});
