'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui';
import { BetaBadge } from '@/components/BetaBadge';
import { verifyEmailAction } from '@/actions/auth';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'already_verified' | 'error'>(
    () => (token ? 'verifying' : 'error')
  );
  const [message, setMessage] = useState(() => (token ? '' : 'No verification token provided'));
  const router = useRouter();
  const verificationStarted = useRef(false);

  const verifyEmail = useCallback(async (verificationToken: string) => {
    try {
      const formData = new FormData();
      formData.set('token', verificationToken);
      const result = await verifyEmailAction(formData);

      if (!result.success) {
        setStatus('error');
        setMessage('Invalid or expired verification link. Please request a new one.');
        return;
      }

      if (result.data?.alreadyVerified) {
        setStatus('already_verified');
        setMessage('Your email was already verified.');
      } else {
        setStatus('success');
        setMessage('Your email has been verified successfully!');
      }
    } catch {
      setStatus('error');
      setMessage('Invalid or expired verification link. Please request a new one.');
    }
  }, []);

  useEffect(() => {
    if (!token || verificationStarted.current) {
      return;
    }
    verificationStarted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Server Action call on mount (external system sync)
    void verifyEmail(token);
  }, [token, verifyEmail]);

  // Auto-redirect to dashboard after successful verification.
  // Middleware handles the no-session case (redirects to /login).
  useEffect(() => {
    if (status !== 'success' && status !== 'already_verified') return;
    const timer = setTimeout(() => router.push('/dashboard'), 1500);
    return () => clearTimeout(timer);
  }, [status, router]);

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-fn-bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-2">
          <span className="text-3xl font-bold text-fn-primary">FlashNote</span>
          <BetaBadge />
        </Link>
        <h1 className="mt-6 text-center text-2xl font-bold text-fn-text-primary">
          Email Verification
        </h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md" aria-live="polite">
        <div className="card shadow-fn-base p-6 sm:p-8">
          {status === 'verifying' && (
            <div className="text-center">
              <div className="flex justify-center">
                <LoadingSpinner />
              </div>
              <p className="mt-4 text-fn-text-secondary">Verifying your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-fn-success-light">
                <svg className="h-6 w-6 text-fn-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-medium text-fn-text-primary">Email Verified!</h2>
              <p className="mt-2 text-fn-text-secondary">{message}</p>
              <p className="mt-4 text-sm text-fn-text-muted">
                You can now use all features in FlashNote.
              </p>
              <p className="mt-4 text-sm text-fn-text-secondary">Redirecting...</p>
            </div>
          )}

          {status === 'already_verified' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-fn-primary-light">
                <svg className="h-6 w-6 text-fn-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-medium text-fn-text-primary">Already Verified</h2>
              <p className="mt-2 text-fn-text-secondary">{message}</p>
              <p className="mt-4 text-sm text-fn-text-muted">
                You can use all features in FlashNote.
              </p>
              <p className="mt-4 text-sm text-fn-text-secondary">Redirecting...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-fn-error-light">
                <svg className="h-6 w-6 text-fn-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-medium text-fn-text-primary">Verification Failed</h2>
              <p className="mt-2 text-fn-text-secondary">{message}</p>
              <div className="mt-6">
                <Link href="/resend-verification" className="btn-secondary block w-full text-center px-4 py-2">
                  Request a new verification link
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
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
      <VerifyEmailContent />
    </Suspense>
  );
}
