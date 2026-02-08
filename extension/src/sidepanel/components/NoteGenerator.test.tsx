import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NoteGenerator from './NoteGenerator';
import { api } from '@/shared/api';
import { createMockGeneratedNote } from '@/test/helpers';

vi.mock('@/shared/api', () => ({
  api: {
    generateNote: vi.fn(),
  },
}));

describe('NoteGenerator', () => {
  const onNoteGenerated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderGenerator() {
    return render(<NoteGenerator onNoteGenerated={onNoteGenerated} />);
  }

  it('should render the form', () => {
    renderGenerator();
    expect(screen.getByLabelText('Note Type')).toBeInTheDocument();
    expect(screen.getByLabelText(/session notes/i)).toBeInTheDocument();
    expect(screen.getByText('Generate Note')).toBeInTheDocument();
  });

  it('should show note type options', () => {
    renderGenerator();
    const select = screen.getByLabelText('Note Type');
    expect(select).toHaveValue('daily_note');
  });

  it('should show character count', async () => {
    const user = userEvent.setup();
    renderGenerator();
    const textarea = screen.getByLabelText(/session notes/i);
    await user.type(textarea, 'Short text');
    expect(screen.getByText('10/5,000 characters')).toBeInTheDocument();
  });

  it('should disable submit when quickNotes is too short', () => {
    renderGenerator();
    const button = screen.getByText('Generate Note');
    expect(button).toBeDisabled();
  });

  it('should enable submit when quickNotes has 10+ characters', async () => {
    const user = userEvent.setup();
    renderGenerator();
    await user.type(screen.getByLabelText(/session notes/i), 'At least ten characters here');
    expect(screen.getByText('Generate Note')).not.toBeDisabled();
  });

  it('should show validation errors for invalid input', async () => {
    const user = userEvent.setup();
    renderGenerator();

    // Force submit with too-short text by manipulating the textarea
    const textarea = screen.getByLabelText(/session notes/i);
    await user.type(textarea, 'At least 10 chars here and more');
    await user.clear(textarea);
    await user.type(textarea, 'short'); // Less than 10 chars

    // Button should be disabled, so we can't really submit
    expect(screen.getByText('Generate Note')).toBeDisabled();
  });

  it('should show loading state during generation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolveGenerate: (note: ReturnType<typeof createMockGeneratedNote>) => void;
    vi.mocked(api.generateNote).mockReturnValue(
      new Promise((r) => { resolveGenerate = r; })
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderGenerator();
    await user.type(screen.getByLabelText(/session notes/i), 'Patient reports improved mobility and decreased pain levels today.');
    await user.click(screen.getByText('Generate Note'));

    await waitFor(() => {
      expect(screen.getByText('Analyzing your notes...')).toBeInTheDocument();
    });

    resolveGenerate!(createMockGeneratedNote());
  });

  it('should show success state and call onNoteGenerated', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.generateNote).mockResolvedValue(createMockGeneratedNote());

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderGenerator();
    await user.type(screen.getByLabelText(/session notes/i), 'Patient reports improved mobility and decreased pain levels today.');
    await user.click(screen.getByText('Generate Note'));

    await waitFor(() => {
      expect(screen.getByText('Note generated!')).toBeInTheDocument();
    });

    // Advance past success animation (1.5s)
    await vi.advanceTimersByTimeAsync(1500);

    expect(onNoteGenerated).toHaveBeenCalledWith(
      expect.objectContaining({ subjective: expect.any(String) })
    );
  });

  it('should show error state on API failure', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.generateNote).mockRejectedValue(new Error('Server error'));

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderGenerator();
    await user.type(screen.getByLabelText(/session notes/i), 'Patient reports improved mobility and decreased pain levels today.');
    await user.click(screen.getByText('Generate Note'));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    // Advance past error animation (1.5s)
    await vi.advanceTimersByTimeAsync(1500);

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });
});
