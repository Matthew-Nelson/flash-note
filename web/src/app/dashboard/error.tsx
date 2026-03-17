'use client';

import { useEffect, useTransition } from 'react';
import { logoutAction } from '@/actions/auth';
import { reportErrorBoundary } from '@/lib/telemetry';
import { Button } from '@/components/ui';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    reportErrorBoundary(error, error.digest);
  }, [error]);

  function handleSignOut() {
    startTransition(async () => {
      try {
        // Notify client components to clear PHI state before logout — Rule 4
        window.dispatchEvent(new CustomEvent('flashnote:logout'));
        // Clear clipboard to remove any PHI (copied SOAP notes) — Rule 4
        if (navigator.clipboard) {
          await navigator.clipboard.writeText('').catch(() => {});
        }
        await logoutAction();
      } catch {
        // Server unreachable — navigate to homepage (no auth required)
        window.location.href = '/login';
      }
    });
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex items-center justify-center py-32">
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
          <div aria-live="polite" aria-atomic="true">
            <button
              onClick={handleSignOut}
              disabled={isPending}
              className="link text-sm"
            >
              {isPending ? 'Signing out...' : 'Return to sign in'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
