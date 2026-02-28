import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResendVerificationPage from './page';

const mockResendVerificationAction = vi.fn();

vi.mock('@/actions/auth', () => ({
  resendVerificationAction: (...args: unknown[]) => mockResendVerificationAction(...args),
}));

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

  it('should render back to login link', () => {
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
    expect(mockResendVerificationAction).not.toHaveBeenCalled();
  });

  it('should show validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(<ResendVerificationPage />);

    await user.type(screen.getByLabelText('Email address'), 'bad');
    await user.click(screen.getByText('Send verification email'));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
    expect(mockResendVerificationAction).not.toHaveBeenCalled();
  });

  it('should submit and show success for valid email', async () => {
    mockResendVerificationAction.mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    render(<ResendVerificationPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send verification email'));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
    expect(mockResendVerificationAction).toHaveBeenCalledTimes(1);
    const formData = mockResendVerificationAction.mock.calls[0][0] as FormData;
    expect(formData.get('email')).toBe('test@example.com');
  });

  it('should show error for rate_limit_exceeded', async () => {
    mockResendVerificationAction.mockResolvedValueOnce({ success: false, error: 'rate_limit_exceeded' });
    const user = userEvent.setup();
    render(<ResendVerificationPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send verification email'));

    await waitFor(() => {
      expect(screen.getByText('Too many attempts. Please try again later.')).toBeInTheDocument();
    });
  });

  it('should show success for non-rate-limit errors (anti-enumeration)', async () => {
    mockResendVerificationAction.mockResolvedValueOnce({ success: false, error: 'some_other_error' });
    const user = userEvent.setup();
    render(<ResendVerificationPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send verification email'));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
  });

  it('should show error on unexpected exception', async () => {
    mockResendVerificationAction.mockRejectedValueOnce(new Error('network error'));
    const user = userEvent.setup();
    render(<ResendVerificationPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send verification email'));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again later.')).toBeInTheDocument();
    });
  });

  it('should clear errors when resubmitting', async () => {
    const user = userEvent.setup();
    render(<ResendVerificationPage />);

    await user.click(screen.getByText('Send verification email'));
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    mockResendVerificationAction.mockResolvedValueOnce({ success: true });
    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send verification email'));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
  });
});
