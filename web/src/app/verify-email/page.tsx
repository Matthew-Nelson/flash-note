'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

interface VerifyEmailResponse {
  success: boolean;
  data?: { alreadyVerified?: boolean };
  error?: { message: string };
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  // Derive initial status from token presence - avoids setState in effect
  const [status, setStatus] = useState<'verifying' | 'success' | 'already_verified' | 'error'>(
    () => (token ? 'verifying' : 'error')
  );
  const [message, setMessage] = useState(() => (token ? '' : 'No verification token provided'));
  // Prevent double-verification in React 18 Strict Mode
  const verificationStarted = useRef(false);

  const verifyEmail = useCallback(async (verificationToken: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      });

      const result = (await response.json()) as VerifyEmailResponse;

      if (response.ok && result.success) {
        if (result.data?.alreadyVerified) {
          setStatus('already_verified');
          setMessage('Your email was already verified.');
        } else {
          setStatus('success');
          setMessage('Your email has been verified successfully!');
        }
      } else {
        setStatus('error');
        setMessage(result.error?.message ?? 'Invalid or expired verification link');
      }
    } catch {
      setStatus('error');
      setMessage('An error occurred while verifying your email');
    }
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    // Prevent duplicate calls from React 18 Strict Mode double-render
    if (verificationStarted.current) {
      return;
    }
    verificationStarted.current = true;

    // Data fetching on mount is a valid pattern - setState in async callback is intentional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void verifyEmail(token);
  }, [token, verifyEmail]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center">
          <span className="text-3xl font-bold text-primary-600">FlashNote</span>
        </Link>
        <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
          Email Verification
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {status === 'verifying' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Verifying your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Email Verified!</h3>
              <p className="mt-2 text-gray-600">{message}</p>
              <p className="mt-4 text-sm text-gray-600">
                You can now use all features in the FlashNote Chrome extension.
              </p>
            </div>
          )}

          {status === 'already_verified' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Already Verified</h3>
              <p className="mt-2 text-gray-600">{message}</p>
              <p className="mt-4 text-sm text-gray-600">
                You can use all features in the FlashNote Chrome extension.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Verification Failed</h3>
              <p className="mt-2 text-gray-600">{message}</p>
              <div className="mt-6">
                <Link
                  href="/resend-verification"
                  className="text-primary-600 hover:text-primary-500 font-medium"
                >
                  Request a new verification link
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
