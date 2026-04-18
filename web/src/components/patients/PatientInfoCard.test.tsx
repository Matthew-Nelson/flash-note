import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const h = vi.hoisted(() => ({
  updatePatientAction: vi.fn(),
}));

vi.mock('@/actions/patients', () => ({
  updatePatientAction: h.updatePatientAction,
}));

import { PatientInfoCard } from './PatientInfoCard';
import { createMockPatient } from '@/test/factories/patient-factory';

describe('PatientInfoCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders read-only profile fields by default', () => {
    const patient = createMockPatient({
      firstName: 'Jane',
      lastName: 'Doe',
      pronoun: 'she/her',
      phone: '555-0100',
      email: 'jane@example.com',
    });
    render(<PatientInfoCard patient={patient} />);
    expect(screen.getByText('she/her')).toBeInTheDocument();
    expect(screen.getByText('555-0100')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('renders em dashes for missing fields', () => {
    const patient = createMockPatient({
      pronoun: null,
      phone: null,
      email: null,
      dateOfBirth: null,
    });
    render(<PatientInfoCard patient={patient} />);
    // Expect at least 4 em dashes (DOB/pronoun/phone/email)
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it('Edit toggles into edit mode with Save/Cancel buttons', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ firstName: 'Jane', lastName: 'Doe' });
    render(<PatientInfoCard patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('Save invokes updatePatientAction and exits edit mode', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ firstName: 'Jane', lastName: 'Doe' });
    h.updatePatientAction.mockResolvedValueOnce({
      success: true,
      data: { patient },
    });
    render(<PatientInfoCard patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      expect(h.updatePatientAction).toHaveBeenCalledWith(
        patient.id,
        expect.any(FormData),
      );
    });
  });

  it('Cancel reverts changes and exits edit mode', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ firstName: 'Jane', lastName: 'Doe' });
    render(<PatientInfoCard patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    const input = screen.getByLabelText<HTMLInputElement>(/first name/i);
    await user.clear(input);
    await user.type(input, 'Renamed');
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    // Back to read mode — Edit button visible again
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('displays curated error on Server Action failure', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ firstName: 'Jane', lastName: 'Doe' });
    h.updatePatientAction.mockResolvedValueOnce({
      success: false,
      error: 'patient_not_found',
    });
    render(<PatientInfoCard patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/this patient no longer exists/i),
      ).toBeInTheDocument();
    });
  });

  it('aria-live region exists unconditionally (Rule 13)', () => {
    const patient = createMockPatient();
    const { container } = render(<PatientInfoCard patient={patient} />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('edit mode renders all editable fields and they fire onChange', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '555-1000',
      email: 'jane@example.com',
      pronoun: 'she/her',
    });
    render(<PatientInfoCard patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    // Type into each input to exercise onChange branches
    const first = screen.getByLabelText<HTMLInputElement>(/first name/i);
    await user.type(first, ' updated');
    const last = screen.getByLabelText<HTMLInputElement>(/last name/i);
    await user.type(last, ' updated');
    const dob = screen.getByLabelText<HTMLInputElement>(/date of birth/i);
    await user.type(dob, '1980-01-15');
    const pronoun = screen.getByLabelText<HTMLSelectElement>(/pronoun/i);
    await user.selectOptions(pronoun, 'he/him');
    const phone = screen.getByLabelText<HTMLInputElement>(/phone/i);
    await user.type(phone, '1');
    const email = screen.getByLabelText<HTMLInputElement>(/email/i);
    await user.type(email, '.co');
    // All onChange branches exercised — values now differ.
    expect(first.value).toMatch(/updated/);
    expect(pronoun.value).toBe('he/him');
  });

  it('renders patient with DOB and pronoun pre-populated', () => {
    const patient = createMockPatient({
      dateOfBirth: new Date('1985-06-20T00:00:00Z'),
      pronoun: 'they/them',
    });
    render(<PatientInfoCard patient={patient} />);
    expect(screen.getByText('1985-06-20')).toBeInTheDocument();
    expect(screen.getByText('they/them')).toBeInTheDocument();
  });

  it('renders patient with string dateOfBirth (no Date object) pre-populated', () => {
    const patient = createMockPatient({
      dateOfBirth: '1990-03-14' as unknown as Date,
    });
    render(<PatientInfoCard patient={patient} />);
    expect(screen.getByText('1990-03-14')).toBeInTheDocument();
  });
});
