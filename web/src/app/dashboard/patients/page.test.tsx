import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import PatientsPage from './page';
import type { SessionData } from '@/server/types';

// Mock getSession
const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
}));

// Mock TopBar (Client Component)
vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }) => (
    <header data-testid="top-bar">
      <h1>{title}</h1>
    </header>
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

describe('PatientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((): never => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  it('redirects to /login?reason=session_expired when no session (Rule 8)', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(PatientsPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login?reason=session_expired');
  });

  it('renders TopBar with title "Patients"', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await PatientsPage());

    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Patients' })).toBeInTheDocument();
  });

  it('renders "Coming Soon" heading', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await PatientsPage());

    expect(screen.getByRole('heading', { level: 2, name: 'Coming Soon' })).toBeInTheDocument();
  });

  it('renders description text about patient management', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await PatientsPage());

    expect(screen.getByText(/Patient management is on the way/)).toBeInTheDocument();
  });

  it('renders main#main-content', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await PatientsPage());

    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });
});
