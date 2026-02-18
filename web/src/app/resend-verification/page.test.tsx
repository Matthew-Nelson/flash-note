import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResendVerificationPage from './page';
import { api, ApiError } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...original,
    api: {
      resendVerificationEmail: vi.fn(),
    },
  };
});

describe('ResendVerificationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the resend verification form with AuthLayout', () => {
    render(<ResendVerificationPage />);
    expect(screen.getByText('FlashNote')).toBeInTheDocument();
    expect(screen.getByText('BETA')).toBeInTheDocument();
    expect(screen.getByText('Resend verification email')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByText('Send verification email')).toBeInTheDocument();
  });

  it('should not have placeholder on email input', () => {
    render(<ResendVerificationPage />);
    expect(screen.getByLabelText('Email address')).not.toHaveAttribute('placeholder');
  });

  it('should render green back to login link', () => {
    render(<ResendVerificationPage />);
    const link = screen.getByText('Back to login');
    expect(link).toHaveAttribute('href', '/login');
    expect(link.className).toContain('link');
  });

  it('should show validation error for empty email', async () => {
    const user = userEvent.setup();
    render(<ResendVerificationPage />);

    await user.click(screen.getByText('Send verification email'));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
    expect(api.resendVerificationEmail).not.toHaveBeenCalled();
  });

  it('should show validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(<ResendVerificationPage />);

    await user.type(screen.getByLabelText('Email address'), 'bad');
    await user.click(screen.getByText('Send verification email'));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
    expect(api.resendVerificationEmail).not.toHaveBeenCalled();
  });

  it('should submit and show success for valid email', async () => {
    vi.mocked(api.resendVerificationEmail).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<ResendVerificationPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send verification email'));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
    expect(api.resendVerificationEmail).toHaveBeenCalledWith('test@example.com');
  });

  it('should show error for too_many_attempts', async () => {
    vi.mocked(api.resendVerificationEmail).mockRejectedValueOnce(
      new ApiError(429, 'too_many_attempts', 'Rate limited')
    );
    const user = userEvent.setup();
    render(<ResendVerificationPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send verification email'));

    await waitFor(() => {
      expect(screen.getByText('Too many attempts. Please try again later.')).toBeInTheDocument();
    });
  });

  it('should show success for non-rate-limit errors (hide account existence)', async () => {
    vi.mocked(api.resendVerificationEmail).mockRejectedValueOnce(
      new ApiError(404, 'user_not_found', 'No such user')
    );
    const user = userEvent.setup();
    render(<ResendVerificationPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send verification email'));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
  });
});
