import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import NotesPage from './page';
import type { SessionData } from '@/server/types';
import type { ClinicalNoteWithPatient } from '@/lib/types';

// Mock getSession
const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
}));

// Plan 04-03: DAL call for listing
const mockFindClinicalNotesByScope = vi.fn<
  () => Promise<{ notes: ClinicalNoteWithPatient[]; total: number }>
>();
vi.mock('@/server/dal', () => ({
  findClinicalNotesByScope: (): Promise<{
    notes: ClinicalNoteWithPatient[];
    total: number;
  }> => mockFindClinicalNotesByScope(),
}));

// Mock TopBar (Client Component)
vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }) => (
    <header data-testid="top-bar">{title}</header>
  ),
}));

vi.mock('@/components/notes/NoteRow', () => ({
  NoteRow: ({ note }: { note: ClinicalNoteWithPatient }) => (
    <tr data-testid="note-row">
      <td data-note-id={note.id}>{note.id}</td>
    </tr>
  ),
}));

function createMockSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 'session-uuid',
    userId: 'user-uuid',
    email: 'therapist@example.com',
    subscriptionStatus: 'active',
    trialEndsAt: new Date('2026-03-15'),
    emailVerified: true,
    organizationId: null,
    ...overrides,
  };
}

function makeSearchParams(value: { patientId?: string; noteType?: string; page?: string } = {}) {
  return Promise.resolve(value);
}

function createMockNote(id = 'n1'): ClinicalNoteWithPatient {
  return {
    id,
    userId: 'user-1',
    organizationId: null,
    patientId: null,
    templateId: '00000000-0000-0000-0000-000000000001',
    noteType: 'daily_note',
    content: [],
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
  };
}

describe('NotesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((): never => {
      throw new Error('NEXT_REDIRECT');
    });
    mockFindClinicalNotesByScope.mockResolvedValue({ notes: [], total: 0 });
  });

  it('redirects to /login?reason=session_expired when no session (Rule 8)', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(NotesPage({ searchParams: makeSearchParams() })).rejects.toThrow(
      'NEXT_REDIRECT',
    );
    expect(redirect).toHaveBeenCalledWith('/login?reason=session_expired');
  });

  it('renders TopBar with title "Notes"', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    render(await NotesPage({ searchParams: makeSearchParams() }));
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
  });

  it('renders page h1 "Notes"', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    render(await NotesPage({ searchParams: makeSearchParams() }));
    // Page h1 plus mocked TopBar — match the main-area h1 (Rule 14: single h1 per page)
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings.some((h) => h.textContent === 'Notes')).toBe(true);
  });

  it('calls findClinicalNotesByScope (Rule 5)', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    await NotesPage({ searchParams: makeSearchParams() });
    expect(mockFindClinicalNotesByScope).toHaveBeenCalled();
  });

  it('renders "New note" link to /dashboard/notes/new', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    render(await NotesPage({ searchParams: makeSearchParams() }));
    const link = screen.getByRole('link', { name: /New note/i });
    expect(link).toHaveAttribute('href', '/dashboard/notes/new');
  });

  it('renders empty state when no notes', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    render(await NotesPage({ searchParams: makeSearchParams() }));
    expect(screen.getByRole('heading', { level: 2, name: /No notes yet/i })).toBeInTheDocument();
  });

  it('renders a NoteRow per note when notes exist', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    mockFindClinicalNotesByScope.mockResolvedValue({
      notes: [createMockNote('a'), createMockNote('b'), createMockNote('c')],
      total: 3,
    });
    render(await NotesPage({ searchParams: makeSearchParams() }));
    expect(screen.getAllByTestId('note-row')).toHaveLength(3);
  });

  it('renders main#main-content', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    render(await NotesPage({ searchParams: makeSearchParams() }));
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });
});
