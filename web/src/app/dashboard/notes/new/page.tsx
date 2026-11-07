import { redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { findBuiltinTemplates, findPatientById } from '@/server/dal';
import { TopBar } from '@/components/TopBar';
import { NoteGenerationForm } from '@/components/notes';
import { PatientContextPreview } from '@/components/notes/PatientContextPreview';
import { patientIdSchema } from '@/lib/schemas/patients';

interface Props {
  searchParams: Promise<{ patientId?: string | string[] }>;
}

/**
 * /dashboard/notes/new — Server Component.
 *
 * Preloads:
 *   - Builtin note templates (for the template selector / future UI)
 *   - Selected patient when `?patientId=...` query param provided (Rule 5)
 *
 * PHI context flows: Server Component loads patient -> NoteGenerationForm
 * receives `selectedPatient` + `initialPatientId` -> generation FormData
 * includes `patientId` -> generateNoteAction re-loads patient via DAL and uses
 * patient.context as the server-authoritative generation-time snapshot.
 */
export default async function NewNotePage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/login?reason=session_expired');

  const sp = await searchParams;
  const templates = await findBuiltinTemplates();
  // An invalid or repeated ?patientId= is ignored rather than 404ing: the
  // param only preselects a patient, and the page works without one.
  const patientId = patientIdSchema.safeParse(sp.patientId);
  const selectedPatient = patientId.success
    ? await findPatientById({ type: 'user', userId: session.userId }, patientId.data)
    : null;

  return (
    <>
      <TopBar title="New Note" backHref="/dashboard" />
      <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6">
        <h1 className="sr-only">New note</h1>
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <NoteGenerationForm
              templates={templates}
              selectedPatient={selectedPatient}
              initialPatientId={selectedPatient?.id ?? null}
            />
          </div>
          <div className="hidden xl:block w-72 flex-shrink-0">
            <PatientContextPreview patient={selectedPatient} />
          </div>
        </div>
      </main>
    </>
  );
}
