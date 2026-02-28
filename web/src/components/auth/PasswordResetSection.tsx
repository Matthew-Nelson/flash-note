'use client';

import { useState, useTransition } from 'react';
import { requestPasswordResetAction } from '@/actions/auth';
import { Button, Alert } from '@/components/ui';

export function PasswordResetSection({ email }: { email: string }) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append('email', email);
      const result = await requestPasswordResetAction(formData);
      if (result.success) {
        setSent(true);
      } else {
        // Map error codes to curated user-facing messages (Rule 2)
        switch (result.error) {
          case 'rate_limit_exceeded':
            setError('Too many requests. Please try again later.');
            break;
          default:
            setError('Failed to send password reset email. Please try again.');
        }
      }
    });
  }

  if (sent) {
    return (
      <Alert variant="success">
        Password reset email sent! Check your inbox for the reset link.
      </Alert>
    );
  }

  return (
    <>
      {error && (
        <Alert variant="error" className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Button
        variant="secondary"
        onClick={handleClick}
        loading={isPending}
        disabled={isPending}
      >
        Send Password Reset Email
      </Button>
    </>
  );
}
