import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import NewNotePage from './page';
import type { SessionData } from '@/server/types';
import type { NoteTemplateWithSections, Patient } from '@/lib/types';

// Mock getSession
const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
}));

// Plan 04-03: page preloads templates + optional patient via DAL (Rule 5)
const mockFindBuiltinTemplates = vi.fn<
  () => Promise<NoteTemplateWithSections[]>
>();
const mockFindPatientById = vi.fn<() => Promise<Patient | null>>();
vi.mock('@/server/dal', () => ({
  findBuiltinTemplates: (): Promise<NoteTemplateWithSections[]> =>
    mockFindBuiltinTemplates(),
  findPatientById: (): Promise<Patient | null> => mockFindPatientById(),
}));

// Mock TopBar (Client Component)
vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title, backHref }: { title: string; backHref?: string }) => (
    <header data-testid="top-bar" data-back-href={backHref}>
      <h1>{title}</h1>
    </header>
  ),
}));

// Mock NoteGenerationForm (Client Component)
vi.mock('@/components/notes', () => ({
  NoteGenerationForm: ({
    initialPatientId,
  }: {
    initialPatientId?: string | null;
  }) => (
    <div data-testid="note-generation-form" data-initial-patient-id={initialPatientId ?? ''} />
  ),
}));

vi.mock('@/components/notes/PatientContextPreview', () => ({
  PatientContextPreview: ({ patient }: { patient: Patient | null }) => (
    <aside data-testid="patient-context-preview" data-has-patient={patient ? 'yes' : 'no'} />
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

function makeSearchParams(value: { patientId?: string } = {}): Promise<{ patientId?: string }> {
  return Promise.resolve(value);
}

describe('NewNotePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((): never => {
      throw new Error('NEXT_REDIRECT');
    });
    mockFindBuiltinTemplates.mockResolvedValue([]);
    mockFindPatientById.mockResolvedValue(null);
  });

  it('redirects to /login?reason=session_expired when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(NewNotePage({ searchParams: makeSearchParams() })).rejects.toThrow(
      'NEXT_REDIRECT',
    );
    expect(redirect).toHaveBeenCalledWith('/login?reason=session_expired');
  });

  it('renders TopBar with title "New Note" and backHref "/dashboard"', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    render(await NewNotePage({ searchParams: makeSearchParams() }));
    const topBar = screen.getByTestId('top-bar');
    expect(topBar).toBeInTheDocument();
    expect(topBar).toHaveAttribute('data-back-href', '/dashboard');
    expect(screen.getByRole('heading', { level: 1, name: 'New Note' })).toBeInTheDocument();
  });

  it('renders NoteGenerationForm', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    render(await NewNotePage({ searchParams: makeSearchParams() }));
    expect(screen.getByTestId('note-generation-form')).toBeInTheDocument();
  });

  it('renders main#main-content', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    render(await NewNotePage({ searchParams: makeSearchParams() }));
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('calls findBuiltinTemplates (Rule 5 — DAL for templates)', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    await NewNotePage({ searchParams: makeSearchParams() });
    expect(mockFindBuiltinTemplates).toHaveBeenCalled();
  });

  it('does NOT call findPatientById when patientId is not in searchParams', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    await NewNotePage({ searchParams: makeSearchParams() });
    expect(mockFindPatientById).not.toHaveBeenCalled();
  });

  it('calls findPatientById with scope + patientId when ?patientId=... present', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    await NewNotePage({
      searchParams: makeSearchParams({ patientId: 'patient-123' }),
    });
    expect(mockFindPatientById).toHaveBeenCalled();
  });

  it('forwards initialPatientId to NoteGenerationForm when query param provided', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    render(
      await NewNotePage({
        searchParams: makeSearchParams({ patientId: 'patient-123' }),
      }),
    );
    const form = screen.getByTestId('note-generation-form');
    expect(form).toHaveAttribute('data-initial-patient-id', 'patient-123');
  });
});
