import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionAlert } from './SessionAlert';

// Mock the Alert component
vi.mock('../ui', () => ({
  Alert: ({ children, variant }: { children: React.ReactNode; variant: string }) => (
    <div data-testid="alert" data-variant={variant}>{children}</div>
  ),
}));

describe('SessionAlert', () => {
  it('should show message for session_invalidated', () => {
    render(<SessionAlert reason="session_invalidated" />);
    expect(screen.getByText(/session was invalidated/i)).toBeInTheDocument();
  });

  it('should show message for session_expired', () => {
    render(<SessionAlert reason="session_expired" />);
    expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
  });

  it('should show message for session_limit', () => {
    render(<SessionAlert reason="session_limit" />);
    expect(screen.getByText(/signed in on another device/i)).toBeInTheDocument();
  });

  it('should show message for session_revoked', () => {
    render(<SessionAlert reason="session_revoked" />);
    expect(screen.getByText(/revoked for security reasons/i)).toBeInTheDocument();
  });

  it('should show dismiss button when onDismiss is provided', () => {
    render(<SessionAlert reason="session_expired" onDismiss={() => {}} />);
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<SessionAlert reason="session_expired" onDismiss={onDismiss} />);

    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should NOT show dismiss button when onDismiss is not provided', () => {
    render(<SessionAlert reason="session_expired" />);
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });
});
