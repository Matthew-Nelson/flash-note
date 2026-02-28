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
          await logoutAction();
        });
      }}
    >
      {isPending ? 'Signing out...' : 'Sign out'}
    </Button>
  );
}
