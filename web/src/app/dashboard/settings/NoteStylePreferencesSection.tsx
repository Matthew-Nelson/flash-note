'use client';

import { useState, useTransition } from 'react';

import { updateSectionStyleAction } from '@/actions/templates';
import { Alert, Card, CardContent } from '@/components/ui';
import { mapNoteError } from '@/components/notes/error-messages';
import type { NoteTemplateSection, Verbosity, Styling } from '@/lib/types';

interface NoteStylePreferencesSectionProps {
  /** Template sections with user style overrides already applied via
   *  findTemplateWithUserStyle. The verbosity/styling on each section is the
   *  current effective value (user override OR template default). */
  sections: NoteTemplateSection[];
}

/**
 * NoteStylePreferencesSection (Plan 04-03 Task 4c / PROMPT-03).
 *
 * Per-section radio groups for verbosity and styling. onChange fires
 * updateSectionStyleAction optimistically; on error, state reverts.
 * aria-live="polite" announces save confirmation.
 */
export function NoteStylePreferencesSection({
  sections,
}: NoteStylePreferencesSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [local, setLocal] = useState(() =>
    sections.reduce<Record<string, { verbosity: Verbosity; styling: Styling }>>((acc, s) => {
      acc[s.id] = { verbosity: s.verbosity, styling: s.styling };
      return acc;
    }, {}),
  );
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  function handleChange(
    sectionId: string,
    field: 'verbosity' | 'styling',
    value: string,
  ) {
    const prev = local[sectionId];
    // Optimistic local update
    setLocal((p) => ({
      ...p,
      [sectionId]: { ...p[sectionId], [field]: value as Verbosity | Styling },
    }));
    setSavedMessage(null);
    setErrorCode(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('sectionId', sectionId);
      fd.set(field, value);
      const result = await updateSectionStyleAction(fd);
      if (result.success) {
        setSavedMessage('Preferences saved.');
      } else {
        // Revert local state on error
        setLocal((p) => ({ ...p, [sectionId]: prev }));
        setErrorCode(result.error);
      }
    });
  }

  return (
    <Card>
      <CardContent>
        <h2 className="text-fn-lg font-semibold text-fn-text-primary mb-2">
          Note style preferences
        </h2>
        <p className="text-fn-sm text-fn-text-secondary mb-4">
          Pick how the AI should format each section of your SOAP notes. These preferences apply to the next note you generate.
        </p>

        {errorCode && (
          <Alert variant="error" className="mb-4">
            {mapNoteError(errorCode)}
          </Alert>
        )}

        <div aria-live="polite" className="sr-only">
          {savedMessage}
        </div>

        <ul className="space-y-6">
          {sections.map((section) => (
            <li key={section.id}>
              <h3 className="text-fn-base font-semibold text-fn-text-primary mb-2">
                {section.title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <fieldset>
                  <legend className="block text-fn-sm text-fn-text-secondary mb-1.5">
                    Verbosity
                  </legend>
                  <div className="flex gap-3">
                    {(['concise', 'detailed'] as const).map((option) => {
                      const id = `${section.id}-verbosity-${option}`;
                      return (
                        <label key={option} htmlFor={id} className="inline-flex items-center gap-2 text-fn-sm">
                          <input
                            id={id}
                            type="radio"
                            name={`${section.id}-verbosity`}
                            value={option}
                            checked={local[section.id].verbosity === option}
                            onChange={() => handleChange(section.id, 'verbosity', option)}
                            disabled={isPending}
                          />
                          <span className="capitalize">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="block text-fn-sm text-fn-text-secondary mb-1.5">
                    Formatting
                  </legend>
                  <div className="flex gap-3">
                    {(['paragraph', 'bullets'] as const).map((option) => {
                      const id = `${section.id}-styling-${option}`;
                      return (
                        <label key={option} htmlFor={id} className="inline-flex items-center gap-2 text-fn-sm">
                          <input
                            id={id}
                            type="radio"
                            name={`${section.id}-styling`}
                            value={option}
                            checked={local[section.id].styling === option}
                            onChange={() => handleChange(section.id, 'styling', option)}
                            disabled={isPending}
                          />
                          <span className="capitalize">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
