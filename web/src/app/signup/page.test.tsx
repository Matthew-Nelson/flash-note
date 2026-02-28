import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import SignupPage from './page';
import { registerAction } from '@/actions/auth';
import type { ActionResult } from '@/actions/auth';
import type { SanitizedUser } from '@/server/services/auth';

vi.mock('@/actions/auth', () => ({
  registerAction: vi.fn(),
  logoutAction: vi.fn(),
  requestPasswordResetAction: vi.fn(),
}));

const mockPush = vi.fn();

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      back: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
      forward: vi.fn(),
    });
  });

  const fillForm = async (
    user: ReturnType<typeof userEvent.setup>,
    overrides: { email?: string; password?: string; confirmPassword?: string; skipLegal?: boolean } = {},
  ) => {
    const {
      email = 'test@example.com',
      password = 'Password1',
      confirmPassword = 'Password1',
      skipLegal = false,
    } = overrides;

    await user.type(screen.getByLabelText('Email address'), email);
    await user.type(screen.getByLabelText('Password'), password);
    await user.type(screen.getByLabelText('Confirm Password'), confirmPassword);
    if (!skipLegal) {
      await user.click(screen.getByRole('checkbox'));
    }
  };

  it('renders form elements', () => {
    render(<SignupPage />);

    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Invite Code')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('validates empty fields client-side and does not call registerAction', async () => {
    const user = userEvent.setup();
    render(<SignupPage />);

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(registerAction).not.toHaveBeenCalled();
  });

  it('calls registerAction and redirects to /verify-email on success', async () => {
    const successResult: ActionResult<{ user: SanitizedUser }> = {
      success: true,
      data: {
        user: {
          id: '123',
          email: 'test@example.com',
          subscriptionStatus: 'trialing',
          trialEndsAt: new Date(),
          emailVerified: false,
          organizationId: null,
        } as SanitizedUser,
      },
    };
    vi.mocked(registerAction).mockResolvedValueOnce(successResult);

    const user = userEvent.setup();
    render(<SignupPage />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/resend-verification');
    });
    expect(registerAction).toHaveBeenCalledTimes(1);
  });

  it('shows curated error for registration_failed', async () => {
    vi.mocked(registerAction).mockResolvedValueOnce({
      success: false,
      error: 'registration_failed',
    });

    const user = userEvent.setup();
    render(<SignupPage />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('Registration could not be completed. Please try again or sign in.')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows curated error for invalid_invite_code', async () => {
    vi.mocked(registerAction).mockResolvedValueOnce({
      success: false,
      error: 'invalid_invite_code',
    });

    const user = userEvent.setup();
    render(<SignupPage />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('This invite code is invalid or has expired.')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows curated error for rate_limit_exceeded', async () => {
    vi.mocked(registerAction).mockResolvedValueOnce({
      success: false,
      error: 'rate_limit_exceeded',
    });

    const user = userEvent.setup();
    render(<SignupPage />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('Too many attempts. Please try again later.')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows generic error on unexpected exception', async () => {
    vi.mocked(registerAction).mockRejectedValueOnce(new Error('network failure'));

    const user = userEvent.setup();
    render(<SignupPage />);

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('renders "Already have an account? Sign in" link pointing to /login', () => {
    render(<SignupPage />);

    const link = screen.getByText('Already have an account? Sign in');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/login');
  });
});
