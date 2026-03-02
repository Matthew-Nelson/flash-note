'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui';

export function CheckoutSuccessAlert() {
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing state from URL params + side effect (replaceState)
      setShow(true);
      // Strip ?success=true from URL without triggering a navigation or server round-trip.
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams]);

  if (!show) return null;

  return (
    <Alert variant="success" onDismiss={() => setShow(false)}>
      Subscription activated! Thank you for subscribing to FlashNote.
    </Alert>
  );
}
