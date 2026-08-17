import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import LoginPage from './page';
import { loginAction } from '@/actions/auth';

vi.mock('@/actions/auth', () => ({
  loginAction: vi.fn(),
  logoutAction: vi.fn(),
  requestPasswordResetAction: vi.fn(),
}));

const mockPush = vi.fn();

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      back: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
      forward: vi.fn(),
      bfcacheId: '',
    });
  });

  it('renders form elements', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('renders Forgot password link', () => {
    render(<LoginPage />);
    const link = screen.getByText('Forgot password?');
    expect(link).toHaveAttribute('href', '/forgot-password');
  });

  it('validates empty email and password client-side without calling loginAction', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(loginAction).not.toHaveBeenCalled();
  });

  it('validates invalid email client-side without calling loginAction', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'somepassword');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
    expect(loginAction).not.toHaveBeenCalled();
  });

  it('calls loginAction with FormData and redirects to /dashboard on success', async () => {
    vi.mocked(loginAction).mockResolvedValueOnce({
      success: true,
      data: {
        user: { id: 'u1', email: 'test@example.com' } as never,
        emailVerificationRequired: false,
      },
    });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(loginAction).toHaveBeenCalledTimes(1);
    });

    const formData = vi.mocked(loginAction).mock.calls[0][0];
    expect(formData.get('email')).toBe('test@example.com');
    expect(formData.get('password')).toBe('Password1');
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('shows curated error for invalid_credentials', async () => {
    vi.mocked(loginAction).mockResolvedValueOnce({
      success: false,
      error: 'invalid_credentials',
    });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'WrongPass1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows curated error for rate_limit_exceeded', async () => {
    vi.mocked(loginAction).mockResolvedValueOnce({
      success: false,
      error: 'rate_limit_exceeded',
    });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('Too many login attempts. Please try again later.')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows generic error for unknown error codes', async () => {
    vi.mocked(loginAction).mockResolvedValueOnce({
      success: false,
      error: 'some_unknown_error',
    });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to /resend-verification when emailVerificationRequired is true', async () => {
    vi.mocked(loginAction).mockResolvedValueOnce({
      success: true,
      data: {
        user: { id: 'u1', email: 'test@example.com' } as never,
        emailVerificationRequired: true,
      },
    });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/check-email');
    });
    expect(mockPush).not.toHaveBeenCalledWith('/dashboard');
  });

  it('shows generic error on unexpected exception', async () => {
    vi.mocked(loginAction).mockRejectedValueOnce(new Error('Network failure'));

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('renders Sign up link', () => {
    render(<LoginPage />);
    const link = screen.getByText("Don't have an account? Sign up");
    expect(link).toHaveAttribute('href', '/signup');
  });

  it('clears errors when resubmitting', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    vi.mocked(loginAction).mockResolvedValueOnce({
      success: true,
      data: {
        user: { id: 'u1', email: 'test@example.com' } as never,
        emailVerificationRequired: false,
      },
    });

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
    expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
    expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
  });
});
