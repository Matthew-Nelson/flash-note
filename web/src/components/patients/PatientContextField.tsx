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
 * Explicit Save textarea for persistent patient context.
 *
 * - Save button renders only when the textarea is dirty (distinct from original).
 * - Save invokes updatePatientContextAction. On success, announces
 *   "Context saved." via a polite aria-live region.
 * - aria-live region is unconditionally rendered (Rule 13).
 */
export function PatientContextField({ patient }: PatientContextFieldProps): React.ReactElement {
  const original = patient.context ?? '';
  const [value, setValue] = useState<string>(original);
  const [savedValue, setSavedValue] = useState<string>(original);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');
  const [isPending, startTransition] = useTransition();

  const dirty = value !== savedValue;
  const tooLong = value.length > MAX_CONTEXT;

  function handleSave(): void {
    if (!dirty || tooLong) return;
    setErrorCode(null);
    startTransition(async () => {
      const res = await updatePatientContextAction(
        patient.id,
        value.length === 0 ? null : value,
      );
      if (res.success) {
        setSavedValue(value);
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

        <label
          htmlFor={`context-${patient.id}`}
          className="label block text-fn-base font-semibold mb-1.5"
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
            Injected into future notes generated for this patient. Max {MAX_CONTEXT} characters.
          </p>
          <p className="text-fn-xs text-fn-text-secondary tabular-nums">
            {value.length} / {MAX_CONTEXT}
          </p>
        </div>

        {dirty && (
          <div className="mt-4 flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setValue(savedValue)}
              disabled={isPending}
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              loading={isPending}
              disabled={tooLong}
            >
              Save context
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
