import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const h = vi.hoisted(() => ({
  archivePatientAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/actions/patients', () => ({
  archivePatientAction: h.archivePatientAction,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: h.refresh, replace: vi.fn() }),
}));

import { PatientRow } from './PatientRow';
import { createMockPatient } from '@/test/factories/patient-factory';

function rowWrap(children: React.ReactNode): React.ReactElement {
  return (
    <table>
      <tbody>{children}</tbody>
    </table>
  );
}

describe('PatientRow', () => {
  it('renders patient name as a link to their detail page', () => {
    const patient = createMockPatient({
      id: 'pid-1',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    render(rowWrap(<PatientRow patient={patient} />));
    const link = screen.getByRole('link', { name: /jane doe/i });
    expect(link).toHaveAttribute('href', '/dashboard/patients/pid-1');
  });

  it('archive button has accessible name including full patient name (Rule 11)', () => {
    const patient = createMockPatient({
      firstName: 'Jane',
      lastName: 'Doe',
    });
    render(rowWrap(<PatientRow patient={patient} />));
    expect(
      screen.getByRole('button', { name: /archive patient jane doe/i }),
    ).toBeInTheDocument();
  });

  it('archive button exposes 44px touch targets', () => {
    const patient = createMockPatient();
    render(rowWrap(<PatientRow patient={patient} />));
    const btn = screen.getByRole('button', { name: /archive patient/i });
    expect(btn.className).toContain('min-h-[44px]');
    expect(btn.className).toContain('min-w-[44px]');
  });

  it('clicking archive opens ConfirmDialog with UI-SPEC copy', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({
      firstName: 'Jane',
      lastName: 'Doe',
    });
    render(rowWrap(<PatientRow patient={patient} />));
    await user.click(
      screen.getByRole('button', { name: /archive patient jane doe/i }),
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/archive jane doe\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/will be hidden from your active patient list/i),
    ).toBeInTheDocument();
    // Buttons use UI-SPEC "Keep patient" / "Archive patient" labels
    expect(
      screen.getByRole('button', { name: 'Keep patient' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Archive patient' }),
    ).toBeInTheDocument();
  });

  it('confirming archive fires archivePatientAction and refreshes', async () => {
    const user = userEvent.setup();
    h.archivePatientAction.mockResolvedValueOnce({ success: true });
    const patient = createMockPatient({ id: 'pid-1' });
    render(rowWrap(<PatientRow patient={patient} />));
    await user.click(
      screen.getByRole('button', { name: /archive patient/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Archive patient' }));
    await waitFor(() => {
      expect(h.archivePatientAction).toHaveBeenCalledWith('pid-1');
      expect(h.refresh).toHaveBeenCalled();
    });
  });

  it('displays curated error when archive fails', async () => {
    const user = userEvent.setup();
    h.archivePatientAction.mockResolvedValueOnce({
      success: false,
      error: 'archive_failed',
    });
    const patient = createMockPatient();
    render(rowWrap(<PatientRow patient={patient} />));
    await user.click(
      screen.getByRole('button', { name: /archive patient/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Archive patient' }));
    await waitFor(() => {
      // Text appears in both the sr-only aria-live region and the visible alert.
      expect(
        screen.getAllByText("We couldn't archive this patient. Please try again.").length,
      ).toBeGreaterThan(0);
    });
    expect(h.refresh).not.toHaveBeenCalled();
  });

  // Year is locale- and timezone-stable for these inputs; the full day is not.
  it('renders DOB from Date object', () => {
    const patient = createMockPatient({
      dateOfBirth: new Date('1980-01-15T00:00:00Z'),
    });
    render(rowWrap(<PatientRow patient={patient} />));
    expect(screen.getByRole('row')).toHaveTextContent('1980');
  });

  it('renders DOB from string value', () => {
    const patient = createMockPatient({
      dateOfBirth: '1990-06-20' as unknown as Date,
    });
    render(rowWrap(<PatientRow patient={patient} />));
    expect(screen.getByRole('row')).toHaveTextContent('1990');
  });

  it('renders em dash for invalid DOB', () => {
    const patient = createMockPatient({
      dateOfBirth: 'not-a-date' as unknown as Date,
    });
    render(rowWrap(<PatientRow patient={patient} />));
    // Column order: name, DOB, pronoun, added, actions.
    expect(screen.getAllByRole('cell')[1].textContent).toBe('—');
  });

  it('renders em dash for null DOB', () => {
    const patient = createMockPatient({ dateOfBirth: null });
    render(rowWrap(<PatientRow patient={patient} />));
    expect(screen.getAllByRole('cell')[1].textContent).toBe('—');
  });

  it('Cancel ("Keep patient") closes the dialog without calling the action', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient();
    render(rowWrap(<PatientRow patient={patient} />));
    await user.click(
      screen.getByRole('button', { name: /archive patient/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Keep patient' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(h.archivePatientAction).not.toHaveBeenCalled();
  });
});
