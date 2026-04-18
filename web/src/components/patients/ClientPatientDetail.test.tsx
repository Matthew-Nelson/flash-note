import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const h = vi.hoisted(() => ({
  archivePatientAction: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  usePhiCleanup: vi.fn(),
}));

vi.mock('@/actions/patients', () => ({
  archivePatientAction: h.archivePatientAction,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push, refresh: h.refresh, replace: vi.fn() }),
}));

vi.mock('@/hooks/use-phi-cleanup', () => ({
  usePhiCleanup: h.usePhiCleanup,
}));

import { ClientPatientDetail } from './ClientPatientDetail';
import { createMockPatient } from '@/test/factories/patient-factory';

describe('ClientPatientDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wires usePhiCleanup with a cleanup ref (Rule 4)', () => {
    const patient = createMockPatient();
    render(
      <ClientPatientDetail patient={patient}>
        <p>child</p>
      </ClientPatientDetail>,
    );
    expect(h.usePhiCleanup).toHaveBeenCalledTimes(1);
    const [arg] = h.usePhiCleanup.mock.calls[0];
    expect(arg).toHaveProperty('current');
    expect(typeof arg.current).toBe('function');
  });

  it('renders children', () => {
    const patient = createMockPatient();
    render(
      <ClientPatientDetail patient={patient}>
        <p>hello child</p>
      </ClientPatientDetail>,
    );
    expect(screen.getByText('hello child')).toBeInTheDocument();
  });

  it('renders "Archive patient" secondary button in footer section', () => {
    const patient = createMockPatient();
    render(
      <ClientPatientDetail patient={patient}>
        <p>x</p>
      </ClientPatientDetail>,
    );
    expect(
      screen.getByRole('button', { name: 'Archive patient' }),
    ).toBeInTheDocument();
  });

  it('clicking Archive opens ConfirmDialog', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({
      firstName: 'Jane',
      lastName: 'Doe',
    });
    render(
      <ClientPatientDetail patient={patient}>
        <p>x</p>
      </ClientPatientDetail>,
    );
    await user.click(screen.getByRole('button', { name: 'Archive patient' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/archive jane doe\?/i)).toBeInTheDocument();
  });

  it('confirm fires archivePatientAction and navigates to /dashboard/patients', async () => {
    const user = userEvent.setup();
    h.archivePatientAction.mockResolvedValueOnce({ success: true });
    const patient = createMockPatient({ id: 'p-1' });
    render(
      <ClientPatientDetail patient={patient}>
        <p>x</p>
      </ClientPatientDetail>,
    );
    // Open the dialog via the footer button, then confirm inside dialog.
    await user.click(screen.getByRole('button', { name: 'Archive patient' }));
    const confirm = screen.getAllByRole('button', { name: 'Archive patient' })[1];
    await user.click(confirm);
    await waitFor(() => {
      expect(h.archivePatientAction).toHaveBeenCalledWith('p-1');
      expect(h.push).toHaveBeenCalledWith('/dashboard/patients');
      expect(h.refresh).toHaveBeenCalled();
    });
  });

  it('displays curated error inside dialog on failure', async () => {
    const user = userEvent.setup();
    h.archivePatientAction.mockResolvedValueOnce({
      success: false,
      error: 'archive_failed',
    });
    const patient = createMockPatient();
    render(
      <ClientPatientDetail patient={patient}>
        <p>x</p>
      </ClientPatientDetail>,
    );
    await user.click(screen.getByRole('button', { name: 'Archive patient' }));
    const confirm = screen.getAllByRole('button', { name: 'Archive patient' })[1];
    await user.click(confirm);
    await waitFor(() => {
      expect(
        screen.getAllByText(/we couldn't archive this patient/i).length,
      ).toBeGreaterThan(0);
    });
    expect(h.push).not.toHaveBeenCalled();
  });

  it('cleanupRef invokes setErrorCode(null) and setDialogOpen(false) when called', async () => {
    // Open the dialog + induce an error, then invoke cleanup ref — dialog closes
    // and error clears.
    const user = userEvent.setup();
    h.archivePatientAction.mockResolvedValueOnce({
      success: false,
      error: 'archive_failed',
    });
    const patient = createMockPatient();
    render(
      <ClientPatientDetail patient={patient}>
        <p>x</p>
      </ClientPatientDetail>,
    );
    // Open dialog and trigger archive → error
    await user.click(screen.getByRole('button', { name: 'Archive patient' }));
    const confirmBtn = screen.getAllByRole('button', { name: 'Archive patient' })[1];
    await user.click(confirmBtn);
    await waitFor(() => {
      expect(
        screen.getAllByText(/we couldn't archive this patient/i).length,
      ).toBeGreaterThan(0);
    });
    const [arg] = h.usePhiCleanup.mock.calls[0];
    // Invoke the registered cleanup — should close dialog + clear error.
    arg.current();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('Cancel closes the dialog without calling archive action', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient();
    render(
      <ClientPatientDetail patient={patient}>
        <p>x</p>
      </ClientPatientDetail>,
    );
    await user.click(screen.getByRole('button', { name: 'Archive patient' }));
    await user.click(screen.getByRole('button', { name: 'Keep patient' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(h.archivePatientAction).not.toHaveBeenCalled();
  });
});
