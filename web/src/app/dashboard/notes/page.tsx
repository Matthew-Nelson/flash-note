import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getSession } from '@/server/lib/get-session';
import { findClinicalNotesByScope } from '@/server/dal';
import { logger } from '@/server/lib/logger';
import { notesListParamsSchema } from '@/lib/schemas';
import type { NoteType } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { Button } from '@/components/ui';
import { NoteRow, SearchNotes } from '@/components/notes';

interface Props {
  // Next.js resolves a repeated param (?q=a&q=b) to string[], so this mirrors
  // what the framework actually delivers rather than the happy path.
  // notesListParamsSchema normalizes and validates it (Rule 3).
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 50;

/**
 * /dashboard/notes — notes list Server Component.
 *
 * Rule 5 + Rule 8: session guard, DAL for listing via user scope.
 * URL-driven filters: ?patientId=... ?noteType=... ?q=... ?page=...
 * Pagination: 50 per page. "New note" CTA linked in the header.
 *
 * The DAL fetch lives in a keyed <Suspense> child so a search keystroke
 * re-renders only the table — the search input keeps focus (see SearchNotes).
 */
export default async function NotesPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/login?reason=session_expired');

  const { q, page, noteType, patientId } = notesListParamsSchema.parse(
    await searchParams
  );

  return (
    <>
      <TopBar title="Notes" />
      <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-fn-2xl font-semibold tracking-fn-tight text-fn-text-primary">
            Notes
          </h1>
          <Link href="/dashboard/notes/new">
            <Button variant="primary">New note</Button>
          </Link>
        </div>

        <SearchNotes initialQuery={q} />

        <Suspense
          key={`${patientId ?? ''}::${noteType ?? ''}::${q}::${page}`}
          fallback={<NotesTableSkeleton />}
        >
          <NotesTable
            userId={session.userId}
            patientId={patientId}
            noteType={noteType}
            q={q}
            page={page}
          />
        </Suspense>
      </main>
    </>
  );
}

interface NotesTableProps {
  userId: string;
  patientId?: string;
  noteType?: NoteType;
  q: string;
  page: number;
}

export async function NotesTable({ userId, patientId, noteType, q, page }: NotesTableProps) {
  const offset = (page - 1) * PAGE_SIZE;

  const { notes, total } = await findClinicalNotesByScope(
    { type: 'user', userId },
    { patientId, noteType, search: q || undefined, limit: PAGE_SIZE, offset },
  );

  // The search term is deliberately NOT logged, and the filter object is never
  // spread in here. `q` is free text the therapist typed to match against note
  // content, so it is PHI by construction — a patient name, a diagnosis, a body
  // part. Only its presence is observable. Same reasoning for patientId: a
  // boolean is enough to debug the filter path.
  logger.info(
    {
      source: 'page_notes_list',
      userId,
      page,
      noteType,
      hasSearch: q.length > 0,
      filteredByPatient: patientId !== undefined,
      resultCount: notes.length,
    },
    'Notes list rendered',
  );

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  function pageHref(target: number): string {
    return `/dashboard/notes?${new URLSearchParams({
      ...(patientId ? { patientId } : {}),
      ...(noteType ? { noteType } : {}),
      ...(q ? { q } : {}),
      page: String(target),
    }).toString()}`;
  }

  return (
    <>
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-fn-lg font-semibold text-fn-text-primary mb-2">
            {q ? 'No matching notes' : 'No notes yet'}
          </h2>
          <p className="text-fn-sm text-fn-text-secondary max-w-md">
            {q
              ? 'Try a different search term.'
              : 'Generate your first note to start building your clinical history.'}
          </p>
        </div>
      ) : (
        <div className="rounded-fn-base border border-fn-border overflow-hidden bg-fn-bg-primary">
          <table className="w-full">
            <caption className="sr-only">Your notes</caption>
            <thead className="bg-fn-bg-secondary">
              <tr className="border-b border-fn-border">
                <th scope="col" className="px-4 py-2 text-left text-fn-sm font-semibold text-fn-text-secondary">
                  Date
                </th>
                <th scope="col" className="px-4 py-2 text-left text-fn-sm font-semibold text-fn-text-secondary">
                  Type
                </th>
                <th scope="col" className="px-4 py-2 text-left text-fn-sm font-semibold text-fn-text-secondary">
                  Patient
                </th>
                <th scope="col" className="px-4 py-2 text-left text-fn-sm font-semibold text-fn-text-secondary">
                  Modality
                </th>
                <th scope="col" className="px-4 py-2 text-left text-fn-sm font-semibold text-fn-text-secondary">
                  Preview
                </th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <NoteRow key={note.id} note={note} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Notes pagination" className="mt-4 flex items-center justify-between">
          <p className="text-fn-sm text-fn-text-secondary">
            Page {page} of {totalPages} · {total} {total === 1 ? 'note' : 'notes'}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)}>
                <Button variant="secondary" size="sm">
                  Previous
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageHref(page + 1)}>
                <Button variant="secondary" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}

function NotesTableSkeleton() {
  const ghostRows = Array.from({ length: 5 });

  return (
    <div
      className="rounded-fn-base border border-fn-border overflow-hidden"
      aria-busy="true"
    >
      <div className="bg-fn-bg-secondary h-10" aria-hidden="true" />
      <ul className="divide-y divide-fn-border">
        {ghostRows.map((_, idx) => (
          <li key={idx} className="px-4 py-4 grid grid-cols-5 gap-4 items-center">
            <div className="h-4 rounded-fn-sm bg-fn-bg-secondary animate-fn-shimmer" />
            <div className="h-4 rounded-fn-sm bg-fn-bg-secondary animate-fn-shimmer" />
            <div className="h-4 rounded-fn-sm bg-fn-bg-secondary animate-fn-shimmer" />
            <div className="h-4 rounded-fn-sm bg-fn-bg-secondary animate-fn-shimmer" />
            <div className="h-4 rounded-fn-sm bg-fn-bg-secondary animate-fn-shimmer" />
          </li>
        ))}
      </ul>
    </div>
  );
}
