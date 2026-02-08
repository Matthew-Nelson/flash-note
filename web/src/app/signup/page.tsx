'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth, ApiError } from '@/lib/auth-context';
import { registerSchema } from '@/lib/schemas';
import { Button, Input, Alert } from '@/components/ui';

export default function SignupPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    acceptedLegalTerms?: string;
  }>({});
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
    const result = registerSchema.safeParse({ email, password, confirmPassword, acceptedLegalTerms });
    if (!result.success) {
      const errors: { email?: string; password?: string; confirmPassword?: string; acceptedLegalTerms?: string } = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as 'email' | 'password' | 'confirmPassword' | 'acceptedLegalTerms';
        errors[field] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await register(email, password, acceptedLegalTerms);

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
          case 'email_exists':
            setFieldErrors({ email: 'An account with this email already exists' });
            break;
          case 'weak_password':
            setFieldErrors({ password: 'Password does not meet requirements' });
            break;
          default:
            setError(err.message || 'Failed to create account');
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
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-fn-text-secondary">
          Start your 14-day free trial
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card py-8 px-4 sm:px-10">
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

            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              hint="Min 8 characters, 1 uppercase, 1 lowercase, 1 number"
            />

            <Input
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={fieldErrors.confirmPassword}
            />

            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedLegalTerms}
                  onChange={(e) => setAcceptedLegalTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-fn-border text-fn-accent focus:ring-fn-accent"
                />
                <span className="text-sm text-fn-text-secondary">
                  I agree to the{' '}
                  <Link href="/baa" target="_blank" className="link">
                    Business Associate Agreement
                  </Link>
                  ,{' '}
                  <Link href="/terms" target="_blank" className="link">
                    Terms of Service
                  </Link>
                  , and{' '}
                  <Link href="/privacy" target="_blank" className="link">
                    Privacy Policy
                  </Link>
                </span>
              </label>
              {fieldErrors.acceptedLegalTerms && (
                <p className="mt-1 text-sm text-fn-error">{fieldErrors.acceptedLegalTerms}</p>
              )}
            </div>

            {error && (
              <Alert variant="error">{error}</Alert>
            )}

            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full"
            >
              Create account
            </Button>
          </form>

          <div className="mt-6">
            <p className="text-center text-sm text-fn-text-secondary">
              Already have an account?{' '}
              <Link href="/login" className="link">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
