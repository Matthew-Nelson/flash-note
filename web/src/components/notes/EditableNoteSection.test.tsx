import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableNoteSection } from './EditableNoteSection';
import type { NoteSection } from '@/lib/types';

const mockAction = vi.hoisted(() => vi.fn());
vi.mock('@/actions/notes', () => ({
  updateNoteSectionsAction: mockAction,
}));

const SECTION_ID = 's1';
const NOTE_ID = 'n1';
const UPDATED_AT = '2026-04-18T00:00:00.000Z';

function section(content = 'Original subjective content.'): NoteSection {
  return { sectionId: SECTION_ID, title: 'Subjective', content };
}

describe('EditableNoteSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders read mode by default with Edit button', () => {
    render(
      <EditableNoteSection
        noteId={NOTE_ID}
        section={section()}
        expectedUpdatedAt={UPDATED_AT}
        versions={[]}
      />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Subjective' })).toBeInTheDocument();
    expect(screen.getByText('Original subjective content.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit Subjective section/i })).toBeInTheDocument();
  });

  it('switches to edit mode with textarea + Save + Discard on Edit click', async () => {
    const user = userEvent.setup();
    render(
      <EditableNoteSection
        noteId={NOTE_ID}
        section={section()}
        expectedUpdatedAt={UPDATED_AT}
        versions={[]}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Edit Subjective section/i }));
    expect(screen.getByRole('textbox', { name: /Edit Subjective/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save section/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Discard changes/i })).toBeInTheDocument();
  });

  it('Discard reverts draft and returns to read mode', async () => {
    const user = userEvent.setup();
    render(
      <EditableNoteSection
        noteId={NOTE_ID}
        section={section()}
        expectedUpdatedAt={UPDATED_AT}
        versions={[]}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Edit Subjective section/i }));
    const textarea = screen.getByRole('textbox', { name: /Edit Subjective/i });
    await user.clear(textarea);
    await user.type(textarea, 'MY_DRAFT_TEXT');
    await user.click(screen.getByRole('button', { name: /Discard changes/i }));

    expect(screen.queryByText('MY_DRAFT_TEXT')).toBeNull();
    expect(screen.getByText('Original subjective content.')).toBeInTheDocument();
  });

  it('Save dispatches updateNoteSectionsAction with correct FormData shape', async () => {
    mockAction.mockResolvedValue({
      success: true,
      data: { note: { updatedAt: '2026-04-18T01:00:00.000Z' } },
    });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <EditableNoteSection
        noteId={NOTE_ID}
        section={section()}
        expectedUpdatedAt={UPDATED_AT}
        versions={[]}
        onSaved={onSaved}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Edit Subjective section/i }));
    const textarea = screen.getByRole('textbox', { name: /Edit Subjective/i });
    await user.clear(textarea);
    await user.type(textarea, 'NEW_CONTENT');
    await user.click(screen.getByRole('button', { name: /Save section/i }));

    await waitFor(() => expect(mockAction).toHaveBeenCalled());
    const fd = mockAction.mock.calls[0][0] as FormData;
    expect(fd.get('noteId')).toBe(NOTE_ID);
    expect(fd.get('expectedUpdatedAt')).toBe(UPDATED_AT);
    const sections = JSON.parse(fd.get('sections') as string) as Record<string, string>;
    expect(sections[SECTION_ID]).toBe('NEW_CONTENT');
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('2026-04-18T01:00:00.000Z'));
  });

  it('renders conflict alert with Refresh + Copy my changes buttons when action returns conflict', async () => {
    mockAction.mockResolvedValue({ success: false, error: 'conflict' });
    const user = userEvent.setup();
    const onRefreshRequested = vi.fn();
    render(
      <EditableNoteSection
        noteId={NOTE_ID}
        section={section()}
        expectedUpdatedAt={UPDATED_AT}
        versions={[]}
        onRefreshRequested={onRefreshRequested}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Edit Subjective section/i }));
    await user.click(screen.getByRole('button', { name: /Save section/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/modified elsewhere|Refresh/i);
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy my changes/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Refresh/i }));
    expect(onRefreshRequested).toHaveBeenCalled();
  });

  it('aria-live="assertive" on conflict alert container (Rule 13)', async () => {
    mockAction.mockResolvedValue({ success: false, error: 'conflict' });
    const user = userEvent.setup();
    const { container } = render(
      <EditableNoteSection
        noteId={NOTE_ID}
        section={section()}
        expectedUpdatedAt={UPDATED_AT}
        versions={[]}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Edit Subjective section/i }));
    await user.click(screen.getByRole('button', { name: /Save section/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    const assertiveRegion = container.querySelector('[aria-live="assertive"]');
    expect(assertiveRegion).not.toBeNull();
  });

  it('renders generic curated error for non-conflict errors (Rule 2)', async () => {
    mockAction.mockResolvedValue({ success: false, error: 'internal_error' });
    const user = userEvent.setup();
    render(
      <EditableNoteSection
        noteId={NOTE_ID}
        section={section()}
        expectedUpdatedAt={UPDATED_AT}
        versions={[]}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Edit Subjective section/i }));
    await user.click(screen.getByRole('button', { name: /Save section/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    // mapNoteError('internal_error') → "Something went wrong. Please try again."
    expect(screen.getByRole('alert').textContent).toMatch(/Something went wrong/i);
  });
});
