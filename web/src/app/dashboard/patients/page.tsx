import Link from 'next/link';
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
          <div className="w-20 h-20 rounded-full bg-fn-primary-light flex items-center justify-center mb-6">
            <svg
              aria-hidden="true"
              className="w-10 h-10 text-fn-primary"
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
          </div>
          <h2 className="text-fn-lg font-semibold text-fn-text-primary mb-2">
            Coming Soon
          </h2>
          <span className="inline-flex items-center text-fn-2xs font-semibold uppercase tracking-wider text-fn-primary bg-fn-primary-light px-3 py-1 rounded-full mb-3">
            Coming Soon
          </span>
          <p className="text-fn-sm text-fn-text-secondary max-w-sm">
            Patient management is on the way. For now, generate notes from the dashboard.
          </p>
          <Link
            href="/dashboard"
            className="btn-secondary inline-flex items-center justify-center gap-2 px-5 py-2.5 mt-6 text-fn-sm"
          >
            Go to Dashboard
          </Link>
        </div>
      </main>
    </>
  );
}
