'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, Card, CardContent } from '@/components/ui';
import { updatePatientContextAction } from '@/actions/patients';
import type { Patient } from '@/lib/types';
import { mapPatientError } from './error-messages';

interface PatientContextFieldProps {
  patient: Patient;
}

const MAX_CONTEXT = 2000;

/**
 * Persistent patient context field — view/edit toggle.
 *
 * - Read mode (default): renders the saved context as read-only paragraph
 *   (or a muted placeholder when empty) + an "Edit" button.
 * - Edit mode: renders the textarea + Save + Cancel buttons.
 * - Save invokes updatePatientContextAction. On success, exits edit mode
 *   and announces "Context saved." via a polite aria-live region.
 * - Cancel discards unsaved edits and exits edit mode.
 * - aria-live region is unconditionally rendered (Rule 13).
 *
 * Matches the view/edit pattern used by PatientInfoCard — no accidental
 * inline-editing for this patient-scoped PHI field.
 */
export function PatientContextField({ patient }: PatientContextFieldProps): React.ReactElement {
  const savedFromProps = patient.context ?? '';
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(savedFromProps);
  const [savedValue, setSavedValue] = useState<string>(savedFromProps);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');
  const [isPending, startTransition] = useTransition();

  const tooLong = value.length > MAX_CONTEXT;

  function handleEdit(): void {
    setValue(savedValue);
    setErrorCode(null);
    setEditing(true);
  }

  function handleCancel(): void {
    if (isPending) return;
    setValue(savedValue);
    setErrorCode(null);
    setEditing(false);
  }

  function handleSave(): void {
    if (tooLong) return;
    setErrorCode(null);
    startTransition(async () => {
      const res = await updatePatientContextAction(
        patient.id,
        value.length === 0 ? null : value,
      );
      if (res.success) {
        setSavedValue(value);
        setEditing(false);
        setAnnouncement('Context saved.');
        setTimeout(() => setAnnouncement(''), 1500);
        return;
      }
      setErrorCode(res.error);
    });
  }

  return (
    <Card>
      <CardContent>
        {/* Unconditional aria-live region (Rule 13) */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>

        {errorCode && (
          <Alert variant="error" className="mb-4">
            {mapPatientError(errorCode)}
          </Alert>
        )}

        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2
              id={`context-heading-${patient.id}`}
              className="text-fn-base font-semibold text-fn-text-primary"
            >
              Patient context
            </h2>
            <p className="text-fn-xs text-fn-text-secondary mt-0.5">
              Injected into future notes generated for this patient. Max {MAX_CONTEXT} characters.
            </p>
          </div>
          {!editing && (
            <Button
              variant="secondary"
              type="button"
              onClick={handleEdit}
              aria-label="Edit patient context"
            >
              Edit
            </Button>
          )}
        </div>

        {!editing ? (
          <div
            aria-labelledby={`context-heading-${patient.id}`}
            className="text-fn-base text-fn-text-primary whitespace-pre-wrap break-words"
          >
            {savedValue ? (
              savedValue
            ) : (
              <span className="text-fn-text-secondary italic">
                No context saved yet.
              </span>
            )}
          </div>
        ) : (
          <div>
            <label
              htmlFor={`context-${patient.id}`}
              className="sr-only"
            >
              Patient context
            </label>
            <textarea
              id={`context-${patient.id}`}
              name="context"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={MAX_CONTEXT}
              rows={5}
              placeholder="Chronic L knee pain. Hx TKA 2024."
              className="input-field w-full px-3 py-2"
              disabled={isPending}
              aria-describedby={`context-hint-${patient.id}`}
            />
            <div className="mt-1.5 flex items-center justify-between">
              <p
                id={`context-hint-${patient.id}`}
                className="text-fn-xs text-fn-text-secondary"
              >
                {tooLong ? 'Over the character limit.' : 'Save or cancel your changes.'}
              </p>
              <p className="text-fn-xs text-fn-text-secondary tabular-nums">
                {value.length} / {MAX_CONTEXT}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                type="button"
                onClick={handleCancel}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSave}
                loading={isPending}
                disabled={tooLong}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
