import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { TopBar } from '@/components/TopBar';

export default async function NotesPage() {
  const session = await getSession();
  if (!session) redirect('/login?reason=session_expired');

  return (
    <>
      <TopBar title="Notes" />
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
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
            Note history is on the way. For now, generate notes from the dashboard.
          </p>
          <Link
            href="/dashboard/notes/new"
            className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 mt-6 text-fn-sm"
          >
            Generate a Note
          </Link>
        </div>
      </main>
    </>
  );
}
