import Link from 'next/link';

import type { Patient } from '@/lib/types';

interface PatientContextPreviewProps {
  patient: Patient | null;
  className?: string;
}

/**
 * Right-rail card on /dashboard/notes/new (xl+ breakpoint) showing the
 * selected patient's persistent context with a link back to the detail page
 * for editing. When no patient is selected, renders an empty-state hint.
 *
 * Server-rendered card — context comes from a server-loaded Patient row
 * (Rule 5) and is displayed read-only. Editing happens on the patient detail
 * page via PatientContextField.
 */
export function PatientContextPreview({
  patient,
  className = '',
}: PatientContextPreviewProps) {
  const cardClass = `card p-4 ${className}`.trim();

  if (!patient) {
    return (
      <aside className={cardClass} aria-label="Patient context">
        <h2 className="text-fn-sm font-semibold text-fn-text-primary mb-3">
          Patient context
        </h2>
        <p className="text-fn-sm text-fn-text-secondary">
          Select a patient to see their persistent context here.
        </p>
      </aside>
    );
  }

  return (
    <aside className={cardClass} aria-label="Patient context">
      <h2 className="text-fn-sm font-semibold text-fn-text-primary mb-3">
        Patient context
      </h2>
      <p className="text-fn-sm text-fn-text-primary mb-1">
        {patient.firstName} {patient.lastName}
      </p>
      {patient.context ? (
        <p className="text-fn-sm text-fn-text-secondary whitespace-pre-wrap mb-3">
          {patient.context}
        </p>
      ) : (
        <p className="text-fn-sm text-fn-text-secondary italic mb-3">
          No context recorded yet.
        </p>
      )}
      <Link
        href={`/dashboard/patients/${patient.id}`}
        className="text-fn-sm text-fn-primary-DEFAULT hover:underline"
      >
        Edit in patient detail
      </Link>
    </aside>
  );
}
