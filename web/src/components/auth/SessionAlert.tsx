'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '../ui';
import type { SessionEndReason } from '@/lib/types';

const reasonMessages: Record<SessionEndReason, string> = {
  logged_out: 'You have been signed out.',
  session_invalidated: 'Your session was invalidated. This may happen after a password reset. Please sign in again.',
  session_expired: 'Your session has expired. Please sign in again.',
  session_limit: 'You were signed out because you signed in on another device.',
  session_revoked: 'Your session was revoked for security reasons. Please sign in again.',
};

const validReasons = new Set<string>(Object.keys(reasonMessages));

function isSessionEndReason(value: string): value is SessionEndReason {
  return validReasons.has(value);
}

export function SessionAlert() {
  const searchParams = useSearchParams();
  const reasonParam = searchParams.get('reason');
  const [reason, setReason] = useState<SessionEndReason | null>(null);

  // Parse and validate the reason param on mount
  useEffect(() => {
    if (reasonParam && isSessionEndReason(reasonParam)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL param read on mount (external system sync)
      setReason(reasonParam);
      // Clear the query param from URL without navigation
      const url = new URL(window.location.href);
      url.searchParams.delete('reason');
      window.history.replaceState({}, '', url.toString());
    }
  }, [reasonParam]);

  if (!reason) return null;

  return (
    <div className="mb-4 relative">
      <Alert variant="warning">
        <div className="flex items-center justify-between">
          <span>{reasonMessages[reason]}</span>
          <button
            onClick={() => setReason(null)}
            className="ml-4 text-current opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </Alert>
    </div>
  );
}
