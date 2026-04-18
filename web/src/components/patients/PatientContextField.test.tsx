import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const h = vi.hoisted(() => ({
  updatePatientContextAction: vi.fn(),
}));

vi.mock('@/actions/patients', () => ({
  updatePatientContextAction: h.updatePatientContextAction,
}));

import { PatientContextField } from './PatientContextField';
import { createMockPatient } from '@/test/factories/patient-factory';

describe('PatientContextField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders textarea with existing context', () => {
    const patient = createMockPatient({ context: 'Chronic knee pain' });
    render(<PatientContextField patient={patient} />);
    const textarea = screen.getByLabelText<HTMLTextAreaElement>(
      /patient context/i,
    );
    expect(textarea.value).toBe('Chronic knee pain');
  });

  it('Save button is hidden until the textarea is dirty', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'original' });
    render(<PatientContextField patient={patient} />);
    expect(
      screen.queryByRole('button', { name: /save context/i }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/patient context/i), ' edited');
    expect(
      screen.getByRole('button', { name: /save context/i }),
    ).toBeInTheDocument();
  });

  it('Save invokes updatePatientContextAction with the new value', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'original', id: 'pid-1' });
    h.updatePatientContextAction.mockResolvedValueOnce({
      success: true,
      data: { patient: { ...patient, context: 'original edited' } },
    });
    render(<PatientContextField patient={patient} />);
    await user.type(screen.getByLabelText(/patient context/i), ' edited');
    await user.click(screen.getByRole('button', { name: /save context/i }));
    await waitFor(() => {
      expect(h.updatePatientContextAction).toHaveBeenCalledWith(
        'pid-1',
        'original edited',
      );
    });
  });

  it('passes null when user clears the textarea', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'hello', id: 'pid-2' });
    h.updatePatientContextAction.mockResolvedValueOnce({
      success: true,
      data: { patient: { ...patient, context: null } },
    });
    render(<PatientContextField patient={patient} />);
    await user.clear(screen.getByLabelText(/patient context/i));
    await user.click(screen.getByRole('button', { name: /save context/i }));
    await waitFor(() => {
      expect(h.updatePatientContextAction).toHaveBeenCalledWith(
        'pid-2',
        null,
      );
    });
  });

  it('announces "Context saved." via aria-live on success', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'hello', id: 'pid-1' });
    h.updatePatientContextAction.mockResolvedValueOnce({
      success: true,
      data: { patient },
    });
    const { container } = render(<PatientContextField patient={patient} />);
    await user.type(screen.getByLabelText(/patient context/i), '!');
    await user.click(screen.getByRole('button', { name: /save context/i }));
    await waitFor(() => {
      const live = container.querySelector('[aria-live="polite"]');
      expect(live?.textContent).toBe('Context saved.');
    });
  });

  it('displays curated error when Server Action fails', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'hello', id: 'pid-1' });
    h.updatePatientContextAction.mockResolvedValueOnce({
      success: false,
      error: 'context_save_failed',
    });
    render(<PatientContextField patient={patient} />);
    await user.type(screen.getByLabelText(/patient context/i), '!');
    await user.click(screen.getByRole('button', { name: /save context/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/we couldn't save the patient context/i),
      ).toBeInTheDocument();
    });
  });

  it('aria-live region exists unconditionally (Rule 13)', () => {
    const patient = createMockPatient();
    const { container } = render(<PatientContextField patient={patient} />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('Discard button reverts the textarea to last saved value', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'original', id: 'pid-3' });
    render(<PatientContextField patient={patient} />);
    const textarea = screen.getByLabelText<HTMLTextAreaElement>(
      /patient context/i,
    );
    await user.type(textarea, ' edited');
    expect(textarea.value).toBe('original edited');
    await user.click(screen.getByRole('button', { name: /discard/i }));
    expect(textarea.value).toBe('original');
    // Save button hidden again
    expect(
      screen.queryByRole('button', { name: /save context/i }),
    ).not.toBeInTheDocument();
  });

  it('character counter updates as user types', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: '' });
    render(<PatientContextField patient={patient} />);
    await user.type(screen.getByLabelText(/patient context/i), 'abcde');
    expect(screen.getByText('5 / 2000')).toBeInTheDocument();
  });
});
