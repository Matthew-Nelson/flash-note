'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth, ApiError } from '@/lib/auth-context';
import { loginSchema } from '@/lib/schemas';
import { Button, Input, Alert } from '@/components/ui';
import { SessionAlert } from '@/components/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, sessionEndReason, clearSessionEndReason } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Validate input
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as 'email' | 'password';
        errors[field] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await login(email, password);

      // Check if email verification is required
      if (response.emailVerificationRequired) {
        router.push('/verify-email');
        return;
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        // Handle specific error codes
        switch (err.code) {
          case 'invalid_credentials':
            setError('Invalid email or password');
            break;
          case 'account_locked':
            setError('Account temporarily locked. Please try again later.');
            break;
          case 'email_not_verified':
            setError('Please verify your email before signing in.');
            break;
          default:
            setError(err.message || 'Failed to sign in');
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fn-bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-2">
          <span className="text-3xl font-bold text-gradient">FlashNote</span>
          <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-stone-400 text-stone-400">BETA</span>
        </Link>
        <h2 className="mt-6 text-center text-2xl font-bold text-fn-text-primary">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-fn-text-secondary">
          Or{' '}
          <Link href="/signup" className="link">
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card py-8 px-4 sm:px-10">
          {sessionEndReason && (
            <SessionAlert reason={sessionEndReason} onDismiss={clearSessionEndReason} />
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
            />

            <div>
              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
              />
              <div className="mt-1 text-right">
                <Link href="/forgot-password" className="text-sm link">
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && (
              <Alert variant="error">{error}</Alert>
            )}

            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full"
            >
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
