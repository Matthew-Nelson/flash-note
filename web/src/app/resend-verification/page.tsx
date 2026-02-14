'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Input, Alert } from '@/components/ui';
import { emailSchema } from '@/lib/schemas';
import { AuthLayout } from '@/components/auth';
import { api, ApiError } from '@/lib/api';

export default function ResendVerificationPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setInvalidFields(new Set());

    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setErrors(result.error.errors.map((e) => e.message));
      setInvalidFields(new Set(['email']));
      return;
    }

    setStatus('submitting');

    try {
      await api.resendVerificationEmail(email);
      setStatus('success');
    } catch (err) {
      // Show success on most errors to prevent email enumeration
      // Only show error for rate limiting
      if (err instanceof ApiError && err.code === 'too_many_attempts') {
        setStatus('error');
        setErrors(['Too many requests. Please try again later.']);
      } else {
        setStatus('success');
      }
    }
  };

  return (
    <AuthLayout
      title="Resend verification email"
      subtitle="Enter your email address and we'll send you a new verification link."
      footer={
        status !== 'success' ? (
          <p className="text-center text-sm">
            <Link href="/login" className="link">
              Back to login
            </Link>
          </p>
        ) : undefined
      }
    >
      {status === 'success' ? (
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-fn-success-light">
            <svg className="h-6 w-6 text-fn-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-fn-text-primary">Check your email</h3>
          <p className="mt-2 text-fn-text-secondary">
            If an unverified account exists with that email, we&apos;ve sent a new verification link.
          </p>
          <p className="mt-2 text-sm text-fn-text-muted">
            The link will expire in 24 hours.
          </p>
          <div className="mt-6">
            <Link href="/login">
              <Button variant="secondary" className="w-full">Back to login</Button>
            </Link>
          </div>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          <Input
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={invalidFields.has('email')}
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
            Send verification email
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
