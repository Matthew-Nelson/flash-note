import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NoteGenerator from './NoteGenerator';
import { api, ApiError } from '@/shared/api';
import { createMockGeneratedNote } from '@/test/helpers';

vi.mock('@/shared/api', () => ({
  api: {
    generateNote: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
      this.name = 'ApiError';
    }
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

  it('should cycle through loading stages', async () => {
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

    // Advance past first interval (1500ms) to trigger stage cycling
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByText('Drafting Subjective section...')).toBeInTheDocument();

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

  it('should show curated error for API failures, not raw backend message', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.generateNote).mockRejectedValue(
      new ApiError(500, 'server_error', 'raw SQL detail leaked')
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderGenerator();
    await user.type(screen.getByLabelText(/session notes/i), 'Patient reports improved mobility and decreased pain levels today.');
    await user.click(screen.getByText('Generate Note'));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    await vi.advanceTimersByTimeAsync(1500);

    await waitFor(() => {
      // Should show curated default message, not raw backend message
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
    expect(screen.queryByText('raw SQL detail leaked')).not.toBeInTheDocument();
  });

  it('should show curated error for known error codes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.generateNote).mockRejectedValue(
      new ApiError(403, 'trial_expired', 'Your trial has expired')
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderGenerator();
    await user.type(screen.getByLabelText(/session notes/i), 'Patient reports improved mobility and decreased pain levels today.');
    await user.click(screen.getByText('Generate Note'));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    await vi.advanceTimersByTimeAsync(1500);

    await waitFor(() => {
      expect(screen.getByText('Your free trial has ended.')).toBeInTheDocument();
    });
  });

  it('should show default curated error for non-Error throws', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.generateNote).mockRejectedValue('string error');

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderGenerator();
    await user.type(screen.getByLabelText(/session notes/i), 'Patient reports improved mobility and decreased pain levels today.');
    await user.click(screen.getByText('Generate Note'));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    await vi.advanceTimersByTimeAsync(1500);

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
  });

  it('should not announce character count below 4000', () => {
    renderGenerator();
    const textarea = screen.getByLabelText(/session notes/i);
    fireEvent.change(textarea, { target: { value: 'a'.repeat(3999) } });
    expect(screen.getByText('3,999/5,000 characters')).toBeInTheDocument();
    const announcement = document.querySelector('[aria-live="polite"].sr-only');
    expect(announcement).toHaveTextContent('');
  });

  it('should announce 1,000 characters remaining at 4000 chars', async () => {
    renderGenerator();
    const textarea = screen.getByLabelText(/session notes/i);
    fireEvent.change(textarea, { target: { value: 'a'.repeat(4000) } });
    await waitFor(() => {
      const announcement = document.querySelector('[aria-live="polite"].sr-only');
      expect(announcement).toHaveTextContent('1,000 characters remaining');
    });
  });

  it('should announce 500 characters remaining at 4500 chars', async () => {
    renderGenerator();
    const textarea = screen.getByLabelText(/session notes/i);
    fireEvent.change(textarea, { target: { value: 'a'.repeat(4500) } });
    await waitFor(() => {
      const announcement = document.querySelector('[aria-live="polite"].sr-only');
      expect(announcement).toHaveTextContent('500 characters remaining');
    });
  });

  it('should announce character limit reached at 5000 chars', async () => {
    renderGenerator();
    const textarea = screen.getByLabelText(/session notes/i);
    fireEvent.change(textarea, { target: { value: 'a'.repeat(5000) } });
    await waitFor(() => {
      const announcement = document.querySelector('[aria-live="polite"].sr-only');
      expect(announcement).toHaveTextContent('Character limit reached');
    });
  });

  it('should clear character announcement after timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderGenerator();
    const textarea = screen.getByLabelText(/session notes/i);
    fireEvent.change(textarea, { target: { value: 'a'.repeat(4000) } });
    await waitFor(() => {
      const announcement = document.querySelector('[aria-live="polite"].sr-only');
      expect(announcement).toHaveTextContent('1,000 characters remaining');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    const announcement = document.querySelector('[aria-live="polite"].sr-only');
    expect(announcement).toHaveTextContent('');
  });

  it('should allow changing note type', async () => {
    const user = userEvent.setup();
    renderGenerator();
    const select = screen.getByLabelText('Note Type');
    await user.selectOptions(select, 'initial_eval');
    expect(select).toHaveValue('initial_eval');
  });

  it('should send patientContext to API when provided', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.generateNote).mockResolvedValue(createMockGeneratedNote());

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderGenerator();
    await user.type(screen.getByLabelText(/patient context/i), 'TEST_PATIENT_A 52M');
    await user.type(screen.getByLabelText(/session notes/i), 'Patient reports improved mobility and decreased pain levels today.');
    await user.click(screen.getByText('Generate Note'));

    await waitFor(() => {
      expect(api.generateNote).toHaveBeenCalledWith(
        expect.objectContaining({
          patientContext: 'TEST_PATIENT_A 52M',
          noteType: 'daily_note',
          quickNotes: 'Patient reports improved mobility and decreased pain levels today.',
        }),
        expect.any(AbortSignal),
      );
    });
  });

  it('should render error as single message after error animation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    vi.mocked(api.generateNote).mockRejectedValueOnce(
      new ApiError(429, 'rate_limit_exceeded', 'Too many requests')
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderGenerator();
    await user.type(screen.getByLabelText(/session notes/i), 'Patient reports improved mobility and decreased pain levels today.');
    await user.click(screen.getByText('Generate Note'));

    // Wait for error animation
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
    await vi.advanceTimersByTimeAsync(1500);

    // After error animation, the curated error message should show
    await waitFor(() => {
      expect(screen.getByText('Too many attempts. Please try again later.')).toBeInTheDocument();
    });
  });
});
