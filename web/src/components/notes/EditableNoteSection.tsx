'use client';

import { useEffect, useState, useTransition } from 'react';
// useEffect retained for the beforeunload listener below.

import { updateNoteSectionsAction } from '@/actions/notes';
import { Alert, Button } from '@/components/ui';
import type { NoteSection } from '@/lib/types';

import { mapNoteError } from './error-messages';
import { VersionHistory } from './VersionHistory';
import type { NoteVersionWithSection } from '@/lib/types';

export interface EditableNoteSectionProps {
  noteId: string;
  section: NoteSection;
  /** ISO string from the server load — sent back as expectedUpdatedAt. */
  expectedUpdatedAt: string;
  /** Version history rows for this section (DESC by version). */
  versions: NoteVersionWithSection[];
  /** Called after successful save so the parent can refresh versions/updated_at. */
  onSaved?: (newUpdatedAt: string) => void;
  /** Called when the user clicks Refresh after a conflict. */
  onRefreshRequested?: () => void;
}

/**
 * EditableNoteSection — one SOAP section in edit-capable read mode.
 *
 * Read mode: title + content + edit button + history disclosure.
 * Edit mode: textarea + Discard changes + Save section.
 *
 * Conflict UX (Plan 04-03 / M-1): when updateNoteSectionsAction returns
 * 'conflict', we render an inline alert (role="alert" aria-live="assertive")
 * with two actions — Refresh (reloads server state) and Copy my changes
 * (navigator.clipboard.writeText on the edit buffer so the clinician can
 * paste into the refreshed note).
 *
 * Dirty-state navigation guard: when there are unsaved edits we attach a
 * beforeunload listener so browser nav prompts the clinician. In-app nav
 * (Link clicks) is governed at the page level.
 */
export function EditableNoteSection({
  noteId,
  section,
  expectedUpdatedAt,
  versions,
  onSaved,
  onRefreshRequested,
}: EditableNoteSectionProps) {
  // Track upstream content with a key so we can reset draft when the parent
  // refreshes (router.refresh after successful save).
  const [tracked, setTracked] = useState({
    upstream: section.content,
    draft: section.content,
    mode: 'read' as 'read' | 'edit',
  });
  // Sync pattern: when section.content changes, reset tracked state.
  // Using a render-time compare + setState is the React-approved reset idiom.
  if (tracked.upstream !== section.content) {
    setTracked({ upstream: section.content, draft: section.content, mode: 'read' });
  }
  const mode = tracked.mode;
  const setMode = (m: 'read' | 'edit') => setTracked((t) => ({ ...t, mode: m }));
  const draft = tracked.draft;
  const setDraft = (value: string) => setTracked((t) => ({ ...t, draft: value }));
  const originalContent = tracked.upstream;

  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty = mode === 'edit' && draft !== originalContent;

  // Dirty-state guard (Rule 13): prompt on browser navigation when there are
  // unsaved edits. In-app routing guards are at the ClientNoteDetail level.
  useEffect(() => {
    if (!isDirty) return;
    function handle(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, [isDirty]);

  function handleEdit() {
    setMode('edit');
    setErrorCode(null);
    setConflict(false);
  }

  function handleDiscard() {
    setDraft(originalContent);
    setMode('read');
    setErrorCode(null);
    setConflict(false);
  }

  function handleSave() {
    setErrorCode(null);
    setConflict(false);
    setSavedMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('noteId', noteId);
      fd.set('expectedUpdatedAt', expectedUpdatedAt);
      fd.set('sections', JSON.stringify({ [section.sectionId]: draft }));
      const result = await updateNoteSectionsAction(fd);
      if (result.success) {
        setTracked({ upstream: draft, draft, mode: 'read' });
        setSavedMessage('Section saved.');
        onSaved?.(new Date(result.data.note.updatedAt).toISOString());
      } else if (result.error === 'conflict') {
        setConflict(true);
      } else {
        setErrorCode(result.error);
      }
    });
  }

  async function handleCopyChanges() {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(draft);
      setSavedMessage('Copied your changes to clipboard.');
    } catch {
      // Silent — fallback handled by UI state (the textarea is still visible).
    }
  }

  function handleRefresh() {
    onRefreshRequested?.();
  }

  return (
    <section aria-labelledby={`section-${section.sectionId}-title`} className="mb-6">
      <header className="flex items-center justify-between mb-2">
        <h3
          id={`section-${section.sectionId}-title`}
          className="text-fn-lg font-semibold text-fn-text-primary"
        >
          {section.title}
        </h3>
        {mode === 'read' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleEdit}
            aria-label={`Edit ${section.title} section`}
          >
            Edit
          </Button>
        )}
      </header>

      {/* Conflict alert — Alert itself has role="alert"; we add
          aria-live="assertive" on the wrapping div so screen readers
          immediately announce even if the Alert unmounts/remounts. */}
      {conflict && (
        <div aria-live="assertive" className="mb-3">
          <Alert variant="error">
            <div>
              <p className="font-semibold mb-2">
                This note was modified elsewhere. Refresh to see the latest version.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={handleRefresh}>
                  Refresh
                </Button>
                <Button variant="secondary" size="sm" onClick={handleCopyChanges}>
                  Copy my changes
                </Button>
              </div>
            </div>
          </Alert>
        </div>
      )}

      {/* Generic error */}
      {errorCode && !conflict && (
        <div aria-live="assertive" className="mb-3">
          <Alert variant="error">{mapNoteError(errorCode)}</Alert>
        </div>
      )}

      {/* Save confirmation (polite) */}
      <div aria-live="polite" className="sr-only">
        {savedMessage}
      </div>

      {mode === 'read' ? (
        <div className="whitespace-pre-wrap text-fn-base text-fn-text-primary">
          {section.content}
        </div>
      ) : (
        <div>
          <label htmlFor={`section-${section.sectionId}-editor`} className="sr-only">
            Edit {section.title}
          </label>
          <textarea
            id={`section-${section.sectionId}-editor`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            maxLength={10000}
            className="input-field w-full px-3 py-2 resize-y"
            disabled={isPending}
          />
          <div className="mt-2 flex gap-2 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDiscard}
              disabled={isPending}
            >
              Discard changes
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={isPending}
              aria-busy={isPending}
            >
              {isPending ? 'Saving…' : 'Save section'}
            </Button>
          </div>
        </div>
      )}

      <VersionHistory sectionId={section.sectionId} versions={versions} />
    </section>
  );
}
