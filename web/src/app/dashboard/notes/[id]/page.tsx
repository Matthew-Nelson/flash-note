import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { findClinicalNoteById, findVersionsByNoteId } from '@/server/dal';
import { auditService } from '@/server/services/audit';
import { getRequestContext } from '@/server/lib/request-context';
import { AuditAction } from '@/server/types';
import { noteIdSchema } from '@/lib/schemas/notes';
import { TopBar } from '@/components/TopBar';
import { ClientNoteDetail } from '@/components/notes/ClientNoteDetail';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * /dashboard/notes/[id] — Server Component.
 *
 * Loads the note + its full version history via DAL (Rule 5 — user-scoped),
 * fires NOTE_VIEWED + NOTE_HISTORY_VIEWED audit events fire-and-forget on
 * render (B-2 — verified by unit-test spies on auditService.log mock, mirrors
 * the 04-02 PATIENT_VIEWED pattern), and delegates to ClientNoteDetail for
 * interactive state.
 *
 * Rule 8: session validated here — proxy.ts only does optimistic cookie check.
 */
export default async function NoteDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect('/login?reason=session_expired');

  const { id } = await params;
  const idParsed = noteIdSchema.safeParse(id);
  if (!idParsed.success) notFound();

  const scope = { type: 'user' as const, userId: session.userId };

  const note = await findClinicalNoteById(scope, idParsed.data);
  if (!note) notFound();

  const versions = await findVersionsByNoteId(scope, idParsed.data);

  const ctx = await getRequestContext();
  await auditService.log({
    userId: session.userId,
    action: AuditAction.NOTE_VIEWED,
    status: 'SUCCESS',
    metadata: { noteId: note.id },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
  await auditService.log({
    userId: session.userId,
    action: AuditAction.NOTE_HISTORY_VIEWED,
    status: 'SUCCESS',
    metadata: { noteId: note.id, versionCount: versions.length },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return (
    <>
      <TopBar title="Note" backHref="/dashboard/notes" />
      <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 max-w-fn-content">
        <ClientNoteDetail note={note} versions={versions} />
      </main>
    </>
  );
}
