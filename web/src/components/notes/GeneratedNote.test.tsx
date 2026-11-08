import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GeneratedNote } from './GeneratedNote';
import type { GenerateNoteResponse } from '@/actions/notes';

const mockWriteText = vi.fn();

// userEvent.setup() replaces navigator.clipboard with its own stub, so a test
// that copies must attach this mock after calling setup().
function armClipboardMock() {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mockWriteText },
    writable: true,
    configurable: true,
  });
}

type NoteResponse = GenerateNoteResponse;

const noop = (): void => {};

function buildNote(overrides: Partial<NoteResponse> = {}): NoteResponse {
  return {
    templateId: '00000000-0000-0000-0000-000000000001',
    content: [
      { sectionId: '00000000-0000-0000-0000-000000000011', title: 'Subjective', content: 'Patient reports left knee pain 5/10.' },
      { sectionId: '00000000-0000-0000-0000-000000000012', title: 'Objective', content: 'ROM flexion 95 degrees. Manual therapy performed.' },
      { sectionId: '00000000-0000-0000-0000-000000000013', title: 'Assessment', content: 'Patient progressing toward goals.' },
      { sectionId: '00000000-0000-0000-0000-000000000014', title: 'Plan', content: 'Continue current plan of care 2x/week.' },
    ],
    metadata: { generationTimeMs: 1500 },
    ...overrides,
  };
}

describe('GeneratedNote', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all four SOAP sections', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    expect(screen.getByText('Subjective')).toBeInTheDocument();
    expect(screen.getByText('Objective')).toBeInTheDocument();
    expect(screen.getByText('Assessment')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();

    expect(screen.getByText('Patient reports left knee pain 5/10.')).toBeInTheDocument();
    expect(screen.getByText('ROM flexion 95 degrees. Manual therapy performed.')).toBeInTheDocument();
    expect(screen.getByText('Patient progressing toward goals.')).toBeInTheDocument();
    expect(screen.getByText('Continue current plan of care 2x/week.')).toBeInTheDocument();
  });

  it('renders SOAP sections as cards with teal accent border', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    // Each SOAP section is a <section> element with card + accent bar classes
    const sections = screen.getAllByRole('region');
    expect(sections).toHaveLength(4);
    sections.forEach((section) => {
      expect(section.className).toContain('border-l-[3px]');
      expect(section.className).toContain('border-fn-primary');
    });
  });

  it('renders action bar with h2 heading and copy all button', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const heading = screen.getByRole('heading', { level: 2, name: 'Generated SOAP Note' });
    expect(heading).toBeInTheDocument();

    const copyAllButton = screen.getByRole('button', { name: 'Copy full SOAP note' });
    expect(copyAllButton).toBeInTheDocument();
  });

  it('renders SOAP section titles as h3 (not h2)', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    // SOAP section headings must be h3 to maintain h1 > h2 > h3 hierarchy
    for (const title of ['Subjective', 'Objective', 'Assessment', 'Plan']) {
      expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 2, name: title })).not.toBeInTheDocument();
    }
  });

  it('renders metadata bar with generation time', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote({ metadata: { generationTimeMs: 1500 } })} />);

    // Generation time in the metadata bar (1500ms = 1.5s)
    expect(screen.getByText('1.5s')).toBeInTheDocument();
  });

  it('renders metadata bar with duration when provided', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote({ metadata: { generationTimeMs: 1500, duration: 45 } })} />);

    expect(screen.getByText('45 min')).toBeInTheDocument();
  });

  it('does not render duration in metadata bar when not provided', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote({ metadata: { generationTimeMs: 1500 } })} />);

    expect(screen.queryByText(/\d+ min/)).not.toBeInTheDocument();
  });

  it('renders metadata bar with modality badge when provided', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote({ metadata: { generationTimeMs: 1500, modality: 'telehealth' } })} />);

    expect(screen.getByText('Telehealth')).toBeInTheDocument();
  });

  it('renders suggestions panel on xl+ with uncertainAreas', () => {
    const note = buildNote({
      uncertainAreas: ["Interpreted 'ther ex' as therapeutic exercise."],
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    const aside = screen.getByRole('complementary', { name: 'AI suggestions' });
    expect(aside).toBeInTheDocument();
    expect(aside).toHaveClass('hidden', 'xl:block');
  });

  it('renders billing suggestions in suggestions panel', () => {
    const note = buildNote({
      billing: {
        suggestedCodes: [{ cptCode: '97110', description: 'Therapeutic Exercise' }],
      },
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    expect(screen.getAllByText('Billing Reference').length).toBeGreaterThan(0);
    expect(screen.getAllByText('97110').length).toBeGreaterThan(0);
  });

  it('renders rating widget with 5 star buttons', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const group = screen.getByRole('group', { name: 'Rate this note' });
    expect(group).toBeInTheDocument();

    const starButtons = screen.getAllByRole('button', { name: /Rate \d out of 5 stars/ });
    expect(starButtons).toHaveLength(5);
  });

  it('rating widget selects star on click', async () => {
    const user = userEvent.setup();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const star3 = screen.getByRole('button', { name: 'Rate 3 out of 5 stars' });
    await user.click(star3);

    // Stars 1-3 should be pressed, 4-5 should not
    expect(screen.getByRole('button', { name: 'Rate 1 out of 5 stars' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Rate 2 out of 5 stars' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Rate 3 out of 5 stars' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Rate 4 out of 5 stars' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Rate 5 out of 5 stars' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('rating widget star buttons have descriptive aria-labels', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: `Rate ${i} out of 5 stars` })).toBeInTheDocument();
    }
  });

  it('rating widget announces selection via aria-live', async () => {
    const user = userEvent.setup();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    await user.click(screen.getByRole('button', { name: 'Rate 4 out of 5 stars' }));

    const announcement = await screen.findByText('Rated 4 out of 5 stars');
    expect(announcement).toHaveAttribute('aria-live', 'polite');
  });

  it('section copy buttons have 44px touch target', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const copySubjective = screen.getByRole('button', { name: 'Copy Subjective section' });
    expect(copySubjective.className).toContain('min-w-[44px]');
    expect(copySubjective.className).toContain('min-h-[44px]');
  });

  it('section copy buttons are icon-only with aria-label', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    expect(copyButton).toHaveAttribute('aria-label', 'Copy Subjective section');
    // Should not have visible text (icon only)
    expect(copyButton.textContent?.trim()).toBe('');
  });

  it('copy icon swaps to checkmark on success without text change', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const user = userEvent.setup();
    armClipboardMock();

    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    // Button has no visible text before click
    expect(copyButton.textContent?.trim()).toBe('');

    await user.click(copyButton);

    await vi.waitFor(() => {
      // Still no text — just icon swap
      expect(copyButton.textContent?.trim()).toBe('');
      // Aria-live region announces success
      const liveRegion = copyButton.parentElement?.querySelector('[aria-live="polite"][aria-atomic="true"]');
      expect(liveRegion).toHaveTextContent('Copied to clipboard');
    });
  });

  it('edit button renders on each SOAP section', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    expect(screen.getByRole('button', { name: 'Edit Subjective section' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Objective section' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Assessment section' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Plan section' })).toBeInTheDocument();
  });

  it('renders billing section with suggestedCodes when present', () => {
    const note = buildNote({
      billing: {
        suggestedCodes: [
          { cptCode: '97110', description: 'Therapeutic Exercise' },
          { cptCode: '97140', description: 'Manual Therapy' },
        ],
      },
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    expect(screen.getAllByText('Billing Reference').length).toBeGreaterThan(0);
    expect(screen.getAllByText('97110').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Therapeutic Exercise').length).toBeGreaterThan(0);
  });

  it('does not render billing section when absent', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote({ billing: undefined })} />);

    expect(screen.queryByText('Billing Reference')).not.toBeInTheDocument();
  });

  it('does not render billing section when billing has no charges, suggestedCodes, or modifiers', () => {
    const note = buildNote({ billing: {} });
    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);
    expect(screen.queryByText('Billing Reference')).not.toBeInTheDocument();
  });

  it('renders billing charges table when charges are present', () => {
    const note = buildNote({
      billing: {
        charges: [
          { cptCode: '97110', description: 'Therapeutic Exercise', minutes: 15, units: 1 },
          { cptCode: '97140', description: 'Manual Therapy', minutes: 30, units: 2 },
        ],
        totalTimedMinutes: 45,
        totalUnits: 3,
      },
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    expect(screen.getAllByText('Timed charges (explicit minutes provided):', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('97110').length).toBeGreaterThan(0);
    expect(screen.getAllByText('97140').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Total').length).toBeGreaterThan(0);
    expect(screen.getAllByText('45').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('renders billing charges tfoot with em-dash when totalTimedMinutes and totalUnits are undefined', () => {
    const note = buildNote({
      billing: {
        charges: [
          { cptCode: '97110', description: 'Therapeutic Exercise', minutes: 15, units: 1 },
        ],
        totalTimedMinutes: undefined,
        totalUnits: undefined,
      },
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    // tfoot should NOT render when both are undefined
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
  });

  it('renders billing charges tfoot when only totalTimedMinutes is defined', () => {
    const note = buildNote({
      billing: {
        charges: [
          { cptCode: '97110', description: 'Therapeutic Exercise', minutes: 20, units: 1 },
        ],
        totalTimedMinutes: 20,
      },
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    expect(screen.getAllByText('Total').length).toBeGreaterThan(0);
    // '—' appears in both the xl:block aside and xl:hidden fallback; either is sufficient.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders billing charges tfoot when only totalUnits is defined', () => {
    const note = buildNote({
      billing: {
        charges: [
          { cptCode: '97110', description: 'Therapeutic Exercise', minutes: 20, units: 1 },
        ],
        totalUnits: 4,
      },
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    expect(screen.getAllByText('Total').length).toBeGreaterThan(0);
    // '—' and '4' each appear in both the xl:block aside and xl:hidden fallback.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
  });

  it('renders billing modifiers when present', () => {
    const note = buildNote({
      billing: {
        suggestedModifiers: ['GP', 'CO'],
      },
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    expect(screen.getAllByText('Billing Reference').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Suggested modifiers:', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('GP').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CO').length).toBeGreaterThan(0);
  });

  it('renders alerts list when present', () => {
    const note = buildNote({
      alerts: ['Medicare patient? Add GP modifier.', 'Check 8-minute rule for billing.'],
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    // Both the xl:block aside and xl:hidden fallback render; use getAllByText.
    expect(screen.getAllByText('Alerts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Medicare patient? Add GP modifier.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Check 8-minute rule for billing.').length).toBeGreaterThan(0);
  });

  it('does not render alerts section when alerts is absent', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote({ alerts: undefined })} />);
    expect(screen.queryByText('Alerts')).not.toBeInTheDocument();
  });

  it('does not render alerts section when alerts is empty array', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote({ alerts: [] })} />);
    expect(screen.queryByText('Alerts')).not.toBeInTheDocument();
  });

  it('renders uncertainAreas when present', () => {
    const note = buildNote({
      uncertainAreas: ["Interpreted 'ther ex' as therapeutic exercise."],
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    expect(screen.getAllByText('Review These Interpretations').length).toBeGreaterThan(0);
    expect(screen.getAllByText("Interpreted 'ther ex' as therapeutic exercise.").length).toBeGreaterThan(0);
  });

  it('does not render uncertainAreas section when absent', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote({ uncertainAreas: undefined })} />);
    expect(screen.queryByText('Review These Interpretations')).not.toBeInTheDocument();
  });

  it('does not render uncertainAreas section when empty array', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote({ uncertainAreas: [] })} />);
    expect(screen.queryByText('Review These Interpretations')).not.toBeInTheDocument();
  });

  it('renders goals section with short-term goals', () => {
    const note = buildNote({
      goals: {
        shortTerm: [
          { description: 'Improve ROM to 120 degrees', status: 'progressing' },
          { description: 'Reduce pain to 3/10', status: 'met' },
        ],
      },
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    // Goals render in both xl:block aside and xl:hidden fallback; use getAllByText throughout.
    expect(screen.getAllByText('Goals').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Short-Term:', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Improve ROM to 120 degrees').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reduce pain to 3/10').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Progressing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Met').length).toBeGreaterThan(0);
  });

  it('renders goals section with long-term goals', () => {
    const note = buildNote({
      goals: {
        longTerm: [
          { description: 'Return to full activity', status: 'not_started' },
        ],
      },
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    // Goals render in both xl:block aside and xl:hidden fallback; use getAllByText throughout.
    expect(screen.getAllByText('Goals').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Long-Term:', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Return to full activity').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not Started').length).toBeGreaterThan(0);
  });

  it('renders goals section with both short-term and long-term goals', () => {
    const note = buildNote({
      goals: {
        shortTerm: [{ description: 'Short goal', status: 'progressing' }],
        longTerm: [{ description: 'Long goal', status: 'discontinued' }],
      },
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    // Goals render in both xl:block aside and xl:hidden fallback; use getAllByText throughout.
    expect(screen.getAllByText('Goals').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Short-Term:', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Long-Term:', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Short goal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Long goal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Progressing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Discontinued').length).toBeGreaterThan(0);
  });

  it('does not render goals section when goals is absent', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote({ goals: undefined })} />);
    expect(screen.queryByText('Goals')).not.toBeInTheDocument();
  });

  it('does not render goals section when both shortTerm and longTerm are empty/absent', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote({ goals: { shortTerm: [], longTerm: [] } })} />);
    expect(screen.queryByText('Goals')).not.toBeInTheDocument();
  });

  it('renders goal with percentComplete when provided', () => {
    const note = buildNote({
      goals: {
        shortTerm: [
          { description: 'Improve ROM', status: 'progressing', percentComplete: 75 },
        ],
      },
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    // '(75%)' appears in both xl:block aside and xl:hidden fallback; use getAllByText.
    expect(screen.getAllByText('(75%)').length).toBeGreaterThan(0);
  });

  it('does not render percentComplete span when percentComplete is undefined', () => {
    const note = buildNote({
      goals: {
        shortTerm: [
          { description: 'Improve ROM', status: 'progressing' },
        ],
      },
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('renders all four goal status badge variants', () => {
    const note = buildNote({
      goals: {
        shortTerm: [
          { description: 'Goal 1', status: 'not_started' },
          { description: 'Goal 2', status: 'progressing' },
          { description: 'Goal 3', status: 'met' },
          { description: 'Goal 4', status: 'discontinued' },
        ],
      },
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    // Each badge appears in both xl:block aside and xl:hidden fallback; use getAllByText.
    expect(screen.getAllByText('Not Started').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Progressing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Met').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Discontinued').length).toBeGreaterThan(0);
  });

  it('copy button triggers navigator.clipboard.writeText with section content', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const user = userEvent.setup();
    armClipboardMock();

    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const copySubjectiveButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    await user.click(copySubjectiveButton);

    await vi.waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('Patient reports left knee pain 5/10.');
    });
  });

  it('resets copy icon back after 2 seconds', async () => {
    vi.useFakeTimers();
    mockWriteText.mockResolvedValue(undefined);
    armClipboardMock();

    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    // fireEvent, not userEvent: RTL's asyncWrapper awaits a setTimeout that
    // vitest's fake timers never fire, so userEvent hangs while timers are faked.
    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    fireEvent.click(copyButton);

    // Wait for the async clipboard write to resolve
    await act(async () => {
      await Promise.resolve();
    });

    // aria-live region should be announcing
    const liveRegion = copyButton.parentElement?.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(liveRegion).toHaveTextContent('Copied to clipboard');

    // Advance timers past the 2000ms timeout
    act(() => {
      vi.advanceTimersByTime(2001);
    });

    // Announcement should clear
    expect(liveRegion).toHaveTextContent('');
  });

  it('shows fallback textarea when clipboard.writeText rejects', async () => {
    mockWriteText.mockRejectedValue(new Error('Clipboard permission denied'));
    const user = userEvent.setup();
    armClipboardMock();

    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    await user.click(copyButton);

    await vi.waitFor(() => {
      expect(screen.getByText('Clipboard unavailable — Select All to copy manually:')).toBeInTheDocument();
    });

    const fallbackTextarea = screen.getByRole('textbox', {
      name: 'Copy Subjective section — manual copy fallback',
    });
    expect(fallbackTextarea).toBeInTheDocument();
    expect(fallbackTextarea).toHaveValue('Patient reports left knee pain 5/10.');
  });

  it('shows fallback textarea when navigator.clipboard is unavailable', async () => {
    const user = userEvent.setup();
    // Simulate environment where clipboard API does not exist. Set after setup(),
    // which would otherwise install its own stub.
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    await user.click(copyButton);

    await vi.waitFor(() => {
      expect(screen.getByText('Clipboard unavailable — Select All to copy manually:')).toBeInTheDocument();
    });
  });

  it('"Copy full SOAP note" button copies the full formatted note text', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const user = userEvent.setup();
    armClipboardMock();
    const note = buildNote();

    render(<GeneratedNote onSave={noop} isSaving={false} note={note} />);

    const copyFullButton = screen.getByRole('button', { name: 'Copy full SOAP note' });
    await user.click(copyFullButton);

    await vi.waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(
        [
          'SUBJECTIVE',
          'Patient reports left knee pain 5/10.',
          '',
          'OBJECTIVE',
          'ROM flexion 95 degrees. Manual therapy performed.',
          '',
          'ASSESSMENT',
          'Patient progressing toward goals.',
          '',
          'PLAN',
          'Continue current plan of care 2x/week.',
        ].join('\n')
      );
    });
  });

  it('CopyButton clears timeout on unmount (no stale state update)', async () => {
    vi.useFakeTimers();
    mockWriteText.mockResolvedValue(undefined);
    armClipboardMock();

    const { unmount } = render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    // fireEvent, not userEvent: see the note in "resets copy icon back after 2 seconds"
    fireEvent.click(screen.getByRole('button', { name: 'Copy Subjective section' }));

    // Wait for async clipboard write to resolve
    await act(async () => {
      await Promise.resolve();
    });
    const pendingTimers = vi.getTimerCount();

    // Unmount before the 2s reset timer fires; the cleanup must clear exactly that timer
    unmount();

    expect(vi.getTimerCount()).toBe(pendingTimers - 1);
  });

  it('displays generationTimeMs as "Generated in X.Xs" in footer', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote({ metadata: { generationTimeMs: 2300 } })} />);

    // The footer paragraph
    const footer = screen.getByText('Generated in 2.3s');
    expect(footer).toBeInTheDocument();
  });

  it('has a persistent aria-live region that announces copy success', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const user = userEvent.setup();
    armClipboardMock();

    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    // The aria-live region should exist BEFORE any click (Rule 13: container must pre-exist)
    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    const liveRegion = copyButton.parentElement?.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(liveRegion).toBeEmptyDOMElement();

    await user.click(copyButton);

    await vi.waitFor(() => {
      expect(liveRegion).toHaveTextContent('Copied to clipboard');
    });
  });

  it('CopyButton SVGs have aria-hidden for accessibility', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    const svgs = copyButton.querySelectorAll('svg');
    expect(svgs).toHaveLength(1);
    svgs.forEach(svg => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // --- B-4: Inline editing tests ---

  it('edit button toggles section into edit mode', async () => {
    const user = userEvent.setup();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));

    const textarea = screen.getByRole('textbox', { name: 'Edit Subjective section content' });
    expect(textarea).toBeInTheDocument();
  });

  it('edit mode shows textarea with section content', async () => {
    const user = userEvent.setup();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));

    const textarea = screen.getByRole('textbox', { name: 'Edit Subjective section content' });
    expect(textarea).toHaveValue('Patient reports left knee pain 5/10.');
  });

  it('edit mode shows "Editing" badge in header', async () => {
    const user = userEvent.setup();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));

    expect(screen.getByText('Editing')).toBeInTheDocument();
  });

  it('edit mode shows Save and Cancel buttons, hides Copy and Edit buttons', async () => {
    const user = userEvent.setup();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));

    expect(screen.getByRole('button', { name: 'Save Subjective section' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel editing Subjective section' })).toBeInTheDocument();

    // Copy and Edit buttons should be gone from Subjective section
    expect(screen.queryByRole('button', { name: 'Copy Subjective section' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Subjective section' })).not.toBeInTheDocument();
  });

  it('edit mode applies ring styling to card', async () => {
    const user = userEvent.setup();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));

    expect(screen.getByRole('region', { name: 'Subjective' })).toHaveClass('ring-2');
  });

  it('save updates section content with edited text', async () => {
    const user = userEvent.setup();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));

    const textarea = screen.getByRole('textbox', { name: 'Edit Subjective section content' });
    await user.clear(textarea);
    await user.type(textarea, 'Updated subjective content.');

    await user.click(screen.getByRole('button', { name: 'Save Subjective section' }));

    expect(screen.getByText('Updated subjective content.')).toBeInTheDocument();
    // Textarea should be gone
    expect(screen.queryByRole('textbox', { name: 'Edit Subjective section content' })).not.toBeInTheDocument();
  });

  it('cancel reverts to original content', async () => {
    const user = userEvent.setup();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));

    const textarea = screen.getByRole('textbox', { name: 'Edit Subjective section content' });
    await user.clear(textarea);
    await user.type(textarea, 'This should not be saved.');

    await user.click(screen.getByRole('button', { name: 'Cancel editing Subjective section' }));

    expect(screen.getByText('Patient reports left knee pain 5/10.')).toBeInTheDocument();
    expect(screen.queryByText('This should not be saved.')).not.toBeInTheDocument();
  });

  it('editing one section does not affect others', async () => {
    const user = userEvent.setup();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));

    // Objective should still show its content as text (not textarea)
    expect(screen.getByText('ROM flexion 95 degrees. Manual therapy performed.')).toBeInTheDocument();
    // Objective should still have its edit button
    expect(screen.getByRole('button', { name: 'Edit Objective section' })).toBeInTheDocument();
  });

  it('Copy All includes edited content after save', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const user = userEvent.setup();
    armClipboardMock();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    // Edit and save Subjective
    await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));
    const textarea = screen.getByRole('textbox', { name: 'Edit Subjective section content' });
    await user.clear(textarea);
    await user.type(textarea, 'Edited subjective.');
    await user.click(screen.getByRole('button', { name: 'Save Subjective section' }));

    const copyAllButton = screen.getByRole('button', { name: 'Copy full SOAP note' });
    await user.click(copyAllButton);

    await vi.waitFor(() => {
      const [copyText] = mockWriteText.mock.calls[0];
      expect(copyText).toContain('Edited subjective.');
    });
  });

  it('aria-live announces save result', async () => {
    const user = userEvent.setup();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));
    await user.click(screen.getByRole('button', { name: 'Save Subjective section' }));

    // The section's aria-live region announces the save
    expect(await screen.findByText('Subjective section saved')).toHaveAttribute('aria-live', 'polite');
  });

  it('aria-live announces cancel result', async () => {
    const user = userEvent.setup();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));
    await user.click(screen.getByRole('button', { name: 'Cancel editing Subjective section' }));

    expect(await screen.findByText('Subjective section edit cancelled')).toHaveAttribute('aria-live', 'polite');
  });

  it('edit textarea has accessible label', async () => {
    const user = userEvent.setup();
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));

    const textarea = screen.getByRole('textbox', { name: 'Edit Subjective section content' });
    expect(textarea).toHaveAttribute('aria-label', 'Edit Subjective section content');
  });

  // --- Print layout tests ---

  it('renders a print-only clinical header with hidden print:block classes', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const printHeader = screen.getByTestId('print-header');
    expect(printHeader).toBeInTheDocument();
    expect(printHeader).toHaveClass('hidden');
    expect(printHeader).toHaveClass('print:block');
  });

  it('print header contains blank underline fields for patient name, date, duration, modality', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const printHeader = screen.getByTestId('print-header');
    expect(printHeader).toHaveTextContent('Patient Name');
    expect(printHeader).toHaveTextContent('Date');
    expect(printHeader).toHaveTextContent('Duration');
    expect(printHeader).toHaveTextContent('Modality');
  });

  it('renders a print-only signature block with hidden print:block classes', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const printFooter = screen.getByTestId('print-footer');
    expect(printFooter).toBeInTheDocument();
    expect(printFooter).toHaveClass('hidden');
    expect(printFooter).toHaveClass('print:block');
  });

  it('signature block contains Provider Signature and Date labels', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const printFooter = screen.getByTestId('print-footer');
    expect(printFooter).toHaveTextContent('Provider Signature');
    expect(printFooter).toHaveTextContent('Date');
  });

  it('print-only elements are not visible by default (have hidden class)', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const printHeader = screen.getByTestId('print-header');
    const printFooter = screen.getByTestId('print-footer');
    expect(printHeader).toHaveClass('hidden');
    expect(printFooter).toHaveClass('hidden');
  });

  it('print header contains FlashNote branding', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const printHeader = screen.getByTestId('print-header');
    expect(printHeader).toHaveTextContent('FlashNote');
  });

  it('print header contains SOAP Note title', () => {
    render(<GeneratedNote onSave={noop} isSaving={false} note={buildNote()} />);

    const printHeader = screen.getByTestId('print-header');
    expect(printHeader).toHaveTextContent('SOAP Note');
  });

  describe('Save note', () => {
    it('sends every section, including saved edits and an edit still open', async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(<GeneratedNote note={buildNote()} onSave={onSave} isSaving={false} />);

      await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));
      const subjective = screen.getByRole('textbox', { name: 'Edit Subjective section content' });
      await user.clear(subjective);
      await user.type(subjective, 'Saved subjective edit.');
      await user.click(screen.getByRole('button', { name: 'Save Subjective section' }));

      await user.click(screen.getByRole('button', { name: 'Edit Plan section' }));
      const plan = screen.getByRole('textbox', { name: 'Edit Plan section content' });
      await user.clear(plan);
      await user.type(plan, 'Plan still being edited.');

      await user.click(screen.getByRole('button', { name: 'Save note' }));

      expect(onSave).toHaveBeenCalledWith([
        { sectionId: '00000000-0000-0000-0000-000000000011', title: 'Subjective', content: 'Saved subjective edit.' },
        { sectionId: '00000000-0000-0000-0000-000000000012', title: 'Objective', content: 'ROM flexion 95 degrees. Manual therapy performed.' },
        { sectionId: '00000000-0000-0000-0000-000000000013', title: 'Assessment', content: 'Patient progressing toward goals.' },
        { sectionId: '00000000-0000-0000-0000-000000000014', title: 'Plan', content: 'Plan still being edited.' },
      ]);
    });

    it('is disabled while a save is in flight', () => {
      render(<GeneratedNote note={buildNote()} onSave={noop} isSaving />);
      expect(screen.getByRole('button', { name: /Save note/ })).toBeDisabled();
    });
  });

  describe('review accessibility and limits', () => {
    it('moves focus to the review heading when the note appears', () => {
      render(<GeneratedNote note={buildNote()} onSave={noop} isSaving={false} />);
      expect(screen.getByRole('heading', { level: 2, name: 'Generated SOAP Note' })).toHaveFocus();
    });

    it('caps a section edit at the length the save accepts', async () => {
      const user = userEvent.setup();
      render(<GeneratedNote note={buildNote()} onSave={noop} isSaving={false} />);
      await user.click(screen.getByRole('button', { name: 'Edit Subjective section' }));
      expect(
        screen.getByRole('textbox', { name: 'Edit Subjective section content' }),
      ).toHaveAttribute('maxLength', '10000');
    });

    it('locks section edits while the note is saving', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <GeneratedNote note={buildNote()} onSave={noop} isSaving={false} />,
      );
      await user.click(screen.getByRole('button', { name: 'Edit Plan section' }));
      rerender(<GeneratedNote note={buildNote()} onSave={noop} isSaving />);

      expect(screen.getByRole('textbox', { name: 'Edit Plan section content' })).toHaveAttribute('readonly');
      expect(screen.getByRole('button', { name: 'Save Plan section' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel editing Plan section' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Edit Subjective section' })).toBeDisabled();
    });

    it('names each section by its own heading, even with spaces or repeated titles', () => {
      const note = buildNote({
        content: [
          { sectionId: '00000000-0000-0000-0000-0000000000c1', title: 'Chief Complaint', content: 'Knee pain.' },
          { sectionId: '00000000-0000-0000-0000-0000000000c2', title: 'Notes', content: 'First.' },
          { sectionId: '00000000-0000-0000-0000-0000000000c3', title: 'Notes', content: 'Second.' },
        ],
      });
      render(<GeneratedNote note={note} onSave={noop} isSaving={false} />);

      expect(screen.getByRole('region', { name: 'Chief Complaint' })).toHaveTextContent('Knee pain.');
      const notes = screen.getAllByRole('region', { name: 'Notes' });
      expect(notes).toHaveLength(2);
      expect(notes[0]).toHaveTextContent('First.');
      expect(notes[1]).toHaveTextContent('Second.');
    });
  });
});
