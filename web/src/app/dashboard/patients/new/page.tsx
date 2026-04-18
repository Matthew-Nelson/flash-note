import { redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { TopBar } from '@/components/TopBar';
import { PatientCreateForm } from '@/components/patients';

export default async function NewPatientPage() {
  const session = await getSession();
  if (!session) redirect('/login?reason=session_expired');

  return (
    <>
      <TopBar title="Add patient" backHref="/dashboard/patients" />
      <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-fn-2xl font-semibold tracking-fn-tight text-fn-text-primary">
            Add patient
          </h1>
          <p className="mt-1 text-fn-base text-fn-text-secondary">
            Required fields are marked with an asterisk.
          </p>
        </div>
        <PatientCreateForm />
      </main>
    </>
  );
}
