'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Button, LoadingSpinner } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import * as Sentry from '@sentry/nextjs';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { isAuthenticated, fetchUser } = useAuth();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'already_verified' | 'error'>(
    () => (token ? 'verifying' : 'error')
  );
  const [message, setMessage] = useState(() => (token ? '' : 'No verification token provided'));
  const verificationStarted = useRef(false);

  const verifyEmail = useCallback(async (verificationToken: string) => {
    try {
      const result = await api.verifyEmail(verificationToken);

      // If user is logged in, fetch fresh data to get updated emailVerified status
      if (isAuthenticated) {
        try {
          await fetchUser();
        } catch {
          // Fetch failed, but verification still succeeded - user can continue
        }
      }

      if (result.alreadyVerified) {
        setStatus('already_verified');
        setMessage('Your email was already verified.');
      } else {
        setStatus('success');
        setMessage('Your email has been verified successfully!');
      }
    } catch (err) {
      Sentry.captureException(err, {
        extra: { source: 'verify_email_page', errorType: 'verification_failed' },
      });
      setStatus('error');
      setMessage('Invalid or expired verification link. Please request a new one.');
    }
  }, [isAuthenticated, fetchUser]);

  useEffect(() => {
    if (!token || verificationStarted.current) {
      return;
    }
    verificationStarted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- API call on mount (external system sync)
    void verifyEmail(token);
  }, [token, verifyEmail]);

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-fn-bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-2">
          <span className="text-3xl font-bold text-gradient">FlashNote</span>
          <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-stone-400 text-stone-400">BETA</span>
        </Link>
        <h2 className="mt-6 text-center text-2xl font-bold text-fn-text-primary">
          Email Verification
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md" aria-live="polite">
        <div className="card py-8 px-4 sm:px-10">
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
                <svg className="h-6 w-6 text-fn-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-fn-text-primary">Email Verified!</h3>
              <p className="mt-2 text-fn-text-secondary">{message}</p>
              <p className="mt-4 text-sm text-fn-text-muted">
                You can now use all features in the FlashNote Chrome extension.
              </p>
              <div className="mt-6">
                {isAuthenticated ? (
                  <Link href="/dashboard">
                    <Button className="w-full">Go to Dashboard</Button>
                  </Link>
                ) : (
                  <Link href="/login">
                    <Button className="w-full">Sign in</Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {status === 'already_verified' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-fn-cyan-50">
                <svg className="h-6 w-6 text-fn-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-fn-text-primary">Already Verified</h3>
              <p className="mt-2 text-fn-text-secondary">{message}</p>
              <p className="mt-4 text-sm text-fn-text-muted">
                You can use all features in the FlashNote Chrome extension.
              </p>
              <div className="mt-6">
                {isAuthenticated ? (
                  <Link href="/dashboard">
                    <Button className="w-full">Go to Dashboard</Button>
                  </Link>
                ) : (
                  <Link href="/login">
                    <Button className="w-full">Sign in</Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-fn-error-light">
                <svg className="h-6 w-6 text-fn-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-fn-text-primary">Verification Failed</h3>
              <p className="mt-2 text-fn-text-secondary">{message}</p>
              <div className="mt-6">
                <Link href="/resend-verification">
                  <Button variant="secondary" className="w-full">Request a new verification link</Button>
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
