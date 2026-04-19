import Link from 'next/link';

import type { ClinicalNoteWithPatient } from '@/lib/types';

const NOTE_TYPE_LABELS: Record<string, string> = {
  daily_note: 'Daily Note',
  initial_eval: 'Initial Eval',
  progress_note: 'Progress Note',
  discharge: 'Discharge',
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function firstSectionPreview(content: ClinicalNoteWithPatient['content']): string {
  const first = content[0]?.content ?? '';
  if (first.length <= 100) return first;
  return `${first.slice(0, 97)}…`;
}

interface NoteRowProps {
  note: ClinicalNoteWithPatient;
}

/**
 * NoteRow — one row in the /dashboard/notes table.
 *
 * Date links to detail page. Patient column links to patient detail when the
 * note is linked. Preview shows the first 100 chars of section 0's content
 * (typically Subjective).
 */
export function NoteRow({ note }: NoteRowProps) {
  const patientName = note.patientFirstName
    ? `${note.patientFirstName} ${note.patientLastName ?? ''}`.trim()
    : null;

  return (
    <tr className="border-b border-fn-border last:border-b-0 hover:bg-fn-bg-secondary/50">
      <td className="px-4 py-3 align-top text-fn-sm">
        <Link
          href={`/dashboard/notes/${note.id}`}
          className="text-fn-primary-DEFAULT hover:underline"
        >
          {formatDate(note.createdAt)}
        </Link>
      </td>
      <td className="px-4 py-3 align-top text-fn-sm text-fn-text-primary">
        {NOTE_TYPE_LABELS[note.noteType] ?? note.noteType}
      </td>
      <td className="px-4 py-3 align-top text-fn-sm">
        {patientName && note.patientId ? (
          <Link
            href={`/dashboard/patients/${note.patientId}`}
            className="text-fn-primary-DEFAULT hover:underline"
          >
            {patientName}
          </Link>
        ) : (
          <span className="text-fn-text-secondary">—</span>
        )}
      </td>
      <td className="px-4 py-3 align-top text-fn-sm text-fn-text-primary capitalize">
        {note.modality?.replace('_', ' ') ?? '—'}
      </td>
      <td className="px-4 py-3 align-top text-fn-sm text-fn-text-secondary max-w-[300px]">
        <span className="line-clamp-2">{firstSectionPreview(note.content)}</span>
      </td>
    </tr>
  );
}
