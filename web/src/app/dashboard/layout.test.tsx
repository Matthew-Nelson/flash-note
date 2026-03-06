import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import DashboardLayout from './layout';
import type { SessionData } from '@/server/types';

// Mock getSession
const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
}));

// Mock DashboardShell (Client Component)
vi.mock('@/components/DashboardShell', () => ({
  DashboardShell: ({ user, children }: { user: { email: string }; children: React.ReactNode }) => (
    <div data-testid="dashboard-shell" data-email={user.email}>{children}</div>
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

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((): never => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  it('redirects to /login?reason=session_expired when getSession() returns null', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(
      DashboardLayout({ children: <div>child</div> })
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login?reason=session_expired');
  });

  it('redirects to /resend-verification when email is not verified', async () => {
    mockGetSession.mockResolvedValue(createMockSession({ emailVerified: false }));

    await expect(
      DashboardLayout({ children: <div>child</div> })
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/resend-verification');
  });

  it('renders DashboardShell with user email from session', async () => {
    mockGetSession.mockResolvedValue(createMockSession({ email: 'jane@clinic.com' }));

    render(await DashboardLayout({ children: <div>child</div> }));

    const shell = screen.getByTestId('dashboard-shell');
    expect(shell).toHaveAttribute('data-email', 'jane@clinic.com');
  });

  it('renders children inside DashboardShell', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await DashboardLayout({ children: <div>Dashboard content</div> }));

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });
});
