'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { reportErrorBoundary } from '@/lib/telemetry';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportErrorBoundary(error, error.digest);
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
