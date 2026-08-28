import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { findPatientsByScope } from '@/server/dal';
import { searchListParamsSchema } from '@/lib/schemas';
import { TopBar } from '@/components/TopBar';
import { Button } from '@/components/ui';
import { PatientRow, SearchPatients } from '@/components/patients';

interface PatientsPageProps {
  // Next.js resolves a repeated param (?q=a&q=b) to string[]; the schema
  // normalizes and bounds it (Rule 3).
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 50;

export default async function PatientsPage({ searchParams }: PatientsPageProps) {
  const session = await getSession();
  if (!session) redirect('/login?reason=session_expired');

  const { q, page } = searchListParamsSchema.parse(await searchParams);

  return (
    <>
      <TopBar title="Patients" />
      <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-fn-2xl font-semibold tracking-fn-tight text-fn-text-primary">
            Patients
          </h1>
          <Link href="/dashboard/patients/new">
            <Button variant="primary">Add patient</Button>
          </Link>
        </div>

        <SearchPatients initialQuery={q} />

        <Suspense key={`${q}::${page}`} fallback={<PatientsTableSkeleton />}>
          <PatientsTable userId={session.userId} q={q} page={page} />
        </Suspense>
      </main>
    </>
  );
}

interface PatientsTableProps {
  userId: string;
  q: string;
  page: number;
}

export async function PatientsTable({ userId, q, page }: PatientsTableProps) {
  const offset = (page - 1) * PAGE_SIZE;
  const { patients, total } = await findPatientsByScope(
    { type: 'user', userId },
    { search: q || undefined, limit: PAGE_SIZE, offset },
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <>
      {patients.length === 0 ? (
        <div className="py-16 text-center">
          <h2 className="text-fn-lg font-semibold text-fn-text-primary">
            {q ? `No patients match "${q}"` : 'No patients yet'}
          </h2>
          <p className="mt-2 text-fn-base text-fn-text-secondary max-w-md mx-auto">
            {q
              ? 'Try a different name or clear the search.'
              : 'Create your first patient to start saving notes and building a patient history.'}
          </p>
          {!q && (
            <div className="mt-6">
              <Link href="/dashboard/patients/new">
                <Button variant="primary">Add patient</Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-fn-base border border-fn-border bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-fn-border bg-fn-slate-50">
                <th className="px-3 py-2 text-left text-fn-xs font-semibold uppercase tracking-fn-wider text-fn-text-secondary">
                  Name
                </th>
                <th className="px-3 py-2 text-left text-fn-xs font-semibold uppercase tracking-fn-wider text-fn-text-secondary">
                  Date of birth
                </th>
                <th className="px-3 py-2 text-left text-fn-xs font-semibold uppercase tracking-fn-wider text-fn-text-secondary">
                  Pronoun
                </th>
                <th className="px-3 py-2 text-left text-fn-xs font-semibold uppercase tracking-fn-wider text-fn-text-secondary">
                  Added
                </th>
                <th className="px-3 py-2 text-right text-fn-xs font-semibold uppercase tracking-fn-wider text-fn-text-secondary">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <PatientRow key={p.id} patient={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(hasPrev || hasNext) && (
        <nav
          aria-label="Pagination"
          className="mt-6 flex items-center justify-between"
        >
          <Link
            href={{
              pathname: '/dashboard/patients',
              query: hasPrev
                ? { ...(q ? { q } : {}), page: page - 1 }
                : undefined,
            }}
            aria-disabled={!hasPrev}
            className={`inline-flex items-center justify-center min-h-[44px] px-4 rounded-fn-base border border-fn-border text-fn-base ${
              hasPrev
                ? 'hover:bg-fn-slate-50 cursor-pointer'
                : 'opacity-50 cursor-not-allowed pointer-events-none'
            }`}
          >
            Previous
          </Link>
          <span className="text-fn-xs text-fn-text-secondary">
            Page {page} of {totalPages}
          </span>
          <Link
            href={{
              pathname: '/dashboard/patients',
              query: hasNext
                ? { ...(q ? { q } : {}), page: page + 1 }
                : undefined,
            }}
            aria-disabled={!hasNext}
            className={`inline-flex items-center justify-center min-h-[44px] px-4 rounded-fn-base border border-fn-border text-fn-base ${
              hasNext
                ? 'hover:bg-fn-slate-50 cursor-pointer'
                : 'opacity-50 cursor-not-allowed pointer-events-none'
            }`}
          >
            Next
          </Link>
        </nav>
      )}
    </>
  );
}

function PatientsTableSkeleton(): React.ReactElement {
  return (
    <div
      className="overflow-hidden rounded-fn-base border border-fn-border bg-white"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="sr-only">Loading patients…</div>
      <div className="h-10 bg-fn-slate-50 border-b border-fn-border" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-5 gap-3 px-3 py-3 border-b border-fn-border"
        >
          <div className="h-4 rounded bg-fn-slate-100 animate-fn-shimmer" />
          <div className="h-4 rounded bg-fn-slate-100 animate-fn-shimmer" />
          <div className="h-4 rounded bg-fn-slate-100 animate-fn-shimmer" />
          <div className="h-4 rounded bg-fn-slate-100 animate-fn-shimmer" />
          <div className="h-4 rounded bg-fn-slate-100 animate-fn-shimmer justify-self-end w-8" />
        </div>
      ))}
    </div>
  );
}
