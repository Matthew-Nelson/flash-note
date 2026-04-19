'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { archiveNoteAction } from '@/actions/notes';
import { Alert, Button, ConfirmDialog } from '@/components/ui';
import { usePhiCleanup } from '@/hooks/use-phi-cleanup';
import type { ClinicalNoteWithPatient, NoteVersionWithSection } from '@/lib/types';

import { EditableNoteSection } from './EditableNoteSection';
import { mapNoteError } from './error-messages';

interface ClientNoteDetailProps {
  note: ClinicalNoteWithPatient;
  versions: NoteVersionWithSection[];
}

/**
 * ClientNoteDetail — client wrapper for /dashboard/notes/[id].
 *
 * Responsibilities:
 *   - Hosts per-section editors (EditableNoteSection) with a shared
 *     expectedUpdatedAt token (optimistic lock).
 *   - Drives the archive ConfirmDialog.
 *   - Wires usePhiCleanup so section drafts, archive dialog error state,
 *     and any in-flight fetches are cleared on logout / route change (Rule 4).
 */
export function ClientNoteDetail({ note, versions }: ClientNoteDetailProps) {
  const router = useRouter();
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(
    new Date(note.updatedAt).toISOString(),
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const cleanupRef = useRef(() => {
    setArchiveOpen(false);
    setArchiveError(null);
  });

  useEffect(() => {
    cleanupRef.current = () => {
      setArchiveOpen(false);
      setArchiveError(null);
    };
  });

  usePhiCleanup(cleanupRef);

  function handleSaved(newUpdatedAt: string) {
    setExpectedUpdatedAt(newUpdatedAt);
    // Refresh server data so VersionHistory repopulates for the edited section.
    router.refresh();
  }

  function handleRefreshRequested() {
    router.refresh();
  }

  function handleArchiveConfirm() {
    startTransition(async () => {
      const result = await archiveNoteAction(note.id);
      if (result.success) {
        router.push('/dashboard/notes');
      } else {
        setArchiveError(result.error);
      }
    });
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-fn-2xl font-semibold tracking-fn-tight text-fn-text-primary">
          Note {note.patientFirstName ? `— ${note.patientFirstName} ${note.patientLastName ?? ''}` : ''}
        </h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setArchiveOpen(true)}
          aria-label="Archive note"
        >
          Archive
        </Button>
      </header>

      {archiveError && (
        <Alert variant="error" className="mb-4">
          {mapNoteError(archiveError)}
        </Alert>
      )}

      <section aria-labelledby="note-sections-heading">
        <h2 id="note-sections-heading" className="sr-only">
          Note sections
        </h2>
        {note.content.map((section) => (
          <EditableNoteSection
            key={section.sectionId}
            noteId={note.id}
            section={section}
            expectedUpdatedAt={expectedUpdatedAt}
            versions={versions}
            onSaved={handleSaved}
            onRefreshRequested={handleRefreshRequested}
          />
        ))}
      </section>

      <ConfirmDialog
        open={archiveOpen}
        title="Archive this note?"
        body="The note will be removed from your list. Version history is retained for audit purposes."
        confirmLabel="Archive"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveOpen(false)}
        loading={isPending}
      />
    </div>
  );
}
