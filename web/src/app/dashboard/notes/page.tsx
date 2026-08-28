import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getSession } from '@/server/lib/get-session';
import { findClinicalNotesByScope } from '@/server/dal';
import { logger } from '@/server/lib/logger';
import type { NoteType } from '@/lib/types';
import { TopBar } from '@/components/TopBar';
import { Button } from '@/components/ui';
import { NoteRow, SearchNotes } from '@/components/notes';

interface Props {
  searchParams: Promise<{
    patientId?: string;
    noteType?: string;
    q?: string;
    page?: string;
  }>;
}

const NOTE_TYPES = new Set(['daily_note', 'initial_eval', 'progress_note', 'discharge']);
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

  const sp = await searchParams;
  const page = Math.max(Number.parseInt(sp.page ?? '1', 10) || 1, 1);
  const q = sp.q?.trim() ?? '';
  const noteType = sp.noteType && NOTE_TYPES.has(sp.noteType) ? sp.noteType : undefined;

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
          key={`${sp.patientId ?? ''}::${noteType ?? ''}::${q}::${page}`}
          fallback={<NotesTableSkeleton />}
        >
          <NotesTable
            userId={session.userId}
            patientId={sp.patientId}
            noteType={noteType as NoteType | undefined}
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
  const filters = {
    patientId,
    noteType,
    search: q || undefined,
  };

  const { notes, total } = await findClinicalNotesByScope(
    { type: 'user', userId },
    { ...filters, limit: PAGE_SIZE, offset },
  );

  logger.info(
    { source: 'page_notes_list', userId, ...filters, page, resultCount: notes.length },
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
    <div className="rounded-fn-base border border-fn-border overflow-hidden">
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
      <p className="sr-only" aria-live="polite">
        Loading notes.
      </p>
    </div>
  );
}
