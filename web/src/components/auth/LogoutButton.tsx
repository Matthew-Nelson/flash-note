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
        // Notify client components to clear PHI state before logout — Rule 4.
        // Dispatched outside the transition on purpose: state updates made inside
        // an async transition don't commit until the whole action resolves, so
        // the PHI would stay on screen for the length of the logout request.
        window.dispatchEvent(new CustomEvent('flashnote:logout'));
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
