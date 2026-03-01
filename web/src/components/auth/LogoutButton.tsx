'use client';

import { useTransition } from 'react';
import { logoutAction } from '@/actions/auth';
import { Button } from '@/components/ui';

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          // Clear clipboard to remove any PHI (copied SOAP notes) — Rule 4
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText('').catch(() => {});
          }
          await logoutAction();
        });
      }}
    >
      {isPending ? 'Signing out...' : 'Sign out'}
    </Button>
  );
}
