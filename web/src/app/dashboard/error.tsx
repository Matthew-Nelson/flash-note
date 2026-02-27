'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error digest for observability — never log error.message (Rule 7)
    // TODO: Replace with Pino logger when available
    // eslint-disable-next-line no-console
    console.error('Dashboard error:', error.digest ?? 'no-digest');
  }, [error]);

  return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-bold text-fn-text-primary mb-4">
          Something went wrong
        </h1>
        <p className="text-fn-text-secondary mb-6">
          We encountered an unexpected error. Please try again or contact support
          if the problem persists.
        </p>
        <div className="flex flex-col items-center gap-3">
          <Button onClick={reset}>
            Try Again
          </Button>
          <Link href="/dashboard" className="link text-sm">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
