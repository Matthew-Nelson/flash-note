import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoteStylePreferencesSection } from './NoteStylePreferencesSection';
import type { NoteTemplateSection } from '@/lib/types';

const mockAction = vi.hoisted(() => vi.fn<(fd: FormData) => Promise<unknown>>());
vi.mock('@/actions/templates', () => ({
  updateSectionStyleAction: mockAction,
}));

function section(overrides: Partial<NoteTemplateSection> = {}): NoteTemplateSection {
  return {
    id: '00000000-0000-0000-0000-000000000011',
    templateId: '00000000-0000-0000-0000-000000000001',
    title: 'Subjective',
    sortOrder: 1,
    verbosity: 'concise',
    styling: 'paragraph',
    promptInstructions: 'Subjective content…',
    includeInCopyAll: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('NoteStylePreferencesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a section block per template section', () => {
    render(
      <NoteStylePreferencesSection
        sections={[
          section({ id: 's1', title: 'Subjective' }),
          section({ id: 's2', title: 'Objective' }),
        ]}
      />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Subjective' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Objective' })).toBeInTheDocument();
  });

  it('renders Verbosity radio group with current value checked', () => {
    render(
      <NoteStylePreferencesSection sections={[section({ verbosity: 'detailed' })]} />,
    );
    const detailed = screen.getByLabelText(/detailed/i);
    expect(detailed).toBeChecked();
  });

  it('renders Formatting radio group with current value checked', () => {
    render(
      <NoteStylePreferencesSection sections={[section({ styling: 'bullets' })]} />,
    );
    const bullets = screen.getByLabelText(/bullets/i);
    expect(bullets).toBeChecked();
  });

  it('dispatches updateSectionStyleAction on verbosity change', async () => {
    mockAction.mockResolvedValue({ success: true, data: { preference: {} } });
    const user = userEvent.setup();
    render(
      <NoteStylePreferencesSection
        sections={[section({ id: 's1', verbosity: 'concise' })]}
      />,
    );
    await user.click(screen.getByLabelText(/detailed/i));
    await waitFor(() => expect(mockAction).toHaveBeenCalled());
    const fd = mockAction.mock.calls[0][0];
    expect(fd.get('sectionId')).toBe('s1');
    expect(fd.get('verbosity')).toBe('detailed');
  });

  it('reverts optimistic local state when action returns an error (Rule 2)', async () => {
    mockAction.mockResolvedValue({
      success: false,
      error: 'style_prefs_save_failed',
    });
    const user = userEvent.setup();
    render(
      <NoteStylePreferencesSection
        sections={[section({ id: 's1', verbosity: 'concise' })]}
      />,
    );
    const detailed = screen.getByLabelText(/detailed/i);
    await user.click(detailed);
    await waitFor(() =>
      expect(screen.getByText(/couldn't save your style preferences/i)).toBeInTheDocument(),
    );
    const concise = screen.getByLabelText(/concise/i);
    expect(concise).toBeChecked();
  });

  it('announces save confirmation via sr-only aria-live region', async () => {
    mockAction.mockResolvedValue({ success: true, data: { preference: {} } });
    const user = userEvent.setup();
    const { container } = render(
      <NoteStylePreferencesSection sections={[section({ id: 's1' })]} />,
    );
    await user.click(screen.getByLabelText(/detailed/i));
    await waitFor(() => {
      const live = container.querySelector('[aria-live="polite"]');
      expect(live?.textContent).toBe('Preferences saved.');
    });
  });
});
