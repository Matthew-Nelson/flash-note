'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

export function DeleteAccountSection() {
  const [showConfirm, setShowConfirm] = useState(false);

  if (!showConfirm) {
    return (
      <>
        <p className="text-fn-text-secondary mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <Button
          variant="secondary"
          onClick={() => setShowConfirm(true)}
          className="border-fn-error text-fn-error hover:bg-fn-error-light"
        >
          Delete Account
        </Button>
      </>
    );
  }

  return (
    <div className="bg-fn-error-light border border-fn-error rounded-fn-md p-4">
      <p className="text-fn-error-dark font-semibold mb-2">
        Are you sure you want to delete your account?
      </p>
      <p className="text-fn-text-secondary text-sm mb-4">
        This action cannot be undone. All your data will be permanently deleted.
        To delete your account, please contact us at{' '}
        <a href="mailto:support@flashnote.co" className="link">
          support@flashnote.co
        </a>.
      </p>
      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowConfirm(false)}
        >
          Cancel
        </Button>
        <a
          href="mailto:support@flashnote.co?subject=Account%20Deletion%20Request"
          className="btn-primary px-3 py-1.5 text-sm inline-flex items-center"
        >
          Contact Support
        </a>
      </div>
    </div>
  );
}
