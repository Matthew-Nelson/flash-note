'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { Button, Input, Alert, LoadingSpinner } from '@/components/ui';
import { resetPasswordSchema } from '@/lib/schemas';
import { AuthLayout } from '@/components/auth';

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
  const [errors, setErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

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
    setErrors([]);
    setInvalidFields(new Set());

    const result = resetPasswordSchema.safeParse({ password, confirmPassword });

    if (!result.success) {
      const messages: string[] = [];
      const invalid = new Set<string>();
      result.error.errors.forEach((err) => {
        messages.push(err.message);
        if (err.path[0]) invalid.add(String(err.path[0]));
      });
      setErrors(messages);
      setInvalidFields(invalid);
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
        setErrors([apiResult.error?.message ?? 'Failed to reset password']);
      }
    } catch {
      setStatus('ready');
      setErrors(['An error occurred. Please try again.']);
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
      <AuthLayout>
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
      </AuthLayout>
    );
  }

  if (status === 'success') {
    return (
      <AuthLayout>
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
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create a new password"
      subtitle="Enter your new password below."
    >
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        <Input
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={invalidFields.has('password')}
          hint="Min 8 characters, 1 uppercase, 1 lowercase, 1 number"
        />

        <Input
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          invalid={invalidFields.has('confirmPassword')}
        />

        {errors.length > 0 && (
          <Alert variant="error">
            {errors.length === 1 ? (
              errors[0]
            ) : (
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        <Button
          type="submit"
          loading={status === 'submitting'}
          className="w-full"
        >
          Reset password
        </Button>
      </form>
    </AuthLayout>
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
