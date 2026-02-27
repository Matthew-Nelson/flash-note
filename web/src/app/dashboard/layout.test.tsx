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

// Mock LogoutButton (client component)
vi.mock('@/components/auth', () => ({
  LogoutButton: () => <button>Sign out</button>,
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

  it('redirects to /login when getSession() returns null', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(
      DashboardLayout({ children: <div>child</div> })
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('renders user email in nav', async () => {
    mockGetSession.mockResolvedValue(createMockSession({ email: 'jane@clinic.com' }));

    render(await DashboardLayout({ children: <div>child</div> }));

    expect(screen.getByText('jane@clinic.com')).toBeInTheDocument();
  });

  it('renders sign-out button', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await DashboardLayout({ children: <div>child</div> }));

    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('renders settings link', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await DashboardLayout({ children: <div>child</div> }));

    const settingsLink = screen.getByRole('link', { name: /go to settings/i });
    expect(settingsLink).toHaveAttribute('href', '/dashboard/settings');
  });

  it('renders FlashNote logo link', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await DashboardLayout({ children: <div>child</div> }));

    expect(screen.getByText('FlashNote')).toBeInTheDocument();
    expect(screen.getByText('FlashNote').closest('a')).toHaveAttribute('href', '/');
  });

  it('renders children', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await DashboardLayout({ children: <div>Dashboard content</div> }));

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });
});
