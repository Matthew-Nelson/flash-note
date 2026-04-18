import { Card, CardContent } from '@/components/ui';
import type { Patient } from '@/lib/types';

interface PatientNotesTableProps {
  patient: Patient;
  /**
   * Notes to display. Plan 04-02 always passes an empty array — the real notes
   * list arrives in Plan 04-03 when findClinicalNotesByScope is wired in.
   */
  notes: readonly unknown[];
}

/**
 * Notes list for a single patient — placeholder Server Component.
 *
 * Plan 04-02 ships the empty-state copy per 04-UI-SPEC §Empty states. Plan 04-03
 * will replace the body with a real table driven by `findClinicalNotesByScope`
 * and add a "Generate note" CTA wired to /dashboard/notes/new?patientId=…
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
  // Plan 04-03 replaces this branch with a real notes table.
  return (
    <Card>
      <CardContent>
        <p className="text-fn-base text-fn-text-secondary">
          {notes.length} notes — table UI ships in Plan 04-03.
        </p>
      </CardContent>
    </Card>
  );
}
