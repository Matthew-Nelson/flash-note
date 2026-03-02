'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { createPortalAction } from '@/actions/billing';
import { isAllowedRedirectUrl } from '@/lib/utils/redirect-validation';

interface ManageSubscriptionButtonProps {
  label?: string;
}

export function ManageSubscriptionButton({
  label = 'Manage subscription',
}: ManageSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    const result = await createPortalAction();
    if (!result.success) {
      // Rule 2: Map error codes to user messages
      setError('Failed to open billing portal. Please try again or contact support.');
      setLoading(false);
      return;
    }
    if (!isAllowedRedirectUrl(result.data.portalUrl)) {
      setError('Invalid billing portal URL. Please contact support.');
      setLoading(false);
      return;
    }
    window.location.href = result.data.portalUrl;
    // Note: loading state is not reset after redirect — page navigates away.
  };

  return (
    <>
      <Button variant="secondary" onClick={handleClick} loading={loading} disabled={loading}>
        {label}
      </Button>
      {error && <p className="text-fn-error text-sm mt-2">{error}</p>}
    </>
  );
}
