import Link from 'next/link';

import { Card, CardContent } from '@/components/ui';
import type { ClinicalNoteWithPatient, Patient } from '@/lib/types';

interface PatientNotesTableProps {
  patient: Patient;
  /** Notes to display. Chronological newest-first from findClinicalNotesByScope. */
  notes: readonly ClinicalNoteWithPatient[];
}

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

/**
 * PatientNotesTable (Plan 04-03) — real notes list for a single patient.
 *
 * Server Component consumed by /dashboard/patients/[id]. Replaces the
 * 04-02 stub. Empty state copy per 04-UI-SPEC §Empty states.
 */
export function PatientNotesTable({
  patient: _patient,
  notes,
}: PatientNotesTableProps): React.ReactElement {
  if (notes.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="py-12 text-center">
            <h3 className="text-fn-base font-semibold text-fn-text-primary">
              No notes for this patient yet
            </h3>
            <p className="mt-1 text-fn-base text-fn-text-secondary">
              Generate a new note to start building this patient&apos;s clinical history.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full">
          <caption className="sr-only">Notes for this patient</caption>
          <thead>
            <tr className="border-b border-fn-border">
              <th scope="col" className="px-4 py-2 text-left text-fn-sm font-semibold text-fn-text-secondary">
                Date
              </th>
              <th scope="col" className="px-4 py-2 text-left text-fn-sm font-semibold text-fn-text-secondary">
                Type
              </th>
              <th scope="col" className="px-4 py-2 text-left text-fn-sm font-semibold text-fn-text-secondary">
                Modality
              </th>
              <th scope="col" className="px-4 py-2 text-left text-fn-sm font-semibold text-fn-text-secondary">
                Duration
              </th>
              <th scope="col" className="px-4 py-2 text-left text-fn-sm font-semibold text-fn-text-secondary">
                Preview
              </th>
            </tr>
          </thead>
          <tbody>
            {notes.map((note) => (
              <tr key={note.id} className="border-b border-fn-border last:border-b-0">
                <td className="px-4 py-3 align-top text-fn-sm text-fn-text-primary">
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
                <td className="px-4 py-3 align-top text-fn-sm text-fn-text-primary capitalize">
                  {note.modality?.replace('_', ' ') ?? '—'}
                </td>
                <td className="px-4 py-3 align-top text-fn-sm text-fn-text-primary">
                  {note.durationMinutes ? `${note.durationMinutes} min` : '—'}
                </td>
                <td className="px-4 py-3 align-top text-fn-sm text-fn-text-secondary max-w-[300px]">
                  <span className="line-clamp-2">
                    {firstSectionPreview(note.content)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
