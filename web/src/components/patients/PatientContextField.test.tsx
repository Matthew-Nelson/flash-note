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

describe('PatientContextField (view/edit toggle)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // View mode
  // -------------------------------------------------------------------------

  it('renders the saved context as read-only text in view mode', () => {
    const patient = createMockPatient({ context: 'Chronic knee pain' });
    render(<PatientContextField patient={patient} />);
    expect(screen.getByText('Chronic knee pain')).toBeInTheDocument();
    // No textarea in view mode
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows an italic placeholder when no context has been saved', () => {
    const patient = createMockPatient({ context: null });
    render(<PatientContextField patient={patient} />);
    expect(screen.getByText(/no context saved yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders an "Edit" button in view mode with an accessible name (Rule 11)', () => {
    const patient = createMockPatient({ context: null });
    render(<PatientContextField patient={patient} />);
    expect(
      screen.getByRole('button', { name: /edit patient context/i }),
    ).toBeInTheDocument();
  });

  it('Edit button is NOT rendered while in edit mode', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'hello' });
    render(<PatientContextField patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit patient context/i }));
    expect(
      screen.queryByRole('button', { name: /edit patient context/i }),
    ).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Edit mode
  // -------------------------------------------------------------------------

  it('clicking Edit enters edit mode with textarea, Save, and Cancel', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'original' });
    render(<PatientContextField patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit patient context/i }));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe('original');
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('Save invokes updatePatientContextAction with the new value', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'original', id: 'pid-1' });
    h.updatePatientContextAction.mockResolvedValueOnce({
      success: true,
      data: { patient: { ...patient, context: 'original edited' } },
    });
    render(<PatientContextField patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit patient context/i }));
    await user.type(screen.getByRole('textbox'), ' edited');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      expect(h.updatePatientContextAction).toHaveBeenCalledWith(
        'pid-1',
        'original edited',
      );
    });
  });

  it('Save exits edit mode and renders the new value in view mode', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'original', id: 'pid-5' });
    h.updatePatientContextAction.mockResolvedValueOnce({
      success: true,
      data: { patient: { ...patient, context: 'original edited' } },
    });
    render(<PatientContextField patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit patient context/i }));
    await user.type(screen.getByRole('textbox'), ' edited');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      // Edit button is back → we are in view mode again
      expect(
        screen.getByRole('button', { name: /edit patient context/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('original edited')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('passes null when user clears the textarea and saves', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'hello', id: 'pid-2' });
    h.updatePatientContextAction.mockResolvedValueOnce({
      success: true,
      data: { patient: { ...patient, context: null } },
    });
    render(<PatientContextField patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit patient context/i }));
    await user.clear(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      expect(h.updatePatientContextAction).toHaveBeenCalledWith(
        'pid-2',
        null,
      );
    });
  });

  it('Cancel reverts unsaved changes and exits edit mode', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'original', id: 'pid-3' });
    render(<PatientContextField patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit patient context/i }));
    await user.type(screen.getByRole('textbox'), ' edited');
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    // Back in view mode showing the ORIGINAL value
    expect(
      screen.getByRole('button', { name: /edit patient context/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('original')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(h.updatePatientContextAction).not.toHaveBeenCalled();
  });

  it('re-entering edit after a Cancel shows the original saved value (not the discarded edit)', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'original', id: 'pid-6' });
    render(<PatientContextField patient={patient} />);
    // First edit attempt — type, cancel
    await user.click(screen.getByRole('button', { name: /edit patient context/i }));
    await user.type(screen.getByRole('textbox'), ' discarded');
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    // Re-enter edit mode — textarea should show the pristine "original"
    await user.click(screen.getByRole('button', { name: /edit patient context/i }));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('original');
  });

  // -------------------------------------------------------------------------
  // Accessibility + announcements
  // -------------------------------------------------------------------------

  it('announces "Context saved." via aria-live on save success', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'hello', id: 'pid-1' });
    h.updatePatientContextAction.mockResolvedValueOnce({
      success: true,
      data: { patient },
    });
    const { container } = render(<PatientContextField patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit patient context/i }));
    await user.type(screen.getByRole('textbox'), '!');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      const live = container.querySelector('[aria-live="polite"]');
      expect(live?.textContent).toBe('Context saved.');
    });
  });

  it('aria-live region exists unconditionally in both view and edit modes (Rule 13)', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'hi' });
    const { container } = render(<PatientContextField patient={patient} />);
    // Present in view mode
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
    // Still present in edit mode
    await user.click(screen.getByRole('button', { name: /edit patient context/i }));
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Error mapping
  // -------------------------------------------------------------------------

  it('displays curated error when Server Action fails (stays in edit mode)', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: 'hello', id: 'pid-1' });
    h.updatePatientContextAction.mockResolvedValueOnce({
      success: false,
      error: 'context_save_failed',
    });
    render(<PatientContextField patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit patient context/i }));
    await user.type(screen.getByRole('textbox'), '!');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/we couldn't save the patient context/i),
      ).toBeInTheDocument();
    });
    // Still in edit mode — textarea is still visible.
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Counter + limit
  // -------------------------------------------------------------------------

  it('character counter updates as user types in edit mode', async () => {
    const user = userEvent.setup();
    const patient = createMockPatient({ context: '' });
    render(<PatientContextField patient={patient} />);
    await user.click(screen.getByRole('button', { name: /edit patient context/i }));
    await user.type(screen.getByRole('textbox'), 'abcde');
    expect(screen.getByText('5 / 2000')).toBeInTheDocument();
  });
});
