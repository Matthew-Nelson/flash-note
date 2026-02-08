import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from './LoginForm';
import { api } from '@/shared/api';

vi.mock('@/shared/api', () => ({
  api: {
    requestPasswordReset: vi.fn(),
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
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    it('should call onLogin with email and password', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.click(screen.getByText('Sign In'));

      await waitFor(() => {
        expect(onLogin).toHaveBeenCalledWith('test@example.com', 'Password1');
      });
    });

    it('should show validation errors for empty fields', async () => {
      const user = userEvent.setup();
      renderForm();

      // Type an invalid email and leave password empty (just click submit)
      await user.type(screen.getByLabelText('Email'), 'bad-email');
      await user.click(screen.getByText('Sign In'));

      await waitFor(() => {
        expect(onLogin).not.toHaveBeenCalled();
      });
    });

    it('should show API error message', async () => {
      onLogin.mockRejectedValue(new Error('Invalid credentials'));
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'wrong');
      await user.click(screen.getByText('Sign In'));

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });
    });

    it('should show generic error for non-Error throws', async () => {
      onLogin.mockRejectedValue('string error');
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.click(screen.getByText('Sign In'));

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
      });
    });

    it('should show loading state during login', async () => {
      let resolveLogin: () => void;
      onLogin.mockReturnValue(new Promise<void>((r) => { resolveLogin = r; }));

      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.click(screen.getByText('Sign In'));

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
      expect(screen.getByText('Create Account')).toBeInTheDocument();
    });

    it('should call onRegister on signup', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText(/sign up/i));
      await user.type(screen.getByLabelText('Email'), 'new@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.type(screen.getByLabelText('Confirm Password'), 'Password1');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(onRegister).toHaveBeenCalledWith('new@example.com', 'Password1', true);
      });
    });

    it('should validate password policy on signup', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText(/sign up/i));
      await user.type(screen.getByLabelText('Email'), 'new@example.com');
      await user.type(screen.getByLabelText('Password'), 'short');
      await user.type(screen.getByLabelText('Confirm Password'), 'short');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(onRegister).not.toHaveBeenCalled();
      });
    });

    it('should show validation error when checkbox is unchecked', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText(/sign up/i));
      await user.type(screen.getByLabelText('Email'), 'new@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password1');
      await user.type(screen.getByLabelText('Confirm Password'), 'Password1');
      // Do NOT check the checkbox
      await user.click(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(onRegister).not.toHaveBeenCalled();
        expect(screen.getByText('You must accept the legal terms to create an account')).toBeInTheDocument();
      });
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
      expect(screen.getByText('Create Account')).toBeInTheDocument();

      await user.click(screen.getByText(/sign in/i));
      expect(screen.getByText('Sign In')).toBeInTheDocument();
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

    it('should show success message on password reset', async () => {
      vi.mocked(api.requestPasswordReset).mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));
      await user.type(screen.getByLabelText('Email'), 'test@example.com');
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
      await user.type(screen.getByLabelText('Email'), 'nonexistent@example.com');
      await user.click(screen.getByText('Send reset link'));

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
    });

    it('should show rate limit error', async () => {
      vi.mocked(api.requestPasswordReset).mockRejectedValue(
        new Error('Too many attempts. Please try again later.')
      );
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));
      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.click(screen.getByText('Send reset link'));

      await waitFor(() => {
        expect(screen.getByText(/Too many attempts/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for empty email on forgot password', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));

      // Submit form directly to bypass native HTML validation on type="email" + required
      const form = screen.getByText('Send reset link').closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should show validation error for email without @ on forgot password', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));
      await user.type(screen.getByLabelText('Email'), 'notanemail');

      // Submit form directly to bypass native HTML validation
      const form = screen.getByText('Send reset link').closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should go back to login', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByText('Forgot password?'));
      await user.click(screen.getByText('Back to sign in'));
      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });
  });
});
