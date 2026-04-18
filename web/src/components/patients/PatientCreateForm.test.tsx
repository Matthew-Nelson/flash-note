import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const h = vi.hoisted(() => ({
  createPatientAction: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/actions/patients', () => ({
  createPatientAction: h.createPatientAction,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push, refresh: vi.fn(), replace: vi.fn() }),
}));

import { PatientCreateForm } from './PatientCreateForm';

describe('PatientCreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders labelled inputs for all fields', () => {
    render(<PatientCreateForm />);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pronoun/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/patient context/i)).toBeInTheDocument();
  });

  it('displays validation errors when required fields are empty', async () => {
    const user = userEvent.setup();
    render(<PatientCreateForm />);
    await user.click(screen.getByRole('button', { name: /save patient/i }));
    // Client-side validation catches empty firstName/lastName — Server Action not called.
    expect(h.createPatientAction).not.toHaveBeenCalled();
    expect(
      screen.getByText(/please check the highlighted fields/i),
    ).toBeInTheDocument();
  });

  it('client-side rejects invalid email', async () => {
    const user = userEvent.setup();
    render(<PatientCreateForm />);
    await user.type(screen.getByLabelText(/first name/i), 'Jane');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /save patient/i }));
    expect(h.createPatientAction).not.toHaveBeenCalled();
  });

  it('submits to Server Action and redirects on success', async () => {
    const user = userEvent.setup();
    h.createPatientAction.mockResolvedValueOnce({
      success: true,
      data: { id: 'abc-123' },
    });
    render(<PatientCreateForm />);
    await user.type(screen.getByLabelText(/first name/i), 'Jane');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.click(screen.getByRole('button', { name: /save patient/i }));
    await waitFor(() => {
      expect(h.createPatientAction).toHaveBeenCalled();
    });
    expect(h.push).toHaveBeenCalledWith('/dashboard/patients/abc-123');
  });

  it('displays curated error via mapPatientError on server failure', async () => {
    const user = userEvent.setup();
    h.createPatientAction.mockResolvedValueOnce({
      success: false,
      error: 'rate_limit_exceeded',
    });
    render(<PatientCreateForm />);
    await user.type(screen.getByLabelText(/first name/i), 'Jane');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.click(screen.getByRole('button', { name: /save patient/i }));
    await waitFor(() => {
      expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
    });
  });

  it('NEVER displays raw err.message (Rule 2): unknown code falls back to generic copy', async () => {
    const user = userEvent.setup();
    h.createPatientAction.mockResolvedValueOnce({
      success: false,
      error: 'totally_unmapped_code',
    });
    render(<PatientCreateForm />);
    await user.type(screen.getByLabelText(/first name/i), 'Jane');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.click(screen.getByRole('button', { name: /save patient/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/something went wrong\. please try again\./i),
      ).toBeInTheDocument();
    });
  });

  it('error region uses aria-live="assertive"', () => {
    const { container } = render(<PatientCreateForm />);
    const live = container.querySelector('[aria-live="assertive"]');
    expect(live).not.toBeNull();
  });

  it('Cancel link navigates to /dashboard/patients', () => {
    render(<PatientCreateForm />);
    const cancel = screen.getByRole('link', { name: /cancel/i });
    expect(cancel).toHaveAttribute('href', '/dashboard/patients');
  });

  it('submits all optional fields when filled (dateOfBirth / pronoun / phone / email / context)', async () => {
    const user = userEvent.setup();
    h.createPatientAction.mockResolvedValueOnce({
      success: true,
      data: { id: 'id-2' },
    });
    render(<PatientCreateForm />);
    await user.type(screen.getByLabelText(/first name/i), 'Jane');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/date of birth/i), '1980-01-15');
    await user.selectOptions(screen.getByLabelText(/pronoun/i), 'she/her');
    await user.type(screen.getByLabelText(/phone/i), '555-0100');
    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.type(
      screen.getByLabelText(/patient context/i),
      'Chronic knee pain',
    );
    await user.click(screen.getByRole('button', { name: /save patient/i }));
    await waitFor(() => {
      expect(h.createPatientAction).toHaveBeenCalled();
    });
    const fd = h.createPatientAction.mock.calls[0]?.[0] as FormData;
    expect(fd.get('firstName')).toBe('Jane');
    expect(fd.get('lastName')).toBe('Doe');
    expect(fd.get('dateOfBirth')).toBe('1980-01-15');
    expect(fd.get('pronoun')).toBe('she/her');
    expect(fd.get('phone')).toBe('555-0100');
    expect(fd.get('email')).toBe('jane@example.com');
    expect(fd.get('context')).toBe('Chronic knee pain');
  });

  it('server-side validation_error with fieldErrors surfaces in UI', async () => {
    const user = userEvent.setup();
    h.createPatientAction.mockResolvedValueOnce({
      success: false,
      error: 'validation_error',
      fieldErrors: { firstName: ['Validation failed'] },
    });
    render(<PatientCreateForm />);
    await user.type(screen.getByLabelText(/first name/i), 'X');
    await user.type(screen.getByLabelText(/last name/i), 'Y');
    await user.click(screen.getByRole('button', { name: /save patient/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/please check the highlighted fields/i),
      ).toBeInTheDocument();
    });
  });
});
