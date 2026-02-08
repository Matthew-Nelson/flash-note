import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgotPasswordPage from './page';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

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
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should show validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should submit and show success for valid email', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
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
    mockFetch.mockResolvedValueOnce({ ok: true });
    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.click(screen.getByText('Send reset link'));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
  });
});
