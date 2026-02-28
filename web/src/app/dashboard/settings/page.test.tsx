import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import SettingsPage from './page';
import type { SessionData } from '@/server/types';

// Mock getSession
const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
}));

// Mock client components
vi.mock('@/components/auth', () => ({
  PasswordResetSection: ({ email }: { email: string }) => (
    <div data-testid="password-reset-section">Reset for {email}</div>
  ),
}));

vi.mock('./DeleteAccountSection', () => ({
  DeleteAccountSection: () => <div data-testid="delete-account-section">Delete Account</div>,
}));

// Mock UI components
vi.mock('@/components/ui', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((): never => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  it('redirects to /login when getSession() returns null', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(SettingsPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('renders user email in account info', async () => {
    mockGetSession.mockResolvedValue(createMockSession({ email: 'jane@clinic.com' }));

    render(await SettingsPage());

    expect(screen.getByText('jane@clinic.com')).toBeInTheDocument();
  });

  it('renders "Verified" when emailVerified is true', async () => {
    mockGetSession.mockResolvedValue(createMockSession({ emailVerified: true }));

    render(await SettingsPage());

    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('renders "Not verified" when emailVerified is false', async () => {
    mockGetSession.mockResolvedValue(createMockSession({ emailVerified: false }));

    render(await SettingsPage());

    expect(screen.getByText('Not verified')).toBeInTheDocument();
  });

  it('renders subscription status', async () => {
    mockGetSession.mockResolvedValue(createMockSession({ subscriptionStatus: 'trialing' }));

    render(await SettingsPage());

    expect(screen.getByText('trialing')).toBeInTheDocument();
  });

  it('renders password reset section with email prop', async () => {
    mockGetSession.mockResolvedValue(createMockSession({ email: 'test@clinic.com' }));

    render(await SettingsPage());

    expect(screen.getByTestId('password-reset-section')).toHaveTextContent('Reset for test@clinic.com');
  });

  it('renders delete account section', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await SettingsPage());

    expect(screen.getByTestId('delete-account-section')).toBeInTheDocument();
  });

  it('renders back to dashboard link', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await SettingsPage());

    const link = screen.getByText(/Back to Dashboard/);
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/dashboard');
  });

  it('renders breadcrumb navigation', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await SettingsPage());

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
