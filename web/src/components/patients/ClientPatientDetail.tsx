'use client';

import {
  useCallback,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { Button, ConfirmDialog } from '@/components/ui';
import { usePhiCleanup } from '@/hooks/use-phi-cleanup';
import { archivePatientAction } from '@/actions/patients';
import type { Patient } from '@/lib/types';
import { mapPatientError } from './error-messages';

interface ClientPatientDetailProps {
  patient: Patient;
  children: ReactNode;
}

/**
 * Client-side shell for /dashboard/patients/[id].
 *
 * Responsibilities:
 *  - Wire `usePhiCleanup` — Rule 4 clears PHI state on route change + logout.
 *    The cleanup ref is updated per-render so child Client Components can
 *    register additional cleanup by calling `registerCleanup` from context in
 *    the future (kept minimal for Plan 04-02 — base cleanup lives here).
 *  - Host the archive ConfirmDialog (bottom-of-page archive button). Reuses
 *    the shared `ConfirmDialog` + new `destructive` Button variant.
 */
export function ClientPatientDetail({
  patient,
  children,
}: ClientPatientDetailProps): React.ReactElement {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Rule 4: PHI cleanup on route change or flashnote:logout.
  // Also aborts any in-flight requests (none at this level — nested components
  // own their own abort controllers).
  const cleanupRef = useRef<() => void>(() => {
    setErrorCode(null);
    setDialogOpen(false);
  });
  usePhiCleanup(cleanupRef);

  const handleConfirm = useCallback(() => {
    setErrorCode(null);
    startTransition(async () => {
      const res = await archivePatientAction(patient.id);
      if (res.success) {
        setDialogOpen(false);
        router.push('/dashboard/patients');
        router.refresh();
        return;
      }
      setErrorCode(res.error);
    });
  }, [patient.id, router]);

  const handleCancel = useCallback(() => {
    if (isPending) return;
    setDialogOpen(false);
    setErrorCode(null);
  }, [isPending]);

  return (
    <>
      {children}

      <section className="mt-10">
        <div className="border-t border-fn-border pt-6 flex items-center justify-between">
          <div>
            <h2 className="text-fn-base font-semibold text-fn-text-primary">
              Archive this patient
            </h2>
            <p className="text-fn-base text-fn-text-secondary">
              Hides the patient from your active list. Existing notes remain accessible.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDialogOpen(true)}
          >
            Archive patient
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={dialogOpen}
        title={`Archive ${patient.firstName} ${patient.lastName}?`}
        body={
          <p>
            This patient will be hidden from your active patient list. Their existing notes remain accessible. You can restore this patient later by contacting support.
          </p>
        }
        confirmLabel="Archive patient"
        cancelLabel="Keep patient"
        confirmVariant="destructive"
        loading={isPending}
        errorMessage={errorCode ? mapPatientError(errorCode) : null}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
