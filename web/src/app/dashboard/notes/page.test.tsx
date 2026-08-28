import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import type { SessionData } from '@/server/types';
import type { ClinicalNoteWithPatient } from '@/lib/types';

// Mock getSession
const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
}));

// Plan 04-03: DAL call for listing
const mockFindClinicalNotesByScope = vi.fn<
  (
    scope: unknown,
    filters?: unknown,
  ) => Promise<{ notes: ClinicalNoteWithPatient[]; total: number }>
>();
vi.mock('@/server/dal', () => ({
  findClinicalNotesByScope: (
    scope: unknown,
    filters?: unknown,
  ): Promise<{ notes: ClinicalNoteWithPatient[]; total: number }> =>
    mockFindClinicalNotesByScope(scope, filters),
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
vi.mock('@/server/lib/logger', () => ({ logger: mockLogger }));

// Mock TopBar (Client Component)
vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }) => (
    <header data-testid="top-bar">{title}</header>
  ),
}));

vi.mock('@/components/notes', () => ({
  NoteRow: ({ note }: { note: ClinicalNoteWithPatient }) => (
    <tr data-testid="note-row">
      <td data-note-id={note.id}>{note.id}</td>
    </tr>
  ),
  SearchNotes: ({ initialQuery }: { initialQuery: string }) => (
    <div data-testid="search-notes" data-query={initialQuery} />
  ),
}));

import NotesPage, { NotesTable } from './page';

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

function makeSearchParams(
  value: { patientId?: string; noteType?: string; q?: string; page?: string } = {},
) {
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

  it('renders "New note" link to /dashboard/notes/new', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    render(await NotesPage({ searchParams: makeSearchParams() }));
    const link = screen.getByRole('link', { name: /New note/i });
    expect(link).toHaveAttribute('href', '/dashboard/notes/new');
  });

  it('renders main#main-content', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    render(await NotesPage({ searchParams: makeSearchParams() }));
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('seeds SearchNotes with the ?q= param', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    render(await NotesPage({ searchParams: makeSearchParams({ q: '  knee  ' }) }));
    expect(screen.getByTestId('search-notes')).toHaveAttribute('data-query', 'knee');
  });
});

// NotesTable owns the DAL call (it's the async Suspense child in page.tsx), so
// these assertions target it directly — RTL would otherwise render the Suspense
// fallback instead of awaiting the inner async component.
describe('NotesTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindClinicalNotesByScope.mockResolvedValue({ notes: [], total: 0 });
  });

  it('calls findClinicalNotesByScope with user scope (Rule 5)', async () => {
    await NotesTable({ userId: 'user-uuid', q: '', page: 1 });
    expect(mockFindClinicalNotesByScope).toHaveBeenCalledWith(
      { type: 'user', userId: 'user-uuid' },
      expect.objectContaining({ limit: 50, offset: 0 }),
    );
  });

  it('forwards the search term to the DAL', async () => {
    await NotesTable({ userId: 'u', q: 'gait training', page: 1 });
    expect(mockFindClinicalNotesByScope).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ search: 'gait training' }),
    );
  });

  it('omits search when the query is empty', async () => {
    await NotesTable({ userId: 'u', q: '', page: 1 });
    expect(mockFindClinicalNotesByScope).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ search: undefined }),
    );
  });

  it('computes offset from the page prop', async () => {
    await NotesTable({ userId: 'u', q: '', page: 3 });
    expect(mockFindClinicalNotesByScope).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 50, offset: 100 }),
    );
  });

  it('renders the default empty state when there are no notes and no query', async () => {
    render(await NotesTable({ userId: 'u', q: '', page: 1 }));
    expect(
      screen.getByRole('heading', { level: 2, name: /No notes yet/i }),
    ).toBeInTheDocument();
  });

  it('renders a search-scoped empty state when a query yields nothing', async () => {
    render(await NotesTable({ userId: 'u', q: 'zebra', page: 1 }));
    expect(
      screen.getByRole('heading', { level: 2, name: /No matching notes/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Try a different search term/i)).toBeInTheDocument();
  });

  it('renders a NoteRow per note when notes exist', async () => {
    mockFindClinicalNotesByScope.mockResolvedValueOnce({
      notes: [createMockNote('a'), createMockNote('b'), createMockNote('c')],
      total: 3,
    });
    render(await NotesTable({ userId: 'u', q: '', page: 1 }));
    expect(screen.getAllByTestId('note-row')).toHaveLength(3);
  });

  it('renders pagination and preserves the query in page links', async () => {
    mockFindClinicalNotesByScope.mockResolvedValueOnce({
      notes: [createMockNote('a')],
      total: 125,
    });
    render(await NotesTable({ userId: 'u', q: 'knee', page: 2 }));
    expect(
      screen.getByRole('navigation', { name: /pagination/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    const prev = screen.getByRole('link', { name: /previous/i });
    expect(prev).toHaveAttribute('href', '/dashboard/notes?q=knee&page=1');
    const next = screen.getByRole('link', { name: /next/i });
    expect(next).toHaveAttribute('href', '/dashboard/notes?q=knee&page=3');
  });

  it('omits pagination when everything fits on one page', async () => {
    mockFindClinicalNotesByScope.mockResolvedValueOnce({
      notes: [createMockNote('a')],
      total: 1,
    });
    render(await NotesTable({ userId: 'u', q: '', page: 1 }));
    expect(
      screen.queryByRole('navigation', { name: /pagination/i }),
    ).not.toBeInTheDocument();
  });
});
