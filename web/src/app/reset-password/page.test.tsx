import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSearchParams } from 'next/navigation';
import ResetPasswordPage from './page';

const mockValidateResetTokenAction = vi.hoisted(() => vi.fn());
const mockResetPasswordAction = vi.hoisted(() => vi.fn());

vi.mock('@/actions/auth', () => ({
  validateResetTokenAction: mockValidateResetTokenAction,
  resetPasswordAction: mockResetPasswordAction,
}));

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: provide a valid token so the form renders
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('token=valid-token') as ReturnType<typeof useSearchParams>
    );
    // Mock token validation to succeed
    mockValidateResetTokenAction.mockResolvedValueOnce({ success: true, data: { valid: true } });
  });

  it('should show invalid state when no token', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );
    mockValidateResetTokenAction.mockReset();

    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByText('Invalid or Expired Link')).toBeInTheDocument();
    });
  });

  it('should render AuthLayout elements in invalid state', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );
    mockValidateResetTokenAction.mockReset();

    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByText('FlashNote')).toBeInTheDocument();
      expect(screen.getByText('BETA')).toBeInTheDocument();
    });
  });

  it('should show invalid state when token validation returns invalid', async () => {
    mockValidateResetTokenAction.mockReset();
    mockValidateResetTokenAction.mockResolvedValueOnce({ success: true, data: { valid: false } });

    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByText('Invalid or Expired Link')).toBeInTheDocument();
    });
  });

  it('should show invalid state when token validation throws', async () => {
    mockValidateResetTokenAction.mockReset();
    mockValidateResetTokenAction.mockRejectedValueOnce(new Error('Network'));

    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByText('Invalid or Expired Link')).toBeInTheDocument();
    });
  });

  it('should render the reset form after token validation', async () => {
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
    expect(screen.getByText('Reset password')).toBeInTheDocument();
  });

  it('should render AuthLayout elements in ready state', async () => {
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText('FlashNote')).toBeInTheDocument();
    });
    expect(screen.getByText('BETA')).toBeInTheDocument();
    expect(screen.getByText('Create a new password')).toBeInTheDocument();
  });

  it('should show validation error for empty password', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText('Reset password')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('should show validation error for weak password', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('New password'), 'weak');
    await user.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('should show validation error for empty confirm password', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('New password'), 'Password1');
    await user.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
    });
  });

  it('should show validation error for mismatched passwords', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('New password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Different1');
    await user.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('should submit successfully with valid passwords', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toBeInTheDocument();
    });

    mockResetPasswordAction.mockResolvedValueOnce({ success: true });

    await user.type(screen.getByLabelText('New password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Password1');
    await user.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(screen.getByText('Password Reset Successfully')).toBeInTheDocument();
    });
    expect(mockResetPasswordAction).toHaveBeenCalledTimes(1);
    const formData = mockResetPasswordAction.mock.calls[0][0] as FormData;
    expect(formData.get('token')).toBe('valid-token');
    expect(formData.get('password')).toBe('Password1');
  });

  it('should show curated error on reset failure', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toBeInTheDocument();
    });

    mockResetPasswordAction.mockResolvedValueOnce({ success: false, error: 'reset_failed' });

    await user.type(screen.getByLabelText('New password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Password1');
    await user.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(screen.getByText('Failed to reset password. The link may have expired.')).toBeInTheDocument();
    });
  });

  it('should show rate limit error', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toBeInTheDocument();
    });

    mockResetPasswordAction.mockResolvedValueOnce({ success: false, error: 'rate_limit_exceeded' });

    await user.type(screen.getByLabelText('New password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Password1');
    await user.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(screen.getByText('Too many attempts. Please try again later.')).toBeInTheDocument();
    });
  });

  it('should show curated error on unexpected exception', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toBeInTheDocument();
    });

    mockResetPasswordAction.mockRejectedValueOnce(new Error('Server error'));

    await user.type(screen.getByLabelText('New password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Password1');
    await user.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(screen.getByText('Failed to reset password. The link may have expired.')).toBeInTheDocument();
    });
  });
});
