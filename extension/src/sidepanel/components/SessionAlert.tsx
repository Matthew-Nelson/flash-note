import { useState, useEffect } from 'react';
import { AUTH_INVALIDATED_EVENT, type SessionEndReason } from '@/shared/api';

interface SessionAlertProps {
  onDismiss?: () => void;
}

const ALERT_MESSAGES: Record<SessionEndReason, { title: string; message: string }> = {
  session_invalidated: {
    title: 'Session Ended',
    message: 'Your password was changed. Please log in again with your new password.',
  },
  session_expired: {
    title: 'Session Expired',
    message: 'Your session has expired. Please log in again.',
  },
  session_limit: {
    title: 'Signed Out',
    message: 'You were signed out because you signed in on another device.',
  },
  session_revoked: {
    title: 'Session Ended',
    message: 'Your session was ended for security reasons. Please log in again.',
  },
};

export default function SessionAlert({ onDismiss }: SessionAlertProps) {
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    const handleAuthInvalidated = (event: Event) => {
      const customEvent = event as CustomEvent<{ reason: SessionEndReason }>;
      const reason = customEvent.detail?.reason || 'session_expired';
      setAlert(ALERT_MESSAGES[reason] || ALERT_MESSAGES.session_expired);
    };

    window.addEventListener(AUTH_INVALIDATED_EVENT, handleAuthInvalidated);
    return () => {
      window.removeEventListener(AUTH_INVALIDATED_EVENT, handleAuthInvalidated);
    };
  }, []);

  if (!alert) return null;

  const handleDismiss = () => {
    setAlert(null);
    onDismiss?.();
  };

  return (
    <div role="alert" className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {alert.title}
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            {alert.message}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 p-1"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
