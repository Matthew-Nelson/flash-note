import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgotPasswordPage from './page';
import { api, ApiError } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...original,
    api: {
      requestPasswordReset: vi.fn(),
    },
  };
});

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the forgot password form with AuthLayout', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByText('FlashNote')).toBeInTheDocument();
    expect(screen.getByText('BETA')).toBeInTheDocument();
    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByText('Send reset link')).toBeInTheDocument();
  });

  it('should not have placeholder on email input', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByLabelText('Email address')).not.toHaveAttribute('placeholder');
  });

  it('should render green back to login link', () => {
    render(<ForgotPasswordPage />);
    const link = screen.getByText('Back to login');
    expect(link).toHaveAttribute('href', '/login');
    expect(link.className).toContain('link');
  });

  it('should show validation error for empty email', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
    expect(api.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('should show validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
    expect(api.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('should submit and show success for valid email', async () => {
    vi.mocked(api.requestPasswordReset).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
    expect(api.requestPasswordReset).toHaveBeenCalledWith('test@example.com');
  });

  it('should show error for too_many_attempts', async () => {
    vi.mocked(api.requestPasswordReset).mockRejectedValueOnce(
      new ApiError(429, 'too_many_attempts', 'Rate limited')
    );
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Too many attempts. Please try again later.')).toBeInTheDocument();
    });
  });

  it('should show network error for TypeError (no internet)', async () => {
    vi.mocked(api.requestPasswordReset).mockRejectedValueOnce(
      new TypeError('Failed to fetch')
    );
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(
        screen.getByText('A network error occurred. Please check your connection and try again.')
      ).toBeInTheDocument();
    });
  });

  it('should show success for non-rate-limit errors (hide account existence)', async () => {
    vi.mocked(api.requestPasswordReset).mockRejectedValueOnce(
      new ApiError(404, 'user_not_found', 'No such user')
    );
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
  });

  it('should clear errors when resubmitting', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    // First submit — triggers validation error
    await user.click(screen.getByText('Send reset link'));
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    // Type valid email and resubmit
    vi.mocked(api.requestPasswordReset).mockResolvedValueOnce(undefined);
    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
  });
});
