import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AUTH_INVALIDATED_EVENT } from '@/shared/api';
import SessionAlert from './SessionAlert';

vi.mock('@/shared/api', () => ({
  AUTH_INVALIDATED_EVENT: 'flashnote:auth-invalidated',
}));

describe('Extension SessionAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when no event has been dispatched', () => {
    const { container } = render(<SessionAlert />);
    expect(container.innerHTML).toBe('');
  });

  it('should show alert for session_invalidated', () => {
    render(<SessionAlert />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_INVALIDATED_EVENT, {
          detail: { reason: 'session_invalidated' },
        })
      );
    });
    expect(screen.getByText('Session Ended')).toBeInTheDocument();
    expect(screen.getByText(/password was changed/i)).toBeInTheDocument();
  });

  it('should show alert for session_expired', () => {
    render(<SessionAlert />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_INVALIDATED_EVENT, {
          detail: { reason: 'session_expired' },
        })
      );
    });
    expect(screen.getByText('Session Expired')).toBeInTheDocument();
  });

  it('should show alert for session_limit', () => {
    render(<SessionAlert />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_INVALIDATED_EVENT, {
          detail: { reason: 'session_limit' },
        })
      );
    });
    expect(screen.getByText('Signed Out')).toBeInTheDocument();
    expect(screen.getByText(/signed in on another device/i)).toBeInTheDocument();
  });

  it('should show alert for session_revoked', () => {
    render(<SessionAlert />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_INVALIDATED_EVENT, {
          detail: { reason: 'session_revoked' },
        })
      );
    });
    expect(screen.getByText(/security reasons/i)).toBeInTheDocument();
  });

  it('should fall back to session_expired for missing reason', () => {
    render(<SessionAlert />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_INVALIDATED_EVENT, {
          detail: {},
        })
      );
    });
    expect(screen.getByText('Session Expired')).toBeInTheDocument();
  });

  it('should fall back to session_expired for unknown reason', () => {
    render(<SessionAlert />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_INVALIDATED_EVENT, {
          detail: { reason: 'unknown_reason' },
        })
      );
    });
    expect(screen.getByText('Session Expired')).toBeInTheDocument();
  });

  it('should dismiss and call onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<SessionAlert onDismiss={onDismiss} />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_INVALIDATED_EVENT, {
          detail: { reason: 'session_expired' },
        })
      );
    });

    expect(screen.getByText('Session Expired')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
