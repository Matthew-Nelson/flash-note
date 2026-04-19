import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoteRow } from './NoteRow';
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
        content: 'Patient reports L knee pain.',
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

function renderInTable(rowElement: React.ReactElement) {
  return render(
    <table>
      <tbody>{rowElement}</tbody>
    </table>,
  );
}

describe('NoteRow', () => {
  it('renders date as link to note detail', () => {
    renderInTable(<NoteRow note={note()} />);
    const link = screen.getByRole('link', { name: /2026/ });
    expect(link).toHaveAttribute('href', '/dashboard/notes/55555555-5555-5555-5555-555555555555');
  });

  it('renders patient name as link to patient detail when note has patient', () => {
    renderInTable(<NoteRow note={note()} />);
    const patientLink = screen.getByRole('link', { name: 'Jane Doe' });
    expect(patientLink).toHaveAttribute('href', '/dashboard/patients/patient-1');
  });

  it('renders em dash when note has no patient', () => {
    renderInTable(
      <NoteRow
        note={note({
          patientId: null,
          patientFirstName: null,
          patientLastName: null,
        })}
      />,
    );
    expect(screen.queryByRole('link', { name: /Jane/i })).toBeNull();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders note type label', () => {
    renderInTable(<NoteRow note={note({ noteType: 'discharge' })} />);
    expect(screen.getByText('Discharge')).toBeInTheDocument();
  });

  it('renders modality with underscore replaced', () => {
    renderInTable(<NoteRow note={note({ modality: 'in_person' })} />);
    expect(screen.getByText(/in person/i)).toBeInTheDocument();
  });

  it('truncates long preview to ~100 chars with ellipsis', () => {
    const longContent = 'A'.repeat(150);
    renderInTable(
      <NoteRow
        note={note({
          content: [{ sectionId: 'x', title: 'S', content: longContent }],
        })}
      />,
    );
    const preview = screen.getByText(/AAAAA/);
    expect(preview.textContent.length).toBeLessThanOrEqual(101);
    expect(preview.textContent).toMatch(/…$/);
  });
});
