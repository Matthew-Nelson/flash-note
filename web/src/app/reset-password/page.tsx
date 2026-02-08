'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { Button, Input, Alert, LoadingSpinner } from '@/components/ui';
import { registerSchema } from '@/lib/schemas';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ValidateTokenResponse {
  success: boolean;
  data?: { valid: boolean };
  error?: { message: string };
}

interface ResetPasswordResponse {
  success: boolean;
  error?: { message: string };
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'validating' | 'ready' | 'submitting' | 'success' | 'invalid'>(
    () => (token ? 'validating' : 'invalid')
  );
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});

  const validateToken = useCallback(async (resetToken: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/validate-reset-token?token=${encodeURIComponent(resetToken)}`);
      const result = (await response.json()) as ValidateTokenResponse;

      if (response.ok && result.success && result.data?.valid) {
        setStatus('ready');
      } else {
        setStatus('invalid');
      }
    } catch {
      setStatus('invalid');
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- API call on mount (external system sync)
    void validateToken(token);
  }, [token, validateToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Use the same password schema as registration (without email)
    const passwordSchema = registerSchema.innerType().pick({ password: true });
    const result = passwordSchema.safeParse({ password });

    if (!result.success) {
      const errors: { password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'password') {
          errors.password = err.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setStatus('submitting');

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const apiResult = (await response.json()) as ResetPasswordResponse;

      if (response.ok && apiResult.success) {
        setStatus('success');
      } else {
        setStatus('ready');
        setError(apiResult.error?.message ?? 'Failed to reset password');
      }
    } catch {
      setStatus('ready');
      setError('An error occurred. Please try again.');
    }
  };

  if (status === 'validating') {
    return (
      <div className="min-h-screen bg-fn-bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="flex justify-center">
              <LoadingSpinner />
            </div>
            <p className="mt-4 text-fn-text-secondary">Validating reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-fn-bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Link href="/" className="flex justify-center items-center gap-2">
            <span className="text-3xl font-bold text-gradient">FlashNote</span>
            <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-stone-400 text-stone-400">BETA</span>
          </Link>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="card py-8 px-4 sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-fn-error-light">
                <svg className="h-6 w-6 text-fn-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-fn-text-primary">Invalid or Expired Link</h3>
              <p className="mt-2 text-fn-text-secondary">
                This password reset link is invalid or has expired.
              </p>
              <p className="mt-2 text-sm text-fn-text-muted">
                Password reset links expire after 15 minutes for security.
              </p>
              <div className="mt-6">
                <Link href="/forgot-password">
                  <Button variant="secondary" className="w-full">Request a new reset link</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-fn-bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Link href="/" className="flex justify-center items-center gap-2">
            <span className="text-3xl font-bold text-gradient">FlashNote</span>
            <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-stone-400 text-stone-400">BETA</span>
          </Link>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="card py-8 px-4 sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-fn-success-light">
                <svg className="h-6 w-6 text-fn-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-fn-text-primary">Password Reset Successfully</h3>
              <p className="mt-2 text-fn-text-secondary">
                Your password has been updated. You can now log in with your new password.
              </p>
              <p className="mt-2 text-sm text-fn-text-muted">
                For security, all your existing sessions have been logged out.
              </p>
              <div className="mt-6">
                <Link href="/login">
                  <Button className="w-full">Sign in</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fn-bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center">
          <span className="text-3xl font-bold text-gradient">FlashNote</span>
        </Link>
        <h2 className="mt-6 text-center text-2xl font-bold text-fn-text-primary">
          Create a new password
        </h2>
        <p className="mt-2 text-center text-sm text-fn-text-secondary">
          Enter your new password below.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card py-8 px-4 sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input
              label="New password"
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
              label="Confirm new password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={fieldErrors.confirmPassword}
            />

            {error && (
              <Alert variant="error">{error}</Alert>
            )}

            <Button
              type="submit"
              loading={status === 'submitting'}
              className="w-full"
            >
              Reset password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-fn-bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="flex justify-center">
              <div className="loading-spinner" />
            </div>
            <p className="mt-4 text-fn-text-secondary">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
