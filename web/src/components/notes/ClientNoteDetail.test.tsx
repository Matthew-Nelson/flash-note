import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientNoteDetail } from './ClientNoteDetail';
import type { ClinicalNoteWithPatient } from '@/lib/types';

const mockArchive = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock('@/actions/notes', () => ({
  archiveNoteAction: mockArchive,
}));

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    useRouter: () => ({ push: mockPush, refresh: mockRefresh, replace: vi.fn() }),
    usePathname: () => '/dashboard/notes/abc',
  };
});

const NOTE_ID = '55555555-5555-5555-5555-555555555555';
const SEC_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function createNote(overrides: Partial<ClinicalNoteWithPatient> = {}): ClinicalNoteWithPatient {
  return {
    id: NOTE_ID,
    userId: 'user-1',
    organizationId: null,
    patientId: null,
    templateId: '00000000-0000-0000-0000-000000000001',
    noteType: 'daily_note',
    content: [{ sectionId: SEC_ID, title: 'Subjective', content: 'S.' }],
    quickNotes: '',
    patientContext: null,
    modality: null,
    durationMinutes: null,
    generationTimeMs: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    patientFirstName: null,
    patientLastName: null,
    ...overrides,
  };
}

describe('ClientNoteDetail', () => {
  it('renders h1 heading', () => {
    render(<ClientNoteDetail note={createNote()} versions={[]} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('includes patient name in h1 when note is linked to a patient', () => {
    render(
      <ClientNoteDetail
        note={createNote({ patientFirstName: 'Jane', patientLastName: 'Doe' })}
        versions={[]}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Note — Jane Doe');
  });

  it('renders one EditableNoteSection per section in note.content', () => {
    const multiSectionNote = createNote({
      content: [
        { sectionId: 's1', title: 'Subjective', content: 'S.' },
        { sectionId: 's2', title: 'Objective', content: 'O.' },
      ],
    });
    render(<ClientNoteDetail note={multiSectionNote} versions={[]} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Subjective' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Objective' })).toBeInTheDocument();
  });

  it('opens archive confirm dialog when Archive button clicked', async () => {
    const user = userEvent.setup();
    render(<ClientNoteDetail note={createNote()} versions={[]} />);
    await user.click(screen.getByRole('button', { name: /Archive note/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls archiveNoteAction with noteId on confirm and navigates on success', async () => {
    mockArchive.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<ClientNoteDetail note={createNote()} versions={[]} />);
    await user.click(screen.getByRole('button', { name: /Archive note/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(mockArchive).toHaveBeenCalledWith(NOTE_ID));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/notes'));
  });

  it('shows curated error message when archive fails (Rule 2 — mapNoteError)', async () => {
    mockArchive.mockResolvedValue({ success: false, error: 'archive_failed' });
    const user = userEvent.setup();
    render(<ClientNoteDetail note={createNote()} versions={[]} />);
    await user.click(screen.getByRole('button', { name: /Archive note/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive' }));
    await waitFor(() =>
      expect(screen.getByText("We couldn't archive this note. Please try again.")).toBeInTheDocument(),
    );
  });
});
