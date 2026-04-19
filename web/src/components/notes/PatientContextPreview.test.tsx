import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PatientContextPreview } from './PatientContextPreview';
import type { Patient } from '@/lib/types';

function patient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    userId: 'user-1',
    organizationId: null,
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: null,
    pronoun: null,
    phone: null,
    email: null,
    context: 'Chronic L knee pain. Hx L TKA 2024.',
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('PatientContextPreview', () => {
  it('renders empty-state when no patient selected', () => {
    render(<PatientContextPreview patient={null} />);
    expect(screen.getByText(/Select a patient/i)).toBeInTheDocument();
  });

  it('renders patient name and context when patient provided', () => {
    render(<PatientContextPreview patient={patient()} />);
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Chronic L knee pain/)).toBeInTheDocument();
  });

  it('renders "No context recorded yet" when patient has no context', () => {
    render(<PatientContextPreview patient={patient({ context: null })} />);
    expect(screen.getByText(/No context recorded yet/i)).toBeInTheDocument();
  });

  it('renders "Edit in patient detail" link to patient detail page', () => {
    render(<PatientContextPreview patient={patient()} />);
    const link = screen.getByRole('link', { name: /Edit in patient detail/i });
    expect(link).toHaveAttribute('href', '/dashboard/patients/11111111-1111-1111-1111-111111111111');
  });

  it('uses <aside> with descriptive aria-label for landmark navigation (Rule 14)', () => {
    render(<PatientContextPreview patient={patient()} />);
    const aside = screen.getByRole('complementary', { name: /Patient context/i });
    expect(aside).toBeInTheDocument();
  });
});
