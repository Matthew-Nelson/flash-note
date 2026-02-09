import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSearchParams } from 'next/navigation';
import ResetPasswordPage from './page';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: provide a valid token so the form renders
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('token=valid-token') as ReturnType<typeof useSearchParams>
    );
    // Mock token validation to succeed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { valid: true } }),
    });
  });

  it('should show invalid state when no token', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );
    // Reset the token validation mock since it won't be called
    mockFetch.mockReset();

    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByText('Invalid or Expired Link')).toBeInTheDocument();
    });
  });

  it('should render AuthLayout elements in invalid state', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );
    mockFetch.mockReset();

    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByText('FlashNote')).toBeInTheDocument();
      expect(screen.getByText('BETA')).toBeInTheDocument();
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

    // Mock the reset API call (second fetch after token validation)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await user.type(screen.getByLabelText('New password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Password1');
    await user.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(screen.getByText('Password Reset Successfully')).toBeInTheDocument();
    });
  });
});
