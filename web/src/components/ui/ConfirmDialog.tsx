'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: 'primary' | 'destructive';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  errorMessage?: string | null;
  /** Optional status announcement (e.g. "Patient archived.") — rendered inside the
   *  visually-hidden aria-live region. Takes precedence over loading copy. */
  statusMessage?: string | null;
}

/**
 * Shared destructive-action confirmation modal.
 *
 * UI-SPEC Destructive confirmations:
 *  - role="dialog", aria-modal="true", aria-labelledby on heading
 *  - Initial focus MUST go to Cancel button (safer default), NOT the destructive CTA
 *  - Tab cycles within modal (focus trap)
 *  - Escape closes (equivalent to Cancel)
 *  - Backdrop click closes (equivalent to Cancel); both are ignored while loading
 *  - Body scroll locked while open
 *  - Unconditional aria-live region (Rule 13) announces loading + errors + success
 *
 * Plan 04-02 first use = archive patient. Plan 04-03 reuses for archive note.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  loading = false,
  errorMessage = null,
  statusMessage = null,
}: ConfirmDialogProps): React.ReactElement | null {
  const titleId = useId();
  const bodyId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Capture a stable reference to the onCancel callback so the Escape/Tab
  // handler below doesn't re-register on every prop change. We still want
  // the handler to call the *latest* onCancel — closure via ref.
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;

    // Lock body scroll while modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Initial focus lands on Cancel (safer default per UI-SPEC).
    cancelButtonRef.current?.focus();

    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (loading) return;
        e.preventDefault();
        onCancelRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      // Focus trap: cycle within the dialog.
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return (): void => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, loading]);

  if (!open) return null;

  // Live-region content priority: error > status > loading-hint > empty.
  const liveText = errorMessage
    ? errorMessage
    : statusMessage
      ? statusMessage
      : loading
        ? 'Working...'
        : '';

  const handleBackdropClick = (): void => {
    if (loading) return;
    onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-md rounded-fn-base bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-fn-lg font-semibold text-fn-text-primary tracking-fn-tight"
        >
          {title}
        </h2>
        <div id={bodyId} className="mt-4 text-fn-base text-fn-text-secondary">
          {body}
        </div>

        {/* Rule 13: aria-live region is unconditionally rendered so screen readers
            pick up loading/error/success announcements when content changes inside. */}
        <div
          aria-live={errorMessage ? 'assertive' : 'polite'}
          aria-atomic="true"
          className="sr-only"
        >
          {liveText}
        </div>

        {errorMessage && (
          <p role="alert" className="mt-4 text-fn-base text-fn-error">
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button
            ref={cancelButtonRef}
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            loading={loading}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
