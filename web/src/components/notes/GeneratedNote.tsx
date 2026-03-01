'use client';

import { useState } from 'react';
import type { GenerateNoteResponse } from '@/actions/notes';

type BillingData = NonNullable<GenerateNoteResponse['billing']>;
type BillingCharge = NonNullable<BillingData['charges']>[number];
type BillingSuggestedCode = NonNullable<BillingData['suggestedCodes']>[number];
type GoalsData = NonNullable<GenerateNoteResponse['goals']>;
type GoalItem = NonNullable<GoalsData['shortTerm']>[number];

interface GeneratedNoteProps {
  note: GenerateNoteResponse;
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

function CopyButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const [fallbackText, setFallbackText] = useState<string | null>(null);

  async function handleCopy() {
    const success = await writeToClipboard(text);
    if (success) {
      setCopied(true);
      setFallbackText(null);
      setTimeout(() => setCopied(false), 2000);
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
        className="inline-flex items-center gap-1 text-xs text-fn-text-secondary hover:text-fn-text-primary transition-colors px-2 py-1 rounded border border-transparent hover:border-fn-border"
      >
        {copied ? (
          <>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </>
        )}
      </button>
      {fallbackText !== null && (
        <div className="mt-2">
          <p className="text-xs text-fn-text-secondary mb-1">
            Clipboard unavailable — Select All to copy manually:
          </p>
          <textarea
            readOnly
            value={fallbackText}
            className="input-field w-full text-xs font-mono p-2 resize-none"
            rows={4}
            aria-label={`${label} — manual copy fallback`}
          />
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  content,
  copyLabel,
}: {
  title: string;
  content: string;
  copyLabel: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-fn-text-primary uppercase tracking-wide">
          {title}
        </h3>
        <CopyButton text={content} label={copyLabel} />
      </div>
      <p className="text-fn-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
        {content}
      </p>
    </div>
  );
}

function GoalStatusBadge({ status }: { status: GoalItem['status'] }) {
  const styles: Record<GoalItem['status'], string> = {
    not_started: 'bg-fn-surface text-fn-text-secondary',
    progressing: 'bg-blue-100 text-blue-800',
    met: 'bg-green-100 text-green-800',
    discontinued: 'bg-red-100 text-red-800',
  };
  const labels: Record<GoalItem['status'], string> = {
    not_started: 'Not Started',
    progressing: 'Progressing',
    met: 'Met',
    discontinued: 'Discontinued',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
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
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-fn-text-primary uppercase tracking-wide mb-3">
        Billing Reference
      </h3>

      {hasCharges && (
        <div className="mb-4">
          <p className="text-xs text-fn-text-secondary mb-2">Timed charges (explicit minutes provided):</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fn-border">
                  <th className="text-left py-1.5 pr-3 text-xs font-medium text-fn-text-secondary">CPT</th>
                  <th className="text-left py-1.5 pr-3 text-xs font-medium text-fn-text-secondary">Description</th>
                  <th className="text-right py-1.5 pr-3 text-xs font-medium text-fn-text-secondary">Min</th>
                  <th className="text-right py-1.5 text-xs font-medium text-fn-text-secondary">Units</th>
                </tr>
              </thead>
              <tbody>
                {billing.charges!.map((charge: BillingCharge, i: number) => (
                  <tr key={i} className="border-b border-fn-border/50">
                    <td className="py-1.5 pr-3 font-mono text-xs">{charge.cptCode}</td>
                    <td className="py-1.5 pr-3 text-fn-text-secondary text-xs">{charge.description}</td>
                    <td className="py-1.5 pr-3 text-right text-xs">{charge.minutes}</td>
                    <td className="py-1.5 text-right text-xs font-medium">{charge.units}</td>
                  </tr>
                ))}
              </tbody>
              {(billing.totalTimedMinutes !== undefined || billing.totalUnits !== undefined) && (
                <tfoot>
                  <tr>
                    <td colSpan={2} className="pt-1.5 text-xs text-fn-text-secondary">Total</td>
                    <td className="pt-1.5 text-right text-xs font-medium">
                      {billing.totalTimedMinutes ?? '—'}
                    </td>
                    <td className="pt-1.5 text-right text-xs font-medium">
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
          <p className="text-xs text-fn-text-secondary mb-2">Suggested codes (no times provided):</p>
          <div className="flex flex-wrap gap-2">
            {billing.suggestedCodes!.map((code: BillingSuggestedCode, i: number) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2 py-1 bg-fn-surface rounded text-xs border border-fn-border">
                <span className="font-mono font-medium">{code.cptCode}</span>
                <span className="text-fn-text-secondary">{code.description}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {hasModifiers && (
        <div>
          <p className="text-xs text-fn-text-secondary mb-1.5">Suggested modifiers:</p>
          <div className="flex flex-wrap gap-1.5">
            {billing.suggestedModifiers!.map((mod: string, i: number) => (
              <span key={i} className="font-mono text-xs px-2 py-0.5 bg-fn-surface rounded border border-fn-border">
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
              <span className="text-sm text-fn-text-secondary">{goal.description}</span>
              {goal.percentComplete !== undefined && (
                <span className="ml-2 text-xs text-fn-text-secondary">({goal.percentComplete}%)</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-fn-text-primary uppercase tracking-wide mb-3">
        Goals
      </h3>
      {hasShortTerm && (
        <div className="mb-4">
          <p className="text-xs font-medium text-fn-text-secondary mb-2">Short-Term:</p>
          {renderGoals(goals.shortTerm!)}
        </div>
      )}
      {hasLongTerm && (
        <div>
          <p className="text-xs font-medium text-fn-text-secondary mb-2">Long-Term:</p>
          {renderGoals(goals.longTerm!)}
        </div>
      )}
    </div>
  );
}

function buildFullNoteText(note: GenerateNoteResponse): string {
  const lines: string[] = [
    'SUBJECTIVE',
    note.subjective,
    '',
    'OBJECTIVE',
    note.objective,
    '',
    'ASSESSMENT',
    note.assessment,
    '',
    'PLAN',
    note.plan,
  ];
  return lines.join('\n');
}

export function GeneratedNote({ note }: GeneratedNoteProps) {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-fn-text-primary">Generated SOAP Note</h3>
        <CopyButton
          text={buildFullNoteText(note)}
          label="Copy full SOAP note"
        />
      </div>

      <Section title="Subjective" content={note.subjective} copyLabel="Copy Subjective section" />
      <Section title="Objective" content={note.objective} copyLabel="Copy Objective section" />
      <Section title="Assessment" content={note.assessment} copyLabel="Copy Assessment section" />
      <Section title="Plan" content={note.plan} copyLabel="Copy Plan section" />

      {note.billing && <BillingSection billing={note.billing} />}
      {note.goals && <GoalsSection goals={note.goals} />}

      {note.alerts && note.alerts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-fn-text-primary uppercase tracking-wide mb-2">
            Alerts
          </h3>
          <ul className="space-y-1.5">
            {note.alerts.map((alert, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-fn-text-secondary">
                <span className="mt-0.5 text-yellow-500" aria-hidden="true">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </span>
                {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {note.uncertainAreas && note.uncertainAreas.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-fn-text-primary uppercase tracking-wide mb-2">
            Review These Interpretations
          </h3>
          <ul className="space-y-1.5">
            {note.uncertainAreas.map((area, i) => (
              <li key={i} className="text-sm text-fn-text-secondary flex items-start gap-2">
                <span className="mt-0.5 text-fn-text-secondary" aria-hidden="true">•</span>
                {area}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-fn-text-secondary mt-4 border-t border-fn-border pt-4">
        Generated in {(note.metadata.generationTimeMs / 1000).toFixed(1)}s
      </p>
    </div>
  );
}
