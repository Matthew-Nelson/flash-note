'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Input, Alert } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface PasswordResetResponse {
  success: boolean;
  error?: { code: string; message: string };
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setStatus('success');
      } else {
        const result = (await response.json()) as PasswordResetResponse;
        if (result.error?.code === 'too_many_attempts') {
          setStatus('error');
          setError(result.error.message);
        } else {
          setStatus('success');
        }
      }
    } catch {
      setStatus('error');
      setError('An error occurred. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-fn-bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-2">
          <span className="text-3xl font-bold text-gradient">FlashNote</span>
          <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-stone-400 text-stone-400">BETA</span>
        </Link>
        <h2 className="mt-6 text-center text-2xl font-bold text-fn-text-primary">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-fn-text-secondary">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card py-8 px-4 sm:px-10">
          {status === 'success' ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-fn-success-light">
                <svg className="h-6 w-6 text-fn-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-fn-text-primary">Check your email</h3>
              <p className="mt-2 text-fn-text-secondary">
                If an account exists with that email, we&apos;ve sent a password reset link.
              </p>
              <p className="mt-2 text-sm text-fn-text-muted">
                The link will expire in 15 minutes for security.
              </p>
              <div className="mt-6">
                <Link href="/login">
                  <Button variant="secondary" className="w-full">Return to login</Button>
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <Input
                label="Email address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />

              {status === 'error' && error && (
                <Alert variant="error">{error}</Alert>
              )}

              <Button
                type="submit"
                loading={status === 'submitting'}
                className="w-full"
              >
                Send reset link
              </Button>

              <div className="text-center">
                <Link href="/login" className="text-sm text-fn-text-secondary hover:text-fn-text-primary">
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
