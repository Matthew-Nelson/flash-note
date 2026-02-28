import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgotPasswordPage from './page';

const mockRequestPasswordResetAction = vi.fn();

vi.mock('@/actions/auth', () => ({
  requestPasswordResetAction: (...args: unknown[]) => mockRequestPasswordResetAction(...args),
}));

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

  it('should render back to login link', () => {
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
    expect(mockRequestPasswordResetAction).not.toHaveBeenCalled();
  });

  it('should show validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
    expect(mockRequestPasswordResetAction).not.toHaveBeenCalled();
  });

  it('should submit and show success for valid email', async () => {
    mockRequestPasswordResetAction.mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
    expect(mockRequestPasswordResetAction).toHaveBeenCalledTimes(1);
    const formData = mockRequestPasswordResetAction.mock.calls[0][0] as FormData;
    expect(formData.get('email')).toBe('test@example.com');
  });

  it('should show error for rate_limit_exceeded', async () => {
    mockRequestPasswordResetAction.mockResolvedValueOnce({ success: false, error: 'rate_limit_exceeded' });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Too many attempts. Please try again later.')).toBeInTheDocument();
    });
  });

  it('should show success for non-rate-limit errors (anti-enumeration)', async () => {
    mockRequestPasswordResetAction.mockResolvedValueOnce({ success: false, error: 'some_other_error' });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
  });

  it('should show error on unexpected exception', async () => {
    mockRequestPasswordResetAction.mockRejectedValueOnce(new Error('network error'));
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again later.')).toBeInTheDocument();
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
    mockRequestPasswordResetAction.mockResolvedValueOnce({ success: true });
    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
  });
});
