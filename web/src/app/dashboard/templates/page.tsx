import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { TopBar } from '@/components/TopBar';

export default async function TemplatesPage() {
  const session = await getSession();
  if (!session) redirect('/login?reason=session_expired');

  return (
    <>
      <TopBar title="Templates" />
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
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
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
            Custom templates are on the way. For now, generate notes from the dashboard.
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
