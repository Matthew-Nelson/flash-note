import { redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { TopBar } from '@/components/TopBar';

export default async function PatientsPage() {
  const session = await getSession();
  if (!session) redirect('/login?reason=session_expired');

  return (
    <>
      <TopBar title="Patients" />
      <main id="main-content" tabIndex={-1} className="flex-1 p-6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg
            aria-hidden="true"
            className="w-12 h-12 text-fn-text-muted mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <h2 className="text-fn-lg font-semibold text-fn-text-primary mb-2">
            Coming Soon
          </h2>
          <p className="text-fn-sm text-fn-text-secondary max-w-sm">
            Patient management is on the way. For now, generate notes from the dashboard.
          </p>
        </div>
      </main>
    </>
  );
}
