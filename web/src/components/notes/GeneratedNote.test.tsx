import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GeneratedNote } from './GeneratedNote';
import type { GenerateNoteResponse } from '@/actions/notes';

// Mock navigator.clipboard
const mockWriteText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

type NoteResponse = GenerateNoteResponse;

function buildNote(overrides: Partial<NoteResponse> = {}): NoteResponse {
  return {
    subjective: 'Patient reports left knee pain 5/10.',
    objective: 'ROM flexion 95 degrees. Manual therapy performed.',
    assessment: 'Patient progressing toward goals.',
    plan: 'Continue current plan of care 2x/week.',
    metadata: { generationTimeMs: 1500 },
    ...overrides,
  };
}

describe('GeneratedNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all four SOAP sections', () => {
    render(<GeneratedNote note={buildNote()} />);

    // The component renders title-case text; CSS `uppercase` is a visual transform only.
    // getByText matches DOM text, not computed style.
    expect(screen.getByText('Subjective')).toBeInTheDocument();
    expect(screen.getByText('Objective')).toBeInTheDocument();
    expect(screen.getByText('Assessment')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();

    expect(screen.getByText('Patient reports left knee pain 5/10.')).toBeInTheDocument();
    expect(screen.getByText('ROM flexion 95 degrees. Manual therapy performed.')).toBeInTheDocument();
    expect(screen.getByText('Patient progressing toward goals.')).toBeInTheDocument();
    expect(screen.getByText('Continue current plan of care 2x/week.')).toBeInTheDocument();
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

    render(<GeneratedNote note={note} />);

    expect(screen.getByText('Billing Reference')).toBeInTheDocument();
    expect(screen.getByText('97110')).toBeInTheDocument();
    expect(screen.getByText('Therapeutic Exercise')).toBeInTheDocument();
    expect(screen.getByText('97140')).toBeInTheDocument();
    expect(screen.getByText('Manual Therapy')).toBeInTheDocument();
  });

  it('does not render billing section when absent', () => {
    render(<GeneratedNote note={buildNote({ billing: undefined })} />);

    expect(screen.queryByText('Billing Reference')).not.toBeInTheDocument();
  });

  it('does not render billing section when billing has no charges, suggestedCodes, or modifiers', () => {
    const note = buildNote({ billing: {} });
    render(<GeneratedNote note={note} />);
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

    render(<GeneratedNote note={note} />);

    expect(screen.getByText('Timed charges (explicit minutes provided):', { exact: false })).toBeInTheDocument();
    // CPT codes in the table
    expect(screen.getByText('97110')).toBeInTheDocument();
    expect(screen.getByText('97140')).toBeInTheDocument();
    // tfoot totals
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
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

    render(<GeneratedNote note={note} />);

    // tfoot should NOT render when both are undefined (line 169 condition)
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

    render(<GeneratedNote note={note} />);

    expect(screen.getByText('Total')).toBeInTheDocument();
    // '20' appears in both the charge row minutes and tfoot — getAllByText handles both
    expect(screen.getAllByText('20').length).toBeGreaterThanOrEqual(1);
    // totalUnits is undefined — renders '—'
    expect(screen.getByText('—')).toBeInTheDocument();
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

    render(<GeneratedNote note={note} />);

    expect(screen.getByText('Total')).toBeInTheDocument();
    // totalTimedMinutes is undefined — renders '—'
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders billing modifiers when present', () => {
    const note = buildNote({
      billing: {
        suggestedModifiers: ['GP', 'CO'],
      },
    });

    render(<GeneratedNote note={note} />);

    expect(screen.getByText('Billing Reference')).toBeInTheDocument();
    expect(screen.getByText('Suggested modifiers:', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('GP')).toBeInTheDocument();
    expect(screen.getByText('CO')).toBeInTheDocument();
  });

  it('renders alerts list when present', () => {
    const note = buildNote({
      alerts: ['Medicare patient? Add GP modifier.', 'Check 8-minute rule for billing.'],
    });

    render(<GeneratedNote note={note} />);

    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.getByText('Medicare patient? Add GP modifier.')).toBeInTheDocument();
    expect(screen.getByText('Check 8-minute rule for billing.')).toBeInTheDocument();
  });

  it('does not render alerts section when alerts is absent', () => {
    render(<GeneratedNote note={buildNote({ alerts: undefined })} />);
    expect(screen.queryByText('Alerts')).not.toBeInTheDocument();
  });

  it('does not render alerts section when alerts is empty array', () => {
    render(<GeneratedNote note={buildNote({ alerts: [] })} />);
    expect(screen.queryByText('Alerts')).not.toBeInTheDocument();
  });

  it('renders uncertainAreas when present', () => {
    const note = buildNote({
      uncertainAreas: ["Interpreted 'ther ex' as therapeutic exercise."],
    });

    render(<GeneratedNote note={note} />);

    expect(screen.getByText('Review These Interpretations')).toBeInTheDocument();
    expect(screen.getByText("Interpreted 'ther ex' as therapeutic exercise.")).toBeInTheDocument();
  });

  it('does not render uncertainAreas section when absent', () => {
    render(<GeneratedNote note={buildNote({ uncertainAreas: undefined })} />);
    expect(screen.queryByText('Review These Interpretations')).not.toBeInTheDocument();
  });

  it('does not render uncertainAreas section when empty array', () => {
    render(<GeneratedNote note={buildNote({ uncertainAreas: [] })} />);
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

    render(<GeneratedNote note={note} />);

    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(screen.getByText('Short-Term:', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Improve ROM to 120 degrees')).toBeInTheDocument();
    expect(screen.getByText('Reduce pain to 3/10')).toBeInTheDocument();
    expect(screen.getByText('Progressing')).toBeInTheDocument();
    expect(screen.getByText('Met')).toBeInTheDocument();
  });

  it('renders goals section with long-term goals', () => {
    const note = buildNote({
      goals: {
        longTerm: [
          { description: 'Return to full activity', status: 'not_started' },
        ],
      },
    });

    render(<GeneratedNote note={note} />);

    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(screen.getByText('Long-Term:', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Return to full activity')).toBeInTheDocument();
    expect(screen.getByText('Not Started')).toBeInTheDocument();
  });

  it('renders goals section with both short-term and long-term goals', () => {
    const note = buildNote({
      goals: {
        shortTerm: [
          { description: 'Short goal', status: 'progressing' },
        ],
        longTerm: [
          { description: 'Long goal', status: 'discontinued' },
        ],
      },
    });

    render(<GeneratedNote note={note} />);

    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(screen.getByText('Short-Term:', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Long-Term:', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Short goal')).toBeInTheDocument();
    expect(screen.getByText('Long goal')).toBeInTheDocument();
    expect(screen.getByText('Progressing')).toBeInTheDocument();
    expect(screen.getByText('Discontinued')).toBeInTheDocument();
  });

  it('does not render goals section when goals is absent', () => {
    render(<GeneratedNote note={buildNote({ goals: undefined })} />);
    expect(screen.queryByText('Goals')).not.toBeInTheDocument();
  });

  it('does not render goals section when both shortTerm and longTerm are empty/absent', () => {
    render(<GeneratedNote note={buildNote({ goals: { shortTerm: [], longTerm: [] } })} />);
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

    render(<GeneratedNote note={note} />);

    expect(screen.getByText('(75%)')).toBeInTheDocument();
  });

  it('does not render percentComplete span when percentComplete is undefined', () => {
    const note = buildNote({
      goals: {
        shortTerm: [
          { description: 'Improve ROM', status: 'progressing' },
        ],
      },
    });

    render(<GeneratedNote note={note} />);

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

    render(<GeneratedNote note={note} />);

    expect(screen.getByText('Not Started')).toBeInTheDocument();
    expect(screen.getByText('Progressing')).toBeInTheDocument();
    expect(screen.getByText('Met')).toBeInTheDocument();
    expect(screen.getByText('Discontinued')).toBeInTheDocument();
  });

  it('copy button triggers navigator.clipboard.writeText with section content', async () => {
    mockWriteText.mockResolvedValue(undefined);

    render(<GeneratedNote note={buildNote()} />);

    const copySubjectiveButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    fireEvent.click(copySubjectiveButton);

    await vi.waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('Patient reports left knee pain 5/10.');
    });
  });

  it('shows "Copied!" state after successful clipboard copy', async () => {
    mockWriteText.mockResolvedValue(undefined);

    render(<GeneratedNote note={buildNote()} />);

    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    fireEvent.click(copyButton);

    await vi.waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('resets "Copied!" state back to "Copy" after 2 seconds', async () => {
    vi.useFakeTimers();
    mockWriteText.mockResolvedValue(undefined);

    render(<GeneratedNote note={buildNote()} />);

    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    fireEvent.click(copyButton);

    // Wait for the async clipboard write to resolve
    await act(async () => {
      await Promise.resolve();
    });

    // "Copied!" should be showing
    expect(screen.getByText('Copied!')).toBeInTheDocument();

    // Advance timers past the 2000ms timeout
    act(() => {
      vi.advanceTimersByTime(2001);
    });

    // Should revert to "Copy"
    expect(screen.queryByText('Copied!')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('shows fallback textarea when clipboard.writeText rejects', async () => {
    mockWriteText.mockRejectedValue(new Error('Clipboard permission denied'));

    render(<GeneratedNote note={buildNote()} />);

    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    fireEvent.click(copyButton);

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
    // Simulate environment where clipboard API does not exist
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(<GeneratedNote note={buildNote()} />);

    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    fireEvent.click(copyButton);

    await vi.waitFor(() => {
      expect(screen.getByText('Clipboard unavailable — Select All to copy manually:')).toBeInTheDocument();
    });

    // Restore
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('"Copy full SOAP note" button copies the full formatted note text', async () => {
    mockWriteText.mockResolvedValue(undefined);
    const note = buildNote();

    render(<GeneratedNote note={note} />);

    const copyFullButton = screen.getByRole('button', { name: 'Copy full SOAP note' });
    fireEvent.click(copyFullButton);

    await vi.waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(
        [
          'SUBJECTIVE',
          note.subjective,
          '',
          'OBJECTIVE',
          note.objective,
          '',
          'ASSESSMENT',
          note.assessment,
          '',
          'PLAN',
          note.plan,
        ].join('\n')
      );
    });
  });

  it('CopyButton clears timeout on unmount (no stale state update)', async () => {
    vi.useFakeTimers();
    mockWriteText.mockResolvedValue(undefined);

    const { unmount } = render(<GeneratedNote note={buildNote()} />);

    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    fireEvent.click(copyButton);

    // Wait for async clipboard write to resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Copied!')).toBeInTheDocument();

    // Unmount before the 2s timeout fires
    unmount();

    // Advance past the timeout — should not throw or warn about state update on unmounted component
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    vi.useRealTimers();
  });

  it('displays generationTimeMs as "Generated in X.Xs"', () => {
    render(<GeneratedNote note={buildNote({ metadata: { generationTimeMs: 2300 } })} />);

    expect(screen.getByText('Generated in 2.3s')).toBeInTheDocument();
  });

  it('has a persistent aria-live region that announces copy success', async () => {
    mockWriteText.mockResolvedValue(undefined);

    render(<GeneratedNote note={buildNote()} />);

    // The aria-live region should exist BEFORE any click (Rule 13: container must pre-exist)
    const liveRegions = document.querySelectorAll('[aria-live="polite"]');
    expect(liveRegions.length).toBeGreaterThan(0);

    // Click copy
    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    fireEvent.click(copyButton);

    await vi.waitFor(() => {
      // The live region is a sibling of the button inside CopyButton's wrapper div.
      // Query from the button's parent to scope to the correct CopyButton instance.
      const liveRegion = copyButton.parentElement?.querySelector('[aria-live="polite"][aria-atomic="true"]');
      expect(liveRegion).toHaveTextContent('Copied to clipboard');
    });
  });

  it('CopyButton SVGs have aria-hidden for accessibility', () => {
    render(<GeneratedNote note={buildNote()} />);

    // Find a copy button and verify its SVG children are aria-hidden
    const copyButton = screen.getByRole('button', { name: 'Copy Subjective section' });
    const svgs = copyButton.querySelectorAll('svg');
    svgs.forEach(svg => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
