import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PatientNotesTable } from './PatientNotesTable';
import { createMockPatient } from '@/test/factories/patient-factory';
import type { ClinicalNoteWithPatient } from '@/lib/types';

function note(overrides: Partial<ClinicalNoteWithPatient> = {}): ClinicalNoteWithPatient {
  return {
    id: '55555555-5555-5555-5555-555555555555',
    userId: 'user-1',
    organizationId: null,
    patientId: 'patient-1',
    templateId: '00000000-0000-0000-0000-000000000001',
    noteType: 'daily_note',
    content: [
      {
        sectionId: '00000000-0000-0000-0000-000000000011',
        title: 'Subjective',
        content: 'Patient reports L knee pain 5/10.',
      },
    ],
    quickNotes: '',
    patientContext: null,
    modality: 'in_person',
    durationMinutes: 45,
    generationTimeMs: 1000,
    archivedAt: null,
    createdAt: new Date('2026-04-18T00:00:00.000Z'),
    updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    patientFirstName: 'Jane',
    patientLastName: 'Doe',
    ...overrides,
  };
}

describe('PatientNotesTable', () => {
  it('renders empty-state copy when notes is empty', () => {
    const patient = createMockPatient();
    render(<PatientNotesTable patient={patient} notes={[]} />);
    expect(
      screen.getByRole('heading', { name: /no notes for this patient yet/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/generate a new note to start building/i),
    ).toBeInTheDocument();
  });

  it('renders a table row per note (Plan 04-03)', () => {
    const patient = createMockPatient();
    render(
      <PatientNotesTable
        patient={patient}
        notes={[note({ id: 'n1' }), note({ id: 'n2' })]}
      />,
    );
    // Two data rows + 1 header row
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('renders the note date as a link to /dashboard/notes/[id]', () => {
    const patient = createMockPatient();
    render(<PatientNotesTable patient={patient} notes={[note()]} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/dashboard/notes/55555555-5555-5555-5555-555555555555');
  });

  it('renders note_type label', () => {
    const patient = createMockPatient();
    render(
      <PatientNotesTable
        patient={patient}
        notes={[note({ noteType: 'initial_eval' })]}
      />,
    );
    expect(screen.getByText('Initial Eval')).toBeInTheDocument();
  });

  it('renders modality with underscores replaced', () => {
    const patient = createMockPatient();
    render(
      <PatientNotesTable
        patient={patient}
        notes={[note({ modality: 'in_person' })]}
      />,
    );
    expect(screen.getByText(/in person/i)).toBeInTheDocument();
  });

  it('renders duration with min suffix', () => {
    const patient = createMockPatient();
    render(<PatientNotesTable patient={patient} notes={[note({ durationMinutes: 60 })]} />);
    expect(screen.getByText('60 min')).toBeInTheDocument();
  });

  it('renders em dash for missing modality or duration', () => {
    const patient = createMockPatient();
    render(
      <PatientNotesTable
        patient={patient}
        notes={[note({ modality: null, durationMinutes: null })]}
      />,
    );
    // Multiple em dashes — we expect at least two
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders first section preview (truncated at 100 chars)', () => {
    const patient = createMockPatient();
    const longContent = 'A'.repeat(150);
    render(
      <PatientNotesTable
        patient={patient}
        notes={[
          note({
            content: [
              {
                sectionId: 'x',
                title: 'Subjective',
                content: longContent,
              },
            ],
          }),
        ]}
      />,
    );
    // Truncated to 97 chars + ellipsis
    const preview = screen.getByText(/AAAAA/);
    expect(preview.textContent.length).toBeLessThanOrEqual(101);
    expect(preview.textContent).toMatch(/…$/);
  });
});
