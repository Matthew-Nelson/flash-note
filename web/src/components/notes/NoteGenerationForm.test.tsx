import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoteGenerationForm, NOTE_ERROR_MESSAGES } from './NoteGenerationForm';

// Mock generateNoteAction — use vi.hoisted for correct hoisting
const mockGenerateNoteAction = vi.hoisted(() =>
  vi.fn<(formData: FormData) => Promise<unknown>>(),
);
const mockSaveNoteAction = vi.hoisted(() =>
  vi.fn<(formData: FormData) => Promise<unknown>>(),
);
vi.mock('@/actions/notes', () => ({
  generateNoteAction: mockGenerateNoteAction,
  saveNoteAction: mockSaveNoteAction,
}));

const mockPush = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/dashboard/notes/new',
}));

// Mock GeneratedNote child component — it has its own test file
vi.mock('./GeneratedNote', () => ({
  GeneratedNote: ({
    note,
    onSave,
    isSaving,
  }: {
    note: { content: Array<{ sectionId: string; title: string; content: string }> };
    onSave: (content: Array<{ sectionId: string; title: string; content: string }>) => void;
    isSaving: boolean;
  }) => (
    <div data-testid="generated-note">
      {note.content[0]?.content}
      <button type="button" disabled={isSaving} onClick={() => onSave(note.content)}>
        Save note
      </button>
    </div>
  ),
}));

const SOAP_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001';

function soapContent(subjective = 'Patient reports pain 5/10.') {
  return [
    { sectionId: '00000000-0000-0000-0000-000000000011', title: 'Subjective', content: subjective },
    { sectionId: '00000000-0000-0000-0000-000000000012', title: 'Objective', content: 'ROM flexion 95 degrees.' },
    { sectionId: '00000000-0000-0000-0000-000000000013', title: 'Assessment', content: 'Progressing toward goals.' },
    { sectionId: '00000000-0000-0000-0000-000000000014', title: 'Plan', content: 'Continue 2x/week.' },
  ];
}

function buildSuccessResponse(subjective?: string) {
  return {
    success: true as const,
    data: {
      templateId: SOAP_TEMPLATE_ID,
      content: soapContent(subjective),
      metadata: { generationTimeMs: 1000 },
    },
  };
}

describe('NoteGenerationForm', () => {
  it('renders noteType select with all four options', () => {
    render(<NoteGenerationForm />);

    const select = screen.getByRole('combobox', { name: /Note Type/i });
    expect(select).toBeInTheDocument();

    expect(screen.getByRole('option', { name: 'Daily Note' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Initial Eval' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Progress Note' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Discharge' })).toBeInTheDocument();
  });

  it('renders Session Notes textarea with clinical placeholder text', () => {
    render(<NoteGenerationForm />);

    const textarea = screen.getByRole('textbox', { name: /Session Notes/i });
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('placeholder', expect.stringContaining('Pt reports'));
    expect(textarea).toHaveAttribute('aria-required', 'true');
  });

  it('renders Additional Context input (optional, no aria-required)', () => {
    render(<NoteGenerationForm />);

    const input = screen.getByRole('textbox', { name: /Additional Context/i });
    expect(input).toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-required');
    expect(input).not.toHaveAttribute('required');
  });

  it('submits correct formData to generateNoteAction on form submit', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Pt knee pain 5/10');
    await user.type(screen.getByRole('textbox', { name: /Additional Context/i }), '68yo female');

    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

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

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

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

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

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

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generating/ })).toBeDisabled();
    });

    expect(screen.getByText(/this may take up to 30 seconds/)).toBeInTheDocument();

    resolveAction(buildSuccessResponse());
  });

  it('a regenerated note replaces the discarded one (stale note prevention)', async () => {
    mockGenerateNoteAction.mockResolvedValueOnce(buildSuccessResponse('First note.'));
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'First notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));
    expect(await screen.findByTestId('generated-note')).toHaveTextContent('First note.');

    await user.click(screen.getByRole('button', { name: 'Discard and edit session notes' }));
    let resolveSecond!: (v: unknown) => void;
    mockGenerateNoteAction.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSecond = resolve;
      })
    );
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    // While the second generation is pending, the first note stays gone
    expect(screen.queryByTestId('generated-note')).not.toBeInTheDocument();

    await act(async () => {
      resolveSecond(buildSuccessResponse('Second note.'));
      await Promise.resolve();
    });
    expect(await screen.findByTestId('generated-note')).toHaveTextContent('Second note.');
  });

  it('clears errorCode on new submission', async () => {
    mockGenerateNoteAction
      .mockResolvedValueOnce({ success: false, error: 'ai_error' })
      .mockResolvedValue(buildSuccessResponse());

    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Wait for button to exit loading state before clicking again
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Generate Professional Note' })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('patientContext is omitted from formData when empty', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    // Leave Additional Context empty
    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledOnce();
    });

    const formData = mockGenerateNoteAction.mock.calls[0][0];
    expect(formData.has('patientContext')).toBe(false);
  });

  it('displays field-level error message under Session Notes when action returns validation_error with fieldErrors', async () => {
    mockGenerateNoteAction.mockResolvedValue({
      success: false,
      error: 'validation_error',
      fieldErrors: {
        quickNotes: ['Quick notes must be at least 10 characters.'],
      },
    });
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'short');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(screen.getByText('Quick notes must be at least 10 characters.')).toBeInTheDocument();
    });
  });

  it('aria-describedby on Session Notes textarea is set when fieldErrors present, unset when absent', async () => {
    mockGenerateNoteAction.mockResolvedValue({
      success: false,
      error: 'validation_error',
      fieldErrors: { quickNotes: ['Too short.'] },
    });
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    const textarea = screen.getByRole('textbox', { name: /Session Notes/i });

    // Initially no describedby
    expect(textarea).not.toHaveAttribute('aria-describedby');

    await user.type(textarea, 'x');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(textarea).toHaveAttribute('aria-describedby', 'quickNotes-error');
    });
  });

  it('system error persists on Session Notes change; only field errors clear', async () => {
    mockGenerateNoteAction.mockResolvedValue({
      success: false,
      error: 'ai_error',
      fieldErrors: { quickNotes: ['Too short.'] },
    });
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Too short.')).toBeInTheDocument();
    });

    // Type in Session Notes field — system error persists, field error clears
    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), ' more text');

    await waitFor(() => {
      expect(screen.queryByText('Too short.')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows Alert for email_not_verified error code', async () => {
    mockGenerateNoteAction.mockResolvedValue({
      success: false,
      error: 'email_not_verified',
    });
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

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

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Eval notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledOnce();
    });

    const formData = mockGenerateNoteAction.mock.calls[0][0];
    expect(formData.get('noteType')).toBe('initial_eval');
  });

  it('clears all PHI state on flashnote:logout event (Rule 4)', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    // Fill in PHI and generate a note
    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some clinical notes');
    await user.type(screen.getByRole('textbox', { name: /Additional Context/i }), '68yo female');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(screen.getByTestId('generated-note')).toBeInTheDocument();
    });

    // Dispatch logout event
    window.dispatchEvent(new CustomEvent('flashnote:logout'));

    await waitFor(() => {
      expect(screen.queryByTestId('generated-note')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('textbox', { name: /Session Notes/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /Additional Context/i })).toHaveValue('');
  });

  it('discards a generation response that arrives after logout (Rule 4)', async () => {
    let resolveGeneration!: (value: ReturnType<typeof buildSuccessResponse>) => void;
    mockGenerateNoteAction.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveGeneration = resolve;
      })
    );
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some clinical notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));
    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledOnce();
    });

    // Logout while the LLM call is still in flight
    act(() => {
      window.dispatchEvent(new CustomEvent('flashnote:logout'));
    });
    expect(screen.getByRole('textbox', { name: /Session Notes/i })).toHaveValue('');

    await act(async () => {
      resolveGeneration(buildSuccessResponse());
      await Promise.resolve();
    });

    expect(screen.queryByTestId('generated-note')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Session Notes/i })).toHaveValue('');
  });

  it('discards an error response that arrives after logout', async () => {
    let resolveGeneration!: (value: { success: false; error: string }) => void;
    mockGenerateNoteAction.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveGeneration = resolve;
      })
    );
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some clinical notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));
    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledOnce();
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('flashnote:logout'));
    });
    await act(async () => {
      resolveGeneration({ success: false, error: 'llm_error' });
      await Promise.resolve();
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('only renders the response from the most recent submission', async () => {
    let resolveFirst!: (value: ReturnType<typeof buildSuccessResponse>) => void;
    mockGenerateNoteAction
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      )
      .mockResolvedValueOnce(buildSuccessResponse('Fresh note.'));
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some clinical notes');
    const submit = screen.getByRole('button', { name: 'Generate Professional Note' });
    await user.click(submit);
    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledTimes(1);
    });
    // Submit the form again (Enter) while the first request is pending
    act(() => {
      submit.closest('form')!.requestSubmit();
    });
    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByTestId('generated-note')).toHaveTextContent('Fresh note.');
    });

    // The stale first response must not overwrite the newer note
    await act(async () => {
      resolveFirst(buildSuccessResponse('Stale note.'));
      await Promise.resolve();
    });
    expect(screen.getByTestId('generated-note')).toHaveTextContent('Fresh note.');
  });

  it('trims quickNotes whitespace in FormData before submission', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), '  knee pain 5/10  ');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledOnce();
    });

    const formData = mockGenerateNoteAction.mock.calls[0][0];
    expect(formData.get('quickNotes')).toBe('knee pain 5/10');
  });

  it('shows fallback error message for unknown error codes', async () => {
    mockGenerateNoteAction.mockResolvedValue({
      success: false,
      error: 'completely_unknown_error_code',
    });
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    });
  });

  // --- New B-2 tests ---

  it('renders modality select with "In Person" and "Telehealth" options', () => {
    render(<NoteGenerationForm />);

    const select = screen.getByRole('combobox', { name: /Modality/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'In Person' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Telehealth' })).toBeInTheDocument();
  });

  it('renders duration input with placeholder "45 min"', () => {
    render(<NoteGenerationForm />);

    const input = screen.getByRole('spinbutton', { name: /Duration/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', '45 min');
  });

  it('renders session date as readonly', () => {
    render(<NoteGenerationForm />);

    const dateInput = screen.getByRole('textbox', { name: /Session Date/i });
    expect(dateInput).toBeInTheDocument();
    expect(dateInput).toHaveAttribute('readonly');
  });

  it('renders patient selector as readonly when no patient selected (Plan 04-03)', () => {
    render(<NoteGenerationForm />);

    const patientInput = screen.getByRole('textbox', { name: /Patient/i });
    expect(patientInput).toHaveAttribute('readonly');
    expect(patientInput).toHaveAttribute(
      'placeholder',
      'No patient selected — generation will not be linked to a patient record.',
    );
  });

  it('displays preselected patient name when selectedPatient prop provided (Plan 04-03)', () => {
    render(
      <NoteGenerationForm
        selectedPatient={{
          id: '11111111-1111-1111-1111-111111111111',
          userId: 'user-1',
          organizationId: null,
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: null,
          pronoun: null,
          phone: null,
          email: null,
          context: null,
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }}
      />,
    );

    const patientInput = screen.getByRole('textbox', { name: /Patient/i });
    expect(patientInput).toHaveValue('Jane Doe');
  });

  it('submits patientId when initialPatientId prop provided (Plan 04-03)', async () => {
    const { generateNoteAction: mock } = await import('@/actions/notes');
    const mockFn = vi.mocked(mock);
    mockFn.mockResolvedValue({
      success: true,
      data: {
        templateId: SOAP_TEMPLATE_ID,
        content: soapContent(),
        metadata: { generationTimeMs: 100 },
      },
    });
    const user = userEvent.setup();
    const PATIENT_ID = '11111111-1111-1111-1111-111111111111';

    render(<NoteGenerationForm initialPatientId={PATIENT_ID} />);
    const textarea = screen.getByLabelText(/Session Notes/i);
    await user.type(textarea, 'pt reports pain 5/10, ROM improving, strength gaining');
    const submit = screen.getByRole('button', { name: /Generate/i });
    await user.click(submit);

    const submitted = mockFn.mock.calls[0][0];
    expect(submitted.get('patientId')).toBe(PATIENT_ID);
  });

  it('renders context panel stub with "Select a patient to see context"', () => {
    render(<NoteGenerationForm />);

    // The aside is in the DOM even on small screens (hidden via CSS)
    expect(screen.getByText('Select a patient to see context')).toBeInTheDocument();
  });

  it('renders step indicator showing step 1 initially', () => {
    render(<NoteGenerationForm />);

    const nav = screen.getByRole('navigation', { name: /Form steps/i });
    expect(nav).toBeInTheDocument();

    // Step 1 has aria-current="step"
    const step1Circle = nav.querySelector('[aria-current="step"]');
    expect(step1Circle).toBeInTheDocument();
    expect(step1Circle).toHaveTextContent('1');
  });

  it('step indicator shows step 2 after successful generation', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(screen.getByTestId('generated-note')).toBeInTheDocument();
    });

    const nav = screen.getByRole('navigation', { name: /Form steps/i });
    const step2Circle = nav.querySelector('[aria-current="step"]');
    expect(step2Circle).toBeInTheDocument();
    expect(step2Circle).toHaveTextContent('2');
  });

  it('submits modality in formData', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    const modalitySelect = screen.getByRole('combobox', { name: /Modality/i });
    await user.selectOptions(modalitySelect, 'telehealth');

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledOnce();
    });

    const formData = mockGenerateNoteAction.mock.calls[0][0];
    expect(formData.get('modality')).toBe('telehealth');
  });

  it('submits duration in formData when provided', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    const durationInput = screen.getByRole('spinbutton', { name: /Duration/i });
    await user.type(durationInput, '45');

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledOnce();
    });

    const formData = mockGenerateNoteAction.mock.calls[0][0];
    expect(formData.get('duration')).toBe('45');
  });

  it('omits duration from formData when empty', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    // Leave duration empty
    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledOnce();
    });

    const formData = mockGenerateNoteAction.mock.calls[0][0];
    expect(formData.has('duration')).toBe(false);
  });

  it('shows word count instead of character count', () => {
    render(<NoteGenerationForm />);

    // Word count should be shown — "0 words" initially
    expect(screen.getByText('0 words')).toBeInTheDocument();
  });

  it('updates word count as user types', async () => {
    const user = userEvent.setup();
    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'hello world');

    expect(screen.getByText('2 words')).toBeInTheDocument();
  });

  it('clears modality and duration on flashnote:logout event', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    // Set modality to telehealth and enter a duration
    const modalitySelect = screen.getByRole('combobox', { name: /Modality/i });
    await user.selectOptions(modalitySelect, 'telehealth');

    const durationInput = screen.getByRole('spinbutton', { name: /Duration/i });
    await user.type(durationInput, '60');

    expect(modalitySelect).toHaveValue('telehealth');
    expect(durationInput).toHaveValue(60);

    // Dispatch logout event
    window.dispatchEvent(new CustomEvent('flashnote:logout'));

    await waitFor(() => {
      expect(modalitySelect).toHaveValue('in_person');
    });

    expect(durationInput).toHaveValue(null);
  });

  async function generate(
    user: ReturnType<typeof userEvent.setup>,
    notes = '  pt reports pain 5/10, ROM improving  ',
  ): Promise<void> {
    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), notes);
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));
    await waitFor(() => {
      expect(screen.getByTestId('generated-note')).toBeInTheDocument();
    });
  }

  it('replaces the form with the review view once a note is generated (BUG-UI-12)', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();
    render(<NoteGenerationForm />);

    await generate(user);

    expect(screen.queryByRole('textbox', { name: /Session Notes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate Professional Note' })).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: /Form steps/i });
    expect(nav.querySelector('[aria-current="step"]')).toHaveTextContent('2');
  });

  it('discarding the generated note returns to the form with the session notes kept', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();
    render(<NoteGenerationForm />);

    await generate(user, 'Some notes for the visit');
    await user.click(screen.getByRole('button', { name: 'Discard and edit session notes' }));

    expect(screen.queryByTestId('generated-note')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Session Notes/i })).toHaveValue('Some notes for the visit');
    const nav = screen.getByRole('navigation', { name: /Form steps/i });
    expect(nav.querySelector('[aria-current="step"]')).toHaveTextContent('1');
  });

  it('saves the reviewed note with its generation inputs, then opens it', async () => {
    const NOTE_ID = '55555555-5555-5555-5555-555555555555';
    const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    mockSaveNoteAction.mockResolvedValue({ success: true, data: { id: NOTE_ID } });
    const user = userEvent.setup();
    render(<NoteGenerationForm initialPatientId={PATIENT_ID} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /Note Type/i }), 'progress_note');
    await user.selectOptions(screen.getByRole('combobox', { name: /Modality/i }), 'telehealth');
    await user.type(screen.getByRole('spinbutton', { name: /Duration/i }), '45');
    await generate(user);
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/dashboard/notes/${NOTE_ID}`);
    });
    const fd = mockSaveNoteAction.mock.calls[0][0];
    expect(Object.fromEntries(fd)).toEqual({
      templateId: SOAP_TEMPLATE_ID,
      patientId: PATIENT_ID,
      noteType: 'progress_note',
      content: JSON.stringify(soapContent()),
      quickNotes: 'pt reports pain 5/10, ROM improving',
      modality: 'telehealth',
      durationMinutes: '45',
      generationTimeMs: '1000',
    });
  });

  it('omits patientId and durationMinutes from the save when there are none', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    mockSaveNoteAction.mockResolvedValue({ success: true, data: { id: 'n1' } });
    const user = userEvent.setup();
    render(<NoteGenerationForm />);

    await generate(user);
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() => {
      expect(mockSaveNoteAction).toHaveBeenCalled();
    });
    const fd = mockSaveNoteAction.mock.calls[0][0];
    expect(fd.has('patientId')).toBe(false);
    expect(fd.has('durationMinutes')).toBe(false);
  });

  it('shows a curated error and stays on the review when saving fails', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    mockSaveNoteAction.mockResolvedValue({ success: false, error: 'template_unavailable' });
    const user = userEvent.setup();
    render(<NoteGenerationForm />);

    await generate(user);
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    expect(
      await screen.findByText("The selected template isn't available. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByTestId('generated-note')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('announces the save to assistive technology while it is in flight', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    mockSaveNoteAction.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<NoteGenerationForm />);

    await generate(user);
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    expect(await screen.findByText('Saving note…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save note' })).toBeDisabled();
  });

  it('does not open the note if the user signed out while the save was in flight (Rule 4)', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    let resolveSave!: (v: unknown) => void;
    mockSaveNoteAction.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<NoteGenerationForm />);

    await generate(user);
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    act(() => {
      window.dispatchEvent(new CustomEvent('flashnote:logout'));
    });
    await act(async () => {
      resolveSave({ success: true, data: { id: 'n1' } });
      await Promise.resolve();
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByTestId('generated-note')).not.toBeInTheDocument();
  });

  it('renders "Additional Context" input that is functional', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    const input = screen.getByRole('textbox', { name: /Additional Context/i });
    await user.type(input, 'test context');
    expect(input).toHaveValue('test context');
  });

  it('submits patientContext in formData from "Additional Context" input', async () => {
    mockGenerateNoteAction.mockResolvedValue(buildSuccessResponse());
    const user = userEvent.setup();

    render(<NoteGenerationForm />);

    await user.type(screen.getByRole('textbox', { name: /Additional Context/i }), '68yo female');
    await user.type(screen.getByRole('textbox', { name: /Session Notes/i }), 'Some notes');
    await user.click(screen.getByRole('button', { name: 'Generate Professional Note' }));

    await waitFor(() => {
      expect(mockGenerateNoteAction).toHaveBeenCalledOnce();
    });

    const formData = mockGenerateNoteAction.mock.calls[0][0];
    // The field name in FormData is still "patientContext" — only the label changed
    expect(formData.get('patientContext')).toBe('68yo female');
  });
});
