'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Input, Alert } from '@/components/ui';
import { emailSchema } from '@/lib/schemas';
import { AuthLayout } from '@/components/auth';
import { requestPasswordResetAction } from '@/actions/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setInvalidFields(new Set());

    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      setErrors(validation.error.errors.map((e) => e.message));
      setInvalidFields(new Set(['email']));
      return;
    }

    setStatus('submitting');

    try {
      const formData = new FormData();
      formData.set('email', email);
      const result = await requestPasswordResetAction(formData);

      if (!result.success) {
        switch (result.error) {
          case 'rate_limit_exceeded':
            setStatus('error');
            setErrors(['Too many attempts. Please try again later.']);
            break;
          default:
            // Anti-enumeration: show success even on server errors to avoid
            // revealing whether the action actually failed vs email not found
            setStatus('success');
        }
        return;
      }

      setStatus('success');
    } catch {
      setStatus('error');
      setErrors(['Something went wrong. Please try again later.']);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email address and we'll send you a link to reset your password."
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
            <svg className="h-6 w-6 text-fn-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-medium text-fn-text-primary">Check your email</h2>
          <p className="mt-2 text-fn-text-secondary">
            If an account exists with that email, we&apos;ve sent a password reset link.
          </p>
          <p className="mt-2 text-sm text-fn-text-muted">
            The link will expire in 15 minutes for security.
          </p>
          <div className="mt-6">
            <Link href="/login" className="btn-secondary block w-full text-center px-4 py-2">
              Return to login
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
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
