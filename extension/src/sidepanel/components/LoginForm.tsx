import { useState } from 'react';
import { validateLogin, validateRegister, validateEmail } from '@/shared/schemas';
import { api, ApiError } from '@/shared/api';
import SessionAlert from './SessionAlert';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<unknown>;
  onRegister: (email: string, password: string, acceptedLegalTerms: boolean, inviteCode?: string) => Promise<unknown>;
}

type ViewMode = 'login' | 'signup' | 'forgotPassword';

export default function LoginForm({ onLogin, onRegister }: LoginFormProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setInvalidFields(new Set());

    // Validate input with Zod
    const validation = viewMode === 'signup'
      ? validateRegister({ email, password, confirmPassword, acceptedLegalTerms, inviteCode: inviteCode || undefined })
      : validateLogin({ email, password });

    if (!validation.success) {
      setErrors(validation.errors);
      setInvalidFields(new Set(validation.invalidFields));
      return;
    }

    setIsLoading(true);

    try {
      if (viewMode === 'signup') {
        await onRegister(email, password, acceptedLegalTerms, inviteCode || undefined);
      } else {
        await onLogin(email, password);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          // Login errors
          case 'invalid_credentials':
            setErrors(['Invalid email or password.']);
            setInvalidFields(new Set(['email', 'password']));
            break;
          case 'account_locked':
            setErrors(['Account locked due to too many failed attempts. Try again later.']);
            break;
          case 'email_not_verified':
            setErrors(['Please verify your email before signing in.']);
            break;
          // Registration errors
          case 'email_exists':
            setErrors(['An account with this email already exists.']);
            setInvalidFields(new Set(['email']));
            break;
          case 'weak_password':
            setErrors(['Password does not meet requirements.']);
            setInvalidFields(new Set(['password']));
            break;
          case 'registration_closed':
            setErrors(['Registration is not available at this time.']);
            break;
          case 'invite_code_required':
            setErrors(['An invite code is required to register.']);
            setInvalidFields(new Set(['inviteCode']));
            break;
          case 'invalid_invite_code':
            setErrors(['This invite code is invalid or has expired.']);
            setInvalidFields(new Set(['inviteCode']));
            break;
          case 'no_seats_available':
            setErrors(['This clinic has reached its maximum number of users. Contact your administrator.']);
            break;
          case 'rate_limit_exceeded':
            setErrors(['Too many attempts. Please try again later.']);
            break;
          default:
            setErrors(['Something went wrong. Please try again.']);
        }
      } else {
        setErrors(['Something went wrong. Please try again.']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setInvalidFields(new Set());

    const emailValidation = validateEmail(email);
    if (!emailValidation.success) {
      setErrors(emailValidation.errors);
      setInvalidFields(new Set(emailValidation.invalidFields));
      return;
    }

    setIsLoading(true);

    try {
      await api.requestPasswordReset(email);
      setResetEmailSent(true);
    } catch (err) {
      // Always show success to prevent email enumeration
      // Only show error for rate limiting
      if (err instanceof ApiError && err.code === 'rate_limit_exceeded') {
        setErrors(['Too many attempts. Please try again later.']);
      } else {
        setResetEmailSent(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setViewMode('login');
    setResetEmailSent(false);
    setErrors([]);
    setInvalidFields(new Set());
  };

  // Forgot Password View
  if (viewMode === 'forgotPassword') {
    return (
      <div className="app-container flex flex-col justify-center flex-1 px-6 py-8">
        <div className="text-center mb-8 animate-fade-in-up">
          <h1 className="flex items-center justify-center gap-2">
            <span className="app-title text-2xl font-bold">FlashNote</span>
            <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-stone-400 text-stone-400">BETA</span>
          </h1>
          <h2 className="mt-3 text-center text-lg font-bold text-fn-text-primary">
            Reset your password
          </h2>
        </div>

        {resetEmailSent ? (
          <div className="animate-fade-in-up stagger-2">
            <div className="success-message text-sm px-4 py-3 rounded-lg mb-4">
              <p className="font-medium">Check your email</p>
              <p className="mt-1 opacity-90">
                If an account exists with that email, we've sent a password reset link.
              </p>
            </div>
            <p className="text-xs opacity-70 text-center mb-6">
              The link will expire in 15 minutes for security.
            </p>
            <button
              type="button"
              onClick={handleBackToLogin}
              className="link text-sm w-full text-center"
            >
              Back to login
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleForgotPassword} className="space-y-4 animate-fade-in-up stagger-2" noValidate>
              <div>
                <label htmlFor="reset-email" className="label block text-sm mb-1">
                  Email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`input-field w-full px-3 py-2${invalidFields.has('email') ? ' input-field-error' : ''}`}
                />
              </div>

              {errors.length > 0 && (
                <div className="error-message text-sm px-3 py-2 animate-fade-in" role="alert">
                  {errors[0]}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full flex justify-center py-3 px-4 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>

            <div className="mt-6 text-center animate-fade-in stagger-4">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="link text-sm"
              >
                Back to login
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Login/Signup View
  return (
    <div className="app-container flex flex-col justify-center flex-1 px-6 py-8">
      <div className="text-center mb-8 animate-fade-in-up">
        <h1 className="flex items-center justify-center gap-2">
          <span className="app-title text-2xl font-bold">FlashNote</span>
          <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-stone-400 text-stone-400">BETA</span>
        </h1>
        {viewMode === 'login' && (
          <h2 className="mt-3 text-center text-lg font-bold text-fn-text-primary">
            Sign in to your account
          </h2>
        )}
        {viewMode === 'signup' && (
          <>
            <h2 className="mt-3 text-center text-lg font-bold text-fn-text-primary">
              Create your account
            </h2>
            <p className="mt-1 text-center text-sm text-fn-text-secondary">
              Start your 14-day free trial
            </p>
          </>
        )}
      </div>

      {/* Session alert for forced logout scenarios */}
      <SessionAlert />

      <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in-up stagger-2" noValidate>
        <div>
          <label htmlFor="email" className="label block text-sm mb-1">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`input-field w-full px-3 py-2${invalidFields.has('email') ? ' input-field-error' : ''}`}
          />
        </div>

        <div>
          <label htmlFor="password" className="label block text-sm mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`input-field w-full px-3 py-2${invalidFields.has('password') ? ' input-field-error' : ''}`}
          />
          {viewMode === 'signup' && (
            <p className="mt-1.5 text-sm text-fn-text-muted">
              Min 8 characters, 1 uppercase, 1 lowercase, 1 number
            </p>
          )}
          {viewMode === 'login' && (
            <div className="mt-1 text-right">
              <button
                type="button"
                onClick={() => {
                  setViewMode('forgotPassword');
                  setErrors([]);
                }}
                className="link text-sm"
              >
                Forgot password?
              </button>
            </div>
          )}
        </div>

        {viewMode === 'signup' && (
          <div>
            <label htmlFor="confirmPassword" className="label block text-sm mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`input-field w-full px-3 py-2${invalidFields.has('confirmPassword') ? ' input-field-error' : ''}`}
            />
          </div>
        )}

        {viewMode === 'signup' && (
          <div>
            <label htmlFor="inviteCode" className="label block text-sm mb-1">
              Invite Code
            </label>
            <input
              id="inviteCode"
              type="text"
              autoComplete="off"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className={`input-field w-full px-3 py-2${invalidFields.has('inviteCode') ? ' input-field-error' : ''}`}
              placeholder="Format: XXXX-XXXX"
            />
          </div>
        )}

        {viewMode === 'signup' && (
          <div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedLegalTerms}
                onChange={(e) => setAcceptedLegalTerms(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span className="text-sm text-fn-text-secondary">
                I agree to the{' '}
                <a href="https://flashnote.co/baa" target="_blank" rel="noopener noreferrer" className="link">
                  Business Associate Agreement
                </a>
                ,{' '}
                <a href="https://flashnote.co/terms" target="_blank" rel="noopener noreferrer" className="link">
                  Terms of Service
                </a>
                , and{' '}
                <a href="https://flashnote.co/privacy" target="_blank" rel="noopener noreferrer" className="link">
                  Privacy Policy
                </a>
              </span>
            </label>
          </div>
        )}

        {errors.length > 0 && (
          <div className="error-message text-sm px-3 py-2 animate-fade-in" role="alert">
            {errors.length === 1 ? (
              errors[0]
            ) : (
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full flex justify-center py-3 px-4 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading...
            </span>
          ) : viewMode === 'signup' ? (
            'Create account'
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <div className="mt-6 text-center animate-fade-in stagger-4">
        <button
          type="button"
          onClick={() => {
            setViewMode(viewMode === 'signup' ? 'login' : 'signup');
            setConfirmPassword('');
            setInviteCode('');
            setAcceptedLegalTerms(false);
            setErrors([]);
            setInvalidFields(new Set());
          }}
          className="link text-sm"
        >
          {viewMode === 'signup'
            ? 'Already have an account? Sign in'
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
