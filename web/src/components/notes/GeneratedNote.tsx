'use client';

import { useState, useRef, useEffect } from 'react';
import type { GenerateNoteResponse } from '@/actions/notes';

type BillingData = NonNullable<GenerateNoteResponse['billing']>;
type BillingCharge = NonNullable<BillingData['charges']>[number];
type BillingSuggestedCode = NonNullable<BillingData['suggestedCodes']>[number];
type GoalsData = NonNullable<GenerateNoteResponse['goals']>;
type GoalItem = NonNullable<GoalsData['shortTerm']>[number];

interface GeneratedNoteProps {
  note: GenerateNoteResponse;
}

interface NoteSectionProps {
  title: string;
  content: string;
  isEditing?: boolean;
  editValue?: string;
  onStartEdit?: () => void;
  onEditChange?: (newContent: string) => void;
  onSave?: () => void;
  onCancelEdit?: () => void;
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Icon-only copy button for individual SOAP sections. 44px minimum touch target. */
function SectionCopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleCopy() {
    const success = await writeToClipboard(text);
    if (success) {
      setCopied(true);
      setFallbackText(null);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } else {
      setFallbackText(text);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={label}
        className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2 text-fn-text-secondary hover:text-fn-text-primary transition-colors rounded border border-transparent hover:border-fn-border cursor-pointer"
      >
        {copied ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {copied ? 'Copied to clipboard' : ''}
      </span>
      {fallbackText !== null && (
        <div className="mt-2">
          <p className="text-fn-2xs text-fn-text-secondary mb-1">
            Clipboard unavailable — Select All to copy manually:
          </p>
          <textarea
            readOnly
            value={fallbackText}
            className="input-field w-full text-fn-2xs font-mono p-2 resize-none"
            rows={4}
            aria-label={`${label} — manual copy fallback`}
          />
        </div>
      )}
    </div>
  );
}

/** Icon + text copy button for the "Copy All" action bar. */
function FullCopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleCopy() {
    const success = await writeToClipboard(text);
    if (success) {
      setCopied(true);
      setFallbackText(null);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } else {
      setFallbackText(text);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={label}
        className="inline-flex items-center gap-2 px-4 py-2 btn-primary rounded text-fn-sm font-medium cursor-pointer"
      >
        {copied ? (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy All
          </>
        )}
      </button>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {copied ? 'Copied to clipboard' : ''}
      </span>
      {fallbackText !== null && (
        <div className="mt-2">
          <p className="text-fn-2xs text-fn-text-secondary mb-1">
            Clipboard unavailable — Select All to copy manually:
          </p>
          <textarea
            readOnly
            value={fallbackText}
            className="input-field w-full text-fn-2xs font-mono p-2 resize-none"
            rows={8}
            aria-label={`${label} — manual copy fallback`}
          />
        </div>
      )}
    </div>
  );
}

/** SOAP section card with teal accent bar. Supports view and edit modes. */
function NoteSection({
  title,
  content,
  isEditing = false,
  editValue,
  onStartEdit,
  onEditChange,
  onSave,
  onCancelEdit,
}: NoteSectionProps) {
  const sectionId = `section-heading-${title.toLowerCase()}`;
  const liveRegionRef = useRef<HTMLSpanElement>(null);

  function handleSave() {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = `${title} section saved`;
    }
    onSave?.();
  }

  function handleCancel() {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = `${title} section edit cancelled`;
    }
    onCancelEdit?.();
  }

  return (
    <section
      aria-labelledby={sectionId}
      className={`card border-l-[3px] border-fn-primary mb-4 ${
        isEditing ? 'ring-2 ring-fn-primary bg-fn-primary-50' : ''
      }`}
    >
      <div className="flex items-center justify-between p-3 pb-0">
        <div className="flex items-center gap-2">
          <h3
            id={sectionId}
            className="text-fn-sm font-semibold text-fn-text-primary uppercase tracking-wide"
          >
            {title}
          </h3>
          {isEditing && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-fn-2xs font-medium bg-fn-primary text-white">
              Editing
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2 text-fn-text-secondary hover:text-fn-text-primary transition-colors rounded border border-transparent hover:border-fn-border cursor-pointer text-fn-sm"
                aria-label={`Cancel editing ${title} section`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2 text-fn-primary hover:text-fn-primary-dark transition-colors rounded border border-transparent hover:border-fn-primary cursor-pointer text-fn-sm font-medium"
                aria-label={`Save ${title} section`}
              >
                Save
              </button>
            </>
          ) : (
            <>
              <SectionCopyButton text={content} label={`Copy ${title} section`} />
              <button
                type="button"
                onClick={onStartEdit}
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2 text-fn-text-secondary hover:text-fn-text-primary transition-colors rounded border border-transparent hover:border-fn-border cursor-pointer"
                aria-label={`Edit ${title} section`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-3 pt-2">
        {isEditing ? (
          <textarea
            value={editValue ?? content}
            onChange={(e) => onEditChange?.(e.target.value)}
            aria-label={`Edit ${title} section content`}
            className="input-field w-full p-2 text-fn-sm text-fn-text-secondary leading-relaxed whitespace-pre-wrap resize-y min-h-[120px] bg-transparent"
          />
        ) : (
          <p className="text-fn-sm text-fn-text-secondary leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        )}
      </div>

      {/* aria-live region for save/cancel announcements */}
      <span ref={liveRegionRef} aria-live="polite" aria-atomic="true" className="sr-only" />
    </section>
  );
}

/** 5-star rating widget using individual buttons (not role="radio") */
function RatingWidget() {
  const [rating, setRating] = useState<number>(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');

  function handleRate(star: number) {
    setRating(star);
    setAnnouncement(`Rated ${star} out of 5 stars`);
  }

  const displayRating = hovered ?? rating;

  return (
    <div className="mt-6 pt-4 border-t border-fn-border">
      <p className="text-fn-sm text-fn-text-secondary mb-3">How was this note?</p>
      <div role="group" aria-label="Rate this note" className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`Rate ${star} out of 5 stars`}
            aria-pressed={rating >= star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer transition-transform hover:scale-110 motion-reduce:hover:scale-100"
          >
            <svg
              className="w-6 h-6"
              fill={displayRating >= star ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={displayRating >= star ? 0 : 1.5}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                className={displayRating >= star ? 'text-yellow-400' : 'text-fn-text-secondary'}
              />
            </svg>
          </button>
        ))}
      </div>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

function GoalStatusBadge({ status }: { status: GoalItem['status'] }) {
  const styles: Record<GoalItem['status'], string> = {
    not_started: 'bg-fn-bg-secondary text-fn-text-secondary',
    progressing: 'bg-fn-info-light text-fn-info-dark',
    met: 'bg-fn-success-light text-fn-success-dark',
    discontinued: 'bg-fn-error-light text-fn-error-dark',
  };
  const labels: Record<GoalItem['status'], string> = {
    not_started: 'Not Started',
    progressing: 'Progressing',
    met: 'Met',
    discontinued: 'Discontinued',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-fn-2xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function BillingSection({ billing }: { billing: BillingData }) {
  const hasCharges = billing.charges && billing.charges.length > 0;
  const hasSuggestedCodes = billing.suggestedCodes && billing.suggestedCodes.length > 0;
  const hasModifiers = billing.suggestedModifiers && billing.suggestedModifiers.length > 0;

  if (!hasCharges && !hasSuggestedCodes && !hasModifiers) return null;

  return (
    <div className="card p-4">
      <h3 className="text-fn-sm font-semibold text-fn-text-primary uppercase tracking-wide mb-3">
        Billing Reference
      </h3>

      {hasCharges && (
        <div className="mb-4">
          <p className="text-fn-2xs text-fn-text-secondary mb-2">Timed charges (explicit minutes provided):</p>
          <div className="overflow-x-auto">
            <table className="w-full text-fn-sm">
              <thead>
                <tr className="border-b border-fn-border">
                  <th className="text-left py-1.5 pr-3 text-fn-2xs font-medium text-fn-text-secondary">CPT</th>
                  <th className="text-left py-1.5 pr-3 text-fn-2xs font-medium text-fn-text-secondary">Description</th>
                  <th className="text-right py-1.5 pr-3 text-fn-2xs font-medium text-fn-text-secondary">Min</th>
                  <th className="text-right py-1.5 text-fn-2xs font-medium text-fn-text-secondary">Units</th>
                </tr>
              </thead>
              <tbody>
                {billing.charges!.map((charge: BillingCharge, i: number) => (
                  <tr key={i} className="border-b border-fn-border/50">
                    <td className="py-1.5 pr-3 font-mono text-fn-2xs">{charge.cptCode}</td>
                    <td className="py-1.5 pr-3 text-fn-text-secondary text-fn-2xs">{charge.description}</td>
                    <td className="py-1.5 pr-3 text-right text-fn-2xs">{charge.minutes}</td>
                    <td className="py-1.5 text-right text-fn-2xs font-medium">{charge.units}</td>
                  </tr>
                ))}
              </tbody>
              {(billing.totalTimedMinutes !== undefined || billing.totalUnits !== undefined) && (
                <tfoot>
                  <tr>
                    <td colSpan={2} className="pt-1.5 text-fn-2xs text-fn-text-secondary">Total</td>
                    <td className="pt-1.5 text-right text-fn-2xs font-medium">
                      {billing.totalTimedMinutes ?? '—'}
                    </td>
                    <td className="pt-1.5 text-right text-fn-2xs font-medium">
                      {billing.totalUnits ?? '—'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {hasSuggestedCodes && (
        <div className="mb-3">
          <p className="text-fn-2xs text-fn-text-secondary mb-2">Suggested codes (no times provided):</p>
          <div className="flex flex-wrap gap-2">
            {billing.suggestedCodes!.map((code: BillingSuggestedCode, i: number) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2 py-1 bg-fn-bg-secondary rounded text-fn-2xs border border-fn-border">
                <span className="font-mono font-medium">{code.cptCode}</span>
                <span className="text-fn-text-secondary">{code.description}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {hasModifiers && (
        <div>
          <p className="text-fn-2xs text-fn-text-secondary mb-1.5">Suggested modifiers:</p>
          <div className="flex flex-wrap gap-1.5">
            {billing.suggestedModifiers!.map((mod: string, i: number) => (
              <span key={i} className="font-mono text-fn-2xs px-2 py-0.5 bg-fn-bg-secondary rounded border border-fn-border">
                {mod}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GoalsSection({ goals }: { goals: GoalsData }) {
  const hasShortTerm = goals.shortTerm && goals.shortTerm.length > 0;
  const hasLongTerm = goals.longTerm && goals.longTerm.length > 0;

  if (!hasShortTerm && !hasLongTerm) return null;

  function renderGoals(items: GoalItem[]) {
    return (
      <ul className="space-y-2">
        {items.map((goal, i) => (
          <li key={i} className="flex items-start gap-2">
            <GoalStatusBadge status={goal.status} />
            <div className="flex-1 min-w-0">
              <span className="text-fn-sm text-fn-text-secondary">{goal.description}</span>
              {goal.percentComplete !== undefined && (
                <span className="ml-2 text-fn-2xs text-fn-text-secondary">({goal.percentComplete}%)</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="card p-4">
      <h3 className="text-fn-sm font-semibold text-fn-text-primary uppercase tracking-wide mb-3">
        Goals
      </h3>
      {hasShortTerm && (
        <div className="mb-4">
          <p className="text-fn-2xs font-medium text-fn-text-secondary mb-2">Short-Term:</p>
          {renderGoals(goals.shortTerm!)}
        </div>
      )}
      {hasLongTerm && (
        <div>
          <p className="text-fn-2xs font-medium text-fn-text-secondary mb-2">Long-Term:</p>
          {renderGoals(goals.longTerm!)}
        </div>
      )}
    </div>
  );
}

function buildFullNoteText(note: GenerateNoteResponse, editedNote: Partial<Record<string, string>> = {}): string {
  const get = (key: keyof GenerateNoteResponse) =>
    editedNote[key as string] ?? (note[key] as string);
  const lines: string[] = [
    'SUBJECTIVE',
    get('subjective'),
    '',
    'OBJECTIVE',
    get('objective'),
    '',
    'ASSESSMENT',
    get('assessment'),
    '',
    'PLAN',
    get('plan'),
  ];
  return lines.join('\n');
}

export function GeneratedNote({ note }: GeneratedNoteProps) {
  const [editingSections, setEditingSections] = useState<Record<string, string>>({});
  const [editedNote, setEditedNote] = useState<Partial<Record<string, string>>>({});

  function handleStartEdit(sectionKey: string, content: string) {
    setEditingSections((prev) => ({ ...prev, [sectionKey]: content }));
  }

  function handleEditChange(sectionKey: string, newContent: string) {
    setEditingSections((prev) => ({ ...prev, [sectionKey]: newContent }));
  }

  function handleSaveEdit(sectionKey: string) {
    const editedContent = editingSections[sectionKey];
    if (editedContent !== undefined) {
      setEditedNote((prev) => ({ ...prev, [sectionKey]: editedContent }));
    }
    setEditingSections((prev) => {
      const next = { ...prev };
      delete next[sectionKey];
      return next;
    });
  }

  function handleCancelEdit(sectionKey: string) {
    setEditingSections((prev) => {
      const next = { ...prev };
      delete next[sectionKey];
      return next;
    });
  }

  function getDisplayContent(sectionKey: string, original: string): string {
    return editedNote[sectionKey] ?? original;
  }

  const hasSuggestions =
    (note.alerts && note.alerts.length > 0) ||
    (note.uncertainAreas && note.uncertainAreas.length > 0) ||
    !!note.billing ||
    !!note.goals;

  const [generatedDate] = useState(() => new Date().toLocaleDateString());

  const sections: Array<{ key: string; title: string; value: string }> = [
    { key: 'subjective', title: 'Subjective', value: note.subjective },
    { key: 'objective', title: 'Objective', value: note.objective },
    { key: 'assessment', title: 'Assessment', value: note.assessment },
    { key: 'plan', title: 'Plan', value: note.plan },
  ];

  return (
    <div className="mt-8">
      {/* Action bar: h2 + Copy All */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-fn-lg font-semibold text-fn-text-primary">
          Generated SOAP Note
        </h2>
        <FullCopyButton
          text={buildFullNoteText(note, { ...editedNote, ...editingSections })}
          label="Copy full SOAP note"
        />
      </div>

      {/* Metadata bar */}
      <div className="flex items-center gap-3 text-fn-sm text-fn-text-secondary flex-wrap mb-4">
        <span>{generatedDate}</span>
        {note.metadata.duration !== undefined && (
          <>
            <span aria-hidden="true">|</span>
            <span>{note.metadata.duration} min</span>
          </>
        )}
        {note.metadata.modality !== undefined && (
          <>
            <span aria-hidden="true">|</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-fn-2xs font-medium bg-fn-bg-secondary border border-fn-border text-fn-text-secondary">
              {note.metadata.modality === 'in_person' ? 'In Person' : 'Telehealth'}
            </span>
          </>
        )}
        <span aria-hidden="true">|</span>
        <span>{(note.metadata.generationTimeMs / 1000).toFixed(1)}s</span>
      </div>

      {/* SOAP sections + suggestions panel */}
      <div className="flex gap-6">
        {/* Left column: SOAP sections */}
        <div className="flex-1 min-w-0">
          {sections.map(({ key, title, value }) => {
            const displayContent = getDisplayContent(key, value);
            return (
              <NoteSection
                key={key}
                title={title}
                content={displayContent}
                isEditing={editingSections[key] !== undefined}
                editValue={editingSections[key]}
                onStartEdit={() => handleStartEdit(key, displayContent)}
                onEditChange={(val) => handleEditChange(key, val)}
                onSave={() => handleSaveEdit(key)}
                onCancelEdit={() => handleCancelEdit(key)}
              />
            );
          })}

          <RatingWidget />
        </div>

        {/* Right column: suggestions panel (xl+ only) */}
        {hasSuggestions && (
          <aside
            className="hidden xl:block w-[300px] flex-shrink-0 space-y-4"
            aria-label="AI suggestions"
          >
            {note.alerts && note.alerts.length > 0 && (
              <div className="card p-4">
                <h3 className="text-fn-sm font-semibold text-fn-text-primary uppercase tracking-wide mb-2">
                  Alerts
                </h3>
                <ul className="space-y-1.5">
                  {note.alerts.map((alert, i) => (
                    <li key={i} className="flex items-start gap-2 text-fn-sm text-fn-text-secondary">
                      <span className="mt-0.5 text-fn-warning" aria-hidden="true">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </span>
                      {alert}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Security note: uncertainAreas contains LLM-generated interpretive hints (not raw PHI).
                Displayed only to the same authenticated clinician who submitted the input,
                scoped to this session, transmitted over TLS, and cleared on logout per Rule 4. */}
            {note.uncertainAreas && note.uncertainAreas.length > 0 && (
              <div className="card p-4">
                <h3 className="text-fn-sm font-semibold text-fn-text-primary uppercase tracking-wide mb-2">
                  Review These Interpretations
                </h3>
                <ul className="space-y-1.5">
                  {note.uncertainAreas.map((area, i) => (
                    <li key={i} className="text-fn-sm text-fn-text-secondary flex items-start gap-2">
                      <span className="mt-0.5 text-fn-text-secondary" aria-hidden="true">•</span>
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {note.billing && <BillingSection billing={note.billing} />}
            {note.goals && <GoalsSection goals={note.goals} />}
          </aside>
        )}
      </div>

      {/* On < xl: suggestions below SOAP sections */}
      {hasSuggestions && (
        <div className="xl:hidden space-y-4 mt-4">
          {note.alerts && note.alerts.length > 0 && (
            <div className="card p-4">
              <h3 className="text-fn-sm font-semibold text-fn-text-primary uppercase tracking-wide mb-2">
                Alerts
              </h3>
              <ul className="space-y-1.5">
                {note.alerts.map((alert, i) => (
                  <li key={i} className="flex items-start gap-2 text-fn-sm text-fn-text-secondary">
                    <span className="mt-0.5 text-fn-warning" aria-hidden="true">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </span>
                    {alert}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Security note: same as above */}
          {note.uncertainAreas && note.uncertainAreas.length > 0 && (
            <div className="card p-4">
              <h3 className="text-fn-sm font-semibold text-fn-text-primary uppercase tracking-wide mb-2">
                Review These Interpretations
              </h3>
              <ul className="space-y-1.5">
                {note.uncertainAreas.map((area, i) => (
                  <li key={i} className="text-fn-sm text-fn-text-secondary flex items-start gap-2">
                    <span className="mt-0.5 text-fn-text-secondary" aria-hidden="true">•</span>
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {note.billing && <BillingSection billing={note.billing} />}
          {note.goals && <GoalsSection goals={note.goals} />}
        </div>
      )}

      <p className="text-fn-2xs text-fn-text-secondary mt-4 border-t border-fn-border pt-4">
        Generated in {(note.metadata.generationTimeMs / 1000).toFixed(1)}s
      </p>
    </div>
  );
}
