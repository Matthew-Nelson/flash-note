'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui';
import { archivePatientAction } from '@/actions/patients';
import type { Patient } from '@/lib/types';
import { mapPatientError } from './error-messages';

interface PatientRowProps {
  patient: Patient;
}

function formatDob(dob: Patient['dateOfBirth']): string {
  if (!dob) return '—';
  const d = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US');
}

function formatAdded(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Single row inside the patient list table. Hosts the archive flow (opens
 * the shared ConfirmDialog, dispatches archivePatientAction, then refreshes
 * the route so the server re-fetches the list).
 */
export function PatientRow({ patient }: PatientRowProps): React.ReactElement {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string | null>(null);

  function handleConfirm(): void {
    setErrorCode(null);
    startTransition(async () => {
      const res = await archivePatientAction(patient.id);
      if (res.success) {
        setDialogOpen(false);
        router.refresh();
        return;
      }
      setErrorCode(res.error);
    });
  }

  return (
    <tr className="border-b border-fn-border">
      <td className="px-3 py-3 text-fn-base">
        <Link
          href={`/dashboard/patients/${patient.id}`}
          className="text-fn-primary hover:underline"
        >
          {patient.firstName} {patient.lastName}
        </Link>
      </td>
      <td className="px-3 py-3 text-fn-base text-fn-text-secondary tabular-nums">
        {formatDob(patient.dateOfBirth)}
      </td>
      <td className="px-3 py-3 text-fn-base text-fn-text-secondary">
        {patient.pronoun ?? '—'}
      </td>
      <td className="px-3 py-3 text-fn-base text-fn-text-secondary tabular-nums">
        {formatAdded(patient.createdAt)}
      </td>
      <td className="px-3 py-3 text-right">
        <button
          type="button"
          aria-label={`Archive patient ${patient.firstName} ${patient.lastName}`}
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-fn-text-secondary hover:text-fn-error cursor-pointer"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M10 3h4a2 2 0 012 2v2H8V5a2 2 0 012-2z"
            />
          </svg>
        </button>

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
          onCancel={() => {
            if (isPending) return;
            setDialogOpen(false);
            setErrorCode(null);
          }}
        />
      </td>
    </tr>
  );
}
