import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { findPatientById } from '@/server/dal';
import { auditService } from '@/server/services/audit';
import { getRequestContext } from '@/server/lib/request-context';
import { AuditAction } from '@/server/types';
import { TopBar } from '@/components/TopBar';
import {
  ClientPatientDetail,
  PatientContextField,
  PatientInfoCard,
  PatientNotesTable,
} from '@/components/patients';
import { patientIdSchema } from '@/lib/schemas/patients';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PatientDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect('/login?reason=session_expired');

  const { id } = await params;
  const idParsed = patientIdSchema.safeParse(id);
  if (!idParsed.success) notFound();

  const patient = await findPatientById(
    { type: 'user', userId: session.userId },
    idParsed.data,
  );
  if (!patient) notFound();

  // PATIENT_VIEWED audit (fire-and-forget read path). The audit service catch
  // branch logs at error level per M-6 — see web/src/server/services/audit.ts.
  const ctx = await getRequestContext();
  await auditService.log({
    userId: session.userId,
    action: AuditAction.PATIENT_VIEWED,
    status: 'SUCCESS',
    metadata: { patientId: patient.id },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  // Plan 04-03 will wire findClinicalNotesByScope here; 04-02 passes [] so the
  // placeholder empty state renders.
  const notes: readonly never[] = [];

  return (
    <>
      <TopBar title="Patient" backHref="/dashboard/patients" />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 p-4 sm:p-6 max-w-fn-content"
      >
        <ClientPatientDetail patient={patient}>
          <h1 className="text-fn-2xl font-semibold tracking-fn-tight text-fn-text-primary">
            {patient.firstName} {patient.lastName}
          </h1>

          <section aria-labelledby="patient-info-heading" className="mt-6">
            <h2
              id="patient-info-heading"
              className="text-fn-lg font-semibold mb-3 text-fn-text-primary"
            >
              Patient info
            </h2>
            <PatientInfoCard patient={patient} />
          </section>

          <section aria-labelledby="patient-context-heading" className="mt-8">
            <h2
              id="patient-context-heading"
              className="text-fn-lg font-semibold mb-3 text-fn-text-primary"
            >
              Patient context
            </h2>
            <PatientContextField patient={patient} />
          </section>

          <section aria-labelledby="patient-notes-heading" className="mt-8">
            <h2
              id="patient-notes-heading"
              className="text-fn-lg font-semibold mb-3 text-fn-text-primary"
            >
              Notes
            </h2>
            <PatientNotesTable patient={patient} notes={notes} />
          </section>
        </ClientPatientDetail>
      </main>
    </>
  );
}
