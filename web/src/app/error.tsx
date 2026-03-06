'use client';

import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    // Log error digest for observability — never log error.message (Rule 7)
    // eslint-disable-next-line no-console
    console.error('Root error boundary:', error.digest ?? 'no-digest');
  }, [error]);

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-fn-bg-secondary flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-fn-text-primary mb-4">
          Something went wrong
        </h1>
        <p className="text-fn-text-secondary mb-6">
          We encountered an unexpected error. Please try again or contact support
          if the problem persists.
        </p>
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={reset}
            className="btn-primary px-6 py-2"
          >
            Try Again
          </button>
          <Link href="/" className="link text-sm">
            Return to home
          </Link>
        </div>
      </div>
    </main>
  );
}
