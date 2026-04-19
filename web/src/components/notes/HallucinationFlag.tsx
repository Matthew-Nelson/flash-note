'use client';

import { Alert } from '@/components/ui';
import type { HallucinationIssue } from '@/server/services/note-generation/hallucination-detector';

interface HallucinationFlagProps {
  issues: HallucinationIssue[];
  className?: string;
}

const KIND_LABELS: Record<HallucinationIssue['kind'], string> = {
  rom_degrees: 'ROM measurement',
  mmt_grade: 'Strength grade',
  billing_minutes: 'Billing time',
  goal_percent: 'Goal percentage',
};

/**
 * HallucinationFlag — warning alert above the generated note sections when
 * the post-generation detector finds numeric values in the output that are
 * NOT present in the clinician's quickNotes (PROMPT-02).
 *
 * Flag-and-continue UX: this NEVER blocks generation. The clinician reviews
 * and either accepts or regenerates. Hidden entirely when issues is empty.
 *
 * Rule 11/13: aria-live="polite" so the flag is announced once; non-blocking
 * so it does not steal focus.
 */
export function HallucinationFlag({ issues, className = '' }: HallucinationFlagProps) {
  if (issues.length === 0) return null;

  // Group by section title for clearer read-aloud.
  const bySection = new Map<string, HallucinationIssue[]>();
  for (const issue of issues) {
    const list = bySection.get(issue.sectionTitle) ?? [];
    list.push(issue);
    bySection.set(issue.sectionTitle, list);
  }

  return (
    <div aria-live="polite" className={className}>
      <Alert variant="warning">
        <div>
          <p className="font-semibold mb-1">
            We flagged possible inaccuracies in the generated note. Please review carefully before saving.
          </p>
          <ul className="mt-2 space-y-1 text-fn-sm">
            {Array.from(bySection.entries()).map(([title, items]) => (
              <li key={title}>
                <strong>{title}:</strong>{' '}
                {items
                  .map((i) => `${KIND_LABELS[i.kind]} "${i.value}" not found in your quick notes`)
                  .join('; ')}
              </li>
            ))}
          </ul>
        </div>
      </Alert>
    </div>
  );
}
