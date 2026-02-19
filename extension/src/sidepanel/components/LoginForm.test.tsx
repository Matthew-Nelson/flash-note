import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from './LoginForm';
import { api, ApiError } from '@/shared/api';

vi.mock('@/shared/api', () => ({
  api: {
    requestPasswordReset: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
      this.name = 'ApiError';
    }
  },
  AUTH_INVALIDATED_EVENT: 'flashnote:auth-invalidated',
}));

describe('LoginForm', () => {
  const onLogin = vi.fn();
  const onRegister = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onLogin.mockResolvedValue(undefined);
    onRegister.mockResolvedValue(undefined);
  });

  function renderForm() {
    return render(<LoginForm onLogin={onLogin} onRegister={onRegister} />);
  }

  describe('login view', () => {
    it('should render login form by default', () => {
      renderForm();
      expect(screen.getByText('Sign in')).toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    it('should render login heading', () => {
      renderForm();
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    it('should call onLogin with email and password', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.click(screen.getByText('Sign in'));

      await waitFor(() => {
        expect(onLogin).toHaveBeenCalledWith('test@example.com', 'Password1');
      });
    });

    it('should show validation errors for empty fields', async () => {
      const user = userEvent.setup();
      renderForm();

      // Type an invalid email and leave password empty (just click submit)
      await user.type(screen.getByLabelText('Email address'), 'bad-email');
      await user.click(screen.getByText('Sign in'));

      await waitFor(() => {
        expect(onLogin).not.toHaveBeenCalled();
      });
    });

    it('should add error border to invalid fields on validation failure', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText('Email address'), 'bad-email');
      await user.click(screen.getByText('Sign in'));

      await waitFor(() => {
        expect(screen.getByLabelText('Email address').className).toContain('input-field-error');
        expect(screen.getByLabelText('Password').className).toContain('input-field-error');
      });
    });

    it('should clear error borders when resubmitting', async () => {
      const user = userEvent.setup();
      renderForm();

      // Trigger validation errors
      await user.type(screen.getByLabelText('Email address'), 'bad');
      await user.click(screen.getByText('Sign in'));

      await waitFor(() => {
        expect(screen.getByLabelText('Email address').className).toContain('input-field-error');
      });

      // Clear and type valid data
      await user.clear(screen.getByLabelText('Email address'));
      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.click(screen.getByText('Sign in'));

      await waitFor(() => {
        expect(screen.getByLabelText('Email address').className).not.toContain('input-field-error');
        expect(screen.getByLabelText('Password').className).not.toContain('input-field-error');
      });
    });

    it('should show curated message for API errors, not raw backend message', async () => {
      onLogin.mockRejectedValue(new ApiError(401, 'invalid_credentials', 'raw backend detail'));
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'wrong');
      await user.click(screen.getByText('Sign in'));

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
      });
      // Must never show raw backend message
      expect(screen.queryByText('raw backend detail')).not.toBeInTheDocument();
    });

    it('should show default curated message for non-ApiError throws', async () => {
      onLogin.mockRejectedValue('string error');
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.click(screen.getByText('Sign in'));

      await waitFor(() => {
        expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
      });
    });

    it('should show loading state during login', async () => {
      let resolveLogin: () => void;
      onLogin.mockReturnValue(new Promise<void>((r) => { resolveLogin = r; }));

      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.click(screen.getByText('Sign in'));

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      resolveLogin!();
    });
  });

  describe('signup view', () => {
    it('should switch to signup view', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText(/sign up/i));
      expect(screen.getByText('Create account')).toBeInTheDocument();
    });

    it('should render signup heading and subtitle', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText(/sign up/i));
      expect(screen.getByText('Create your account')).toBeInTheDocument();
      expect(screen.getByText('Start your 14-day free trial')).toBeInTheDocument();
    });

    it('should call onRegister on signup', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText(/sign up/i));
      await user.type(screen.getByLabelText('Email address'), 'new@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.type(screen.getByLabelText('Confirm Password'), 'Password1');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByText('Create account'));

      await waitFor(() => {
        expect(onRegister).toHaveBeenCalledWith('new@example.com', 'Password1', true);
      });
    });

    it('should validate password policy on signup', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText(/sign up/i));
      await user.type(screen.getByLabelText('Email address'), 'new@example.com');
      await user.type(screen.getByLabelText('Password'), 'short');
      await user.type(screen.getByLabelText('Confirm Password'), 'short');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByText('Create account'));

      await waitFor(() => {
        expect(onRegister).not.toHaveBeenCalled();
      });
    });

    it('should show validation error when checkbox is unchecked', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText(/sign up/i));
      await user.type(screen.getByLabelText('Email address'), 'new@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.type(screen.getByLabelText('Confirm Password'), 'Password1');
      // Do NOT check the checkbox
      await user.click(screen.getByText('Create account'));

      await waitFor(() => {
        expect(onRegister).not.toHaveBeenCalled();
        expect(screen.getByText('You must accept the legal terms to create an account')).toBeInTheDocument();
      });
    });

    it('should show password hint in signup mode', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText(/sign up/i));
      expect(screen.getByText('Min 8 characters, 1 uppercase, 1 lowercase, 1 number')).toBeInTheDocument();
    });

    it('should not show password hint in login mode', () => {
      renderForm();
      expect(screen.queryByText('Min 8 characters, 1 uppercase, 1 lowercase, 1 number')).not.toBeInTheDocument();
    });

    it('should not show confirm password or checkbox in login mode', () => {
      renderForm();
      expect(screen.queryByLabelText('Confirm Password')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('should toggle back to login', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText(/sign up/i));
      expect(screen.getByText('Create account')).toBeInTheDocument();

      await user.click(screen.getByText(/sign in/i));
      expect(screen.getByText('Sign in')).toBeInTheDocument();
    });
  });

  describe('forgot password view', () => {
    it('should switch to forgot password view', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));
      expect(screen.getByText('Reset your password')).toBeInTheDocument();
      expect(screen.getByText('Send reset link')).toBeInTheDocument();
    });

    it('should add error border to email field on validation failure', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));
      await user.click(screen.getByText('Send reset link'));

      await waitFor(() => {
        expect(screen.getByLabelText('Email address').className).toContain('input-field-error');
      });
    });

    it('should show success message on password reset', async () => {
      vi.mocked(api.requestPasswordReset).mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));
      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.click(screen.getByText('Send reset link'));

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
    });

    it('should show success even on API error (prevent email enumeration)', async () => {
      vi.mocked(api.requestPasswordReset).mockRejectedValue(new Error('Not found'));
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));
      await user.type(screen.getByLabelText('Email address'), 'nonexistent@example.com');
      await user.click(screen.getByText('Send reset link'));

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
    });

    it('should show rate limit error using isRateLimited', async () => {
      vi.mocked(api.requestPasswordReset).mockRejectedValue(
        new ApiError(429, 'rate_limit_exceeded', 'Too many requests')
      );
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));
      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.click(screen.getByText('Send reset link'));

      await waitFor(() => {
        expect(screen.getByText('Too many attempts. Please try again later.')).toBeInTheDocument();
      });
    });

    it('should show success on non-rate-limit API errors (email enumeration prevention)', async () => {
      vi.mocked(api.requestPasswordReset).mockRejectedValue(
        new ApiError(404, 'user_not_found', 'User not found')
      );
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));
      await user.type(screen.getByLabelText('Email address'), 'test@example.com');
      await user.click(screen.getByText('Send reset link'));

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
    });

    it('should show validation error for empty email on forgot password', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));
      await user.click(screen.getByText('Send reset link'));

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should show validation error for email without @ on forgot password', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));
      await user.type(screen.getByLabelText('Email address'), 'notanemail');
      await user.click(screen.getByText('Send reset link'));

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should go back to login', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));
      await user.click(screen.getByText('Back to login'));
      expect(screen.getByText('Sign in')).toBeInTheDocument();
    });
  });
});
