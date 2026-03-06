import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import DashboardPage from './page';
import type { SessionData } from '@/server/types';
import type { UsageData } from '@/server/dal/usage';

// Mock getSession
const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
}));

// Mock usage DAL
const mockGetUsageForUser = vi.fn();
vi.mock('@/server/dal/usage', () => ({
  getUsageForUser: (...args: unknown[]): unknown => mockGetUsageForUser(...args),
}));

// Mock UI components
vi.mock('@/components/ui', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SubscriptionBadge: ({ status }: { status: string }) => (
    <span data-testid="subscription-badge">{status}</span>
  ),
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

// Mock TopBar (Client Component)
vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }) => (
    <header data-testid="top-bar">
      <h1>{title}</h1>
    </header>
  ),
}));

// Mock billing actions — prevents transitive import of billing service → config (no DATABASE_URL in test env)
vi.mock('@/actions/billing', () => ({
  createPortalAction: vi.fn(),
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

function createMockUsage(overrides: Partial<UsageData> = {}): UsageData {
  return {
    currentMonth: '2026-02',
    notesGenerated: 15,
    organization: null,
    ...overrides,
  };
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Make redirect throw to halt execution (matches production behavior)
    vi.mocked(redirect).mockImplementation((): never => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  it('redirects to /login?reason=session_expired when getSession() returns null', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(DashboardPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login?reason=session_expired');
  });

  it('renders usage count from DAL data', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    mockGetUsageForUser.mockResolvedValue(createMockUsage({ notesGenerated: 42 }));

    render(await DashboardPage());

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders formatted month', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    mockGetUsageForUser.mockResolvedValue(createMockUsage({ currentMonth: '2026-02' }));

    render(await DashboardPage());

    expect(screen.getByText(/SOAP notes generated in February 2026/)).toBeInTheDocument();
  });

  it('renders organization name when present', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    mockGetUsageForUser.mockResolvedValue(
      createMockUsage({ organization: { name: 'Acme PT', role: 'member' } })
    );

    render(await DashboardPage());

    expect(screen.getByText('Organization: Acme PT')).toBeInTheDocument();
  });

  it('does not render organization section when null', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    mockGetUsageForUser.mockResolvedValue(createMockUsage({ organization: null }));

    render(await DashboardPage());

    expect(screen.queryByText(/Organization:/)).not.toBeInTheDocument();
  });

  it('does not render NoteGenerationForm (form moved to /dashboard/notes/new)', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    mockGetUsageForUser.mockResolvedValue(createMockUsage());

    render(await DashboardPage());

    expect(screen.queryByTestId('note-generation-form')).not.toBeInTheDocument();
  });

  it('renders "Generate a SOAP Note" link to /dashboard/notes/new', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    mockGetUsageForUser.mockResolvedValue(createMockUsage());

    render(await DashboardPage());

    const link = screen.getByRole('link', { name: /generate a soap note/i });
    expect(link).toHaveAttribute('href', '/dashboard/notes/new');
  });

  it('renders TopBar with title "Dashboard"', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    mockGetUsageForUser.mockResolvedValue(createMockUsage());

    render(await DashboardPage());

    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders main#main-content', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    mockGetUsageForUser.mockResolvedValue(createMockUsage());

    render(await DashboardPage());

    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('does not render Getting Started card', async () => {
    mockGetSession.mockResolvedValue(createMockSession());
    mockGetUsageForUser.mockResolvedValue(createMockUsage());

    render(await DashboardPage());

    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
    expect(screen.queryByText('Navigate to the note generation page')).not.toBeInTheDocument();
  });

  describe('subscription status messaging', () => {
    async function renderWithStatus(subscriptionStatus: string) {
      mockGetSession.mockResolvedValue(
        createMockSession({ subscriptionStatus: subscriptionStatus as SessionData['subscriptionStatus'] })
      );
      mockGetUsageForUser.mockResolvedValue(createMockUsage());
      render(await DashboardPage());
    }

    it('shows trialing message with trial end date', async () => {
      mockGetSession.mockResolvedValue(
        createMockSession({ subscriptionStatus: 'trialing', trialEndsAt: new Date('2026-03-15') })
      );
      mockGetUsageForUser.mockResolvedValue(createMockUsage());
      render(await DashboardPage());

      expect(screen.getByText(/Your trial ends on/)).toBeInTheDocument();
      expect(screen.getByText('Upgrade Now')).toBeInTheDocument();
    });

    it('shows active subscription message', async () => {
      await renderWithStatus('active');
      expect(
        screen.getByText('Your subscription is active. Thank you for using FlashNote!')
      ).toBeInTheDocument();
      expect(screen.getByText('Manage subscription')).toBeInTheDocument();
    });

    it('shows past_due message', async () => {
      await renderWithStatus('past_due');
      expect(
        screen.getByText('Your payment is past due. Please update your payment method.')
      ).toBeInTheDocument();
    });

    it('shows canceled message', async () => {
      await renderWithStatus('canceled');
      expect(
        screen.getByText('Your subscription has been canceled. Subscribe again to continue using FlashNote.')
      ).toBeInTheDocument();
      expect(screen.getByText('Subscribe Now')).toBeInTheDocument();
    });

    it('shows unpaid message', async () => {
      await renderWithStatus('unpaid');
      expect(
        screen.getByText('Your payment failed. Please update your payment method to restore access.')
      ).toBeInTheDocument();
    });

    it('shows default trial ended message for unknown status', async () => {
      // Force an unknown status to exercise the default branch
      mockGetSession.mockResolvedValue(
        createMockSession({ subscriptionStatus: 'expired' as SessionData['subscriptionStatus'] })
      );
      mockGetUsageForUser.mockResolvedValue(createMockUsage());
      render(await DashboardPage());

      expect(
        screen.getByText('Your trial has ended. Subscribe to continue using FlashNote.')
      ).toBeInTheDocument();
    });

    it('renders subscription badge', async () => {
      await renderWithStatus('active');
      expect(screen.getByTestId('subscription-badge')).toHaveTextContent('active');
    });
  });

  it('passes correct args to getUsageForUser', async () => {
    mockGetSession.mockResolvedValue(
      createMockSession({ userId: 'user-42', organizationId: 'org-99' })
    );
    mockGetUsageForUser.mockResolvedValue(createMockUsage());

    render(await DashboardPage());

    expect(mockGetUsageForUser).toHaveBeenCalledWith('user-42', 'org-99');
  });
});
