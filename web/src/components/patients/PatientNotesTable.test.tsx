import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PatientNotesTable } from './PatientNotesTable';
import { createMockPatient } from '@/test/factories/patient-factory';

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

  it('renders Plan 04-03 placeholder when notes is non-empty', () => {
    const patient = createMockPatient();
    render(
      <PatientNotesTable patient={patient} notes={[{ id: 'n1' }, { id: 'n2' }]} />,
    );
    expect(
      screen.getByText(/2 notes — table UI ships in Plan 04-03/i),
    ).toBeInTheDocument();
  });
});
