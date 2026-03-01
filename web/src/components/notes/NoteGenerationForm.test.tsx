import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoteGenerationForm, NOTE_ERROR_MESSAGES } from './NoteGenerationForm';

// Mock generateNoteAction — use vi.hoisted for correct hoisting
const mockGenerateNoteAction = vi.hoisted(() =>
  vi.fn<(formData: FormData) => Promise<unknown>>(),
);
vi.mock('@/actions/notes', () => ({
  generateNoteAction: mockGenerateNoteAction,
}));

// Mock GeneratedNote child component — it has its own test file
vi.mock('./GeneratedNote', () => ({
  GeneratedNote: ({ note }: { note: { subjective: string } }) => (
    <div data-testid="generated-note">{note.subjective}</div>
  ),
}));

function buildSuccessResponse(overrides = {}) {
  return {
    success: true as const,
    data: {
      subjective: 'Patient reports pain 5/10.',
      objective: 'ROM flexion 95 degrees.',
      assessment: 'Progressing toward goals.',
      plan: 'Continue 2x/week.',
      metadata: { generationTimeMs: 1000 },
      ...overrides,
    },
  };
}

describe('NoteGenerationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders noteType select with all four options', () => {
    render(<NoteGenerationForm />);

    const select = screen.getByRole('combobox', { name: /Note Type/i });
    expect(select).toBeInTheDocument();

    expect(screen.getByRole('option', { name: 'Daily Note' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Initial Eval' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Progress Note' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Discharge' })).toBeInTheDocument();
  });

  it('renders quickNotes textarea with clinical placeholder text', () => {
    render(<NoteGenerationForm />);

    const textarea = screen.getByRole('textbox', { name: /Quick Notes/i });
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('placeholder', expect.stringContaining('Pt reports'));
    expect(textarea).toHaveAttribute('aria-required', 'true');
  });

  it('renders patientContext input (optional, no aria-required)', () => {
    render(<NoteGenerationForm />);

    const input = screen.getByRole('textbox', { name: /Patient Context/i });
    expect(input).toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-required');
    expect(input).not.toHaveAttribute('required');
  });

  it('submits correct formData to generateNoteAction on form submit', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Quick Notes/i }), 'Pt knee pain 5/10');
    await user.type(screen.getByRole('textbox', { name: /Patient Context/i }), '68yo female');

    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledOnce();
    });

    const formData = mockGenerateNoteAction.mock.calls[0][0];
    expect(formData.get('noteType')).toBe('daily_note');
    expect(formData.get('quickNotes')).toBe('Pt knee pain 5/10');
    expect(formData.get('patientContext')).toBe('68yo female');
  });

  it('shows GeneratedNote when action returns success', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Quick Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(screen.getByTestId('generated-note')).toBeInTheDocument();
    });

    expect(screen.getByTestId('generated-note')).toHaveTextContent('Patient reports pain 5/10.');
  });

  it('shows Alert with error message when action returns a known error code', async () => {
    mockGenerateNoteAction.mockResolvedValue({
      success: false,
      error: 'rate_limit_exceeded',
    });
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Quick Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      NOTE_ERROR_MESSAGES['rate_limit_exceeded']
    );
  });

  it('shows loading state (pending) during submission — button is disabled', async () => {
    let resolveAction!: (v: unknown) => void;
    mockGenerateNoteAction.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      })
    );
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Quick Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generating/ })).toBeDisabled();
    });

    expect(screen.getByText(/this may take up to 30 seconds/)).toBeInTheDocument();

    resolveAction(buildSuccessResponse());
  });

  it('clears previous generatedNote on new submission (stale note prevention)', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Quick Notes/i }), 'First notes');
    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(screen.getByTestId('generated-note')).toBeInTheDocument();
    });

    // Submit again — note should clear during pending
    let resolveSecond!: (v: unknown) => void;
    mockGenerateNoteAction.mockReturnValue(
      new Promise((resolve) => {
        resolveSecond = resolve;
      })
    );

    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(screen.queryByTestId('generated-note')).not.toBeInTheDocument();
    });

    resolveSecond(buildSuccessResponse());
  });

  it('clears errorCode on new submission', async () => {
    mockGenerateNoteAction
      .mockResolvedValueOnce({ success: false, error: 'ai_error' })
      .mockResolvedValue(buildSuccessResponse());

    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Quick Notes/i }), 'Notes');
    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Submit again — error should clear
    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('patientContext is omitted from formData when empty', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    // Leave patientContext empty
    await user.type(screen.getByRole('textbox', { name: /Quick Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledOnce();
    });

    const formData = mockGenerateNoteAction.mock.calls[0][0];
    expect(formData.has('patientContext')).toBe(false);
  });

  it('displays field-level error message under quickNotes when action returns validation_error with fieldErrors', async () => {
    mockGenerateNoteAction.mockResolvedValue({
      success: false,
      error: 'validation_error',
      fieldErrors: {
        quickNotes: ['Quick notes must be at least 10 characters.'],
      },
    });
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Quick Notes/i }), 'short');
    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(screen.getByText('Quick notes must be at least 10 characters.')).toBeInTheDocument();
    });
  });

  it('aria-describedby on quickNotes textarea is set when fieldErrors present, unset when absent', async () => {
    mockGenerateNoteAction.mockResolvedValue({
      success: false,
      error: 'validation_error',
      fieldErrors: { quickNotes: ['Too short.'] },
    });
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    const textarea = screen.getByRole('textbox', { name: /Quick Notes/i });

    // Initially no describedby
    expect(textarea).not.toHaveAttribute('aria-describedby');

    await user.type(textarea, 'x');
    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(textarea).toHaveAttribute('aria-describedby', 'quickNotes-error');
    });
  });

  it('clears error when quickNotes field value changes (UI Rule 15)', async () => {
    mockGenerateNoteAction.mockResolvedValue({
      success: false,
      error: 'ai_error',
    });
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Quick Notes/i }), 'Notes');
    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Type in quickNotes field — error should clear
    await user.type(screen.getByRole('textbox', { name: /Quick Notes/i }), ' more text');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows Alert for email_not_verified error code', async () => {
    mockGenerateNoteAction.mockResolvedValue({
      success: false,
      error: 'email_not_verified',
    });
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Quick Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        NOTE_ERROR_MESSAGES['email_not_verified']
      );
    });
  });

  it('updates noteType state when select value changes', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    const select = screen.getByRole('combobox', { name: /Note Type/i });
    await user.selectOptions(select, 'initial_eval');

    await user.type(screen.getByRole('textbox', { name: /Quick Notes/i }), 'Eval notes');
    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledOnce();
    });

    const formData = mockGenerateNoteAction.mock.calls[0][0];
    expect(formData.get('noteType')).toBe('initial_eval');
  });

  it('shows fallback error message for unknown error codes', async () => {
    mockGenerateNoteAction.mockResolvedValue({
      success: false,
      error: 'completely_unknown_error_code',
    });
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Quick Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate SOAP Note' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    });
  });
});
