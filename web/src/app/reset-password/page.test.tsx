import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSearchParams } from 'next/navigation';
import ResetPasswordPage from './page';
import { api } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...original,
    api: {
      validateResetToken: vi.fn(),
      resetPassword: vi.fn(),
    },
  };
});

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: provide a valid token so the form renders
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('token=valid-token') as ReturnType<typeof useSearchParams>
    );
    // Mock token validation to succeed
    vi.mocked(api.validateResetToken).mockResolvedValueOnce({ valid: true });
  });

  it('should show invalid state when no token', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );
    vi.mocked(api.validateResetToken).mockReset();

    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByText('Invalid or Expired Link')).toBeInTheDocument();
    });
  });

  it('should render AuthLayout elements in invalid state', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );
    vi.mocked(api.validateResetToken).mockReset();

    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByText('FlashNote')).toBeInTheDocument();
      expect(screen.getByText('BETA')).toBeInTheDocument();
    });
  });

  it('should show invalid state when token validation fails', async () => {
    vi.mocked(api.validateResetToken).mockReset();
    vi.mocked(api.validateResetToken).mockResolvedValueOnce({ valid: false });

    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByText('Invalid or Expired Link')).toBeInTheDocument();
    });
  });

  it('should show invalid state when token validation throws', async () => {
    vi.mocked(api.validateResetToken).mockReset();
    vi.mocked(api.validateResetToken).mockRejectedValueOnce(new Error('Network'));

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

    vi.mocked(api.resetPassword).mockResolvedValueOnce(undefined);

    await user.type(screen.getByLabelText('New password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Password1');
    await user.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(screen.getByText('Password Reset Successfully')).toBeInTheDocument();
    });
    expect(api.resetPassword).toHaveBeenCalledWith('valid-token', 'Password1');
  });

  it('should show curated error on reset failure', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toBeInTheDocument();
    });

    vi.mocked(api.resetPassword).mockRejectedValueOnce(new Error('Server error'));

    await user.type(screen.getByLabelText('New password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Password1');
    await user.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(screen.getByText('Failed to reset password. The link may have expired.')).toBeInTheDocument();
    });
  });
});
