import { useState } from 'react';
import { validateLogin, validateRegister } from '@/shared/schemas';
import { api } from '@/shared/api';
import SessionAlert from './SessionAlert';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<unknown>;
  onRegister: (email: string, password: string) => Promise<unknown>;
}

type ViewMode = 'login' | 'signup' | 'forgotPassword';

export default function LoginForm({ onLogin, onRegister }: LoginFormProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    // Validate input with Zod
    const validation = viewMode === 'signup'
      ? validateRegister({ email, password })
      : validateLogin({ email, password });

    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }

    setIsLoading(true);

    try {
      if (viewMode === 'signup') {
        await onRegister(email, password);
      } else {
        await onLogin(email, password);
      }
    } catch (err) {
      if (err instanceof Error) {
        setErrors([err.message]);
      } else {
        setErrors(['An unexpected error occurred']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    if (!email || !email.includes('@')) {
      setErrors(['Please enter a valid email address']);
      return;
    }

    setIsLoading(true);

    try {
      await api.requestPasswordReset(email);
      setResetEmailSent(true);
    } catch (err) {
      // Always show success to prevent email enumeration
      // Only show error for rate limiting
      if (err instanceof Error && err.message.includes('Too many')) {
        setErrors([err.message]);
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
  };

  // Forgot Password View
  if (viewMode === 'forgotPassword') {
    return (
      <div className="app-container flex flex-col justify-center flex-1 px-6 py-8">
        <div className="text-center mb-8 animate-fade-in-up">
          <h1 className="app-title text-2xl font-bold">FlashNote</h1>
          <p className="text-sm opacity-70 mt-2">
            Reset your password
          </p>
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
              The link will expire in 15 minutes.
            </p>
            <button
              type="button"
              onClick={handleBackToLogin}
              className="link text-sm w-full text-center"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleForgotPassword} className="space-y-4 animate-fade-in-up stagger-2">
              <div>
                <label htmlFor="reset-email" className="label block text-sm mb-1">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-field w-full px-3 py-2"
                  placeholder="you@clinic.com"
                />
              </div>

              {errors.length > 0 && (
                <div className="error-message text-sm px-3 py-2 animate-fade-in">
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
                Back to sign in
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
        <h1 className="app-title text-2xl font-bold">FlashNote</h1>
        <p className="text-sm opacity-70 mt-2">
          AI-powered SOAP notes for PTs
        </p>
      </div>

      {/* Session alert for forced logout scenarios */}
      <SessionAlert />

      <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in-up stagger-2">
        <div>
          <label htmlFor="email" className="label block text-sm mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-field w-full px-3 py-2"
            placeholder="you@clinic.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="label text-sm">
              Password
            </label>
            {viewMode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setViewMode('forgotPassword');
                  setErrors([]);
                }}
                className="link text-xs"
              >
                Forgot password?
              </button>
            )}
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="input-field w-full px-3 py-2"
            placeholder={viewMode === 'signup' ? 'Min 8 chars, 1 uppercase, 1 number' : '********'}
          />
        </div>

        {errors.length > 0 && (
          <div className="error-message text-sm px-3 py-2 animate-fade-in">
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
            'Create Account'
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <div className="mt-6 text-center animate-fade-in stagger-4">
        <button
          type="button"
          onClick={() => {
            setViewMode(viewMode === 'signup' ? 'login' : 'signup');
            setErrors([]);
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
