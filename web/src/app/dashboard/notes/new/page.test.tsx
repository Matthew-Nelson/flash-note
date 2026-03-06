import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import NewNotePage from './page';
import type { SessionData } from '@/server/types';

// Mock getSession
const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
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
  NoteGenerationForm: () => <div data-testid="note-generation-form" />,
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

describe('NewNotePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((): never => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  it('redirects to /login?reason=session_expired when no session', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(NewNotePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login?reason=session_expired');
  });

  it('renders TopBar with title "New Note" and backHref "/dashboard"', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await NewNotePage());

    const topBar = screen.getByTestId('top-bar');
    expect(topBar).toBeInTheDocument();
    expect(topBar).toHaveAttribute('data-back-href', '/dashboard');
    expect(screen.getByRole('heading', { level: 1, name: 'New Note' })).toBeInTheDocument();
  });

  it('renders NoteGenerationForm', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await NewNotePage());

    expect(screen.getByTestId('note-generation-form')).toBeInTheDocument();
  });

  it('renders main#main-content', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await NewNotePage());

    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });
});
