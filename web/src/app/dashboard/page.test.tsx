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

  describe('TopBar and landmarks', () => {
    it('renders TopBar with title "Dashboard"', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByTestId('top-bar')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    });

    it('renders main#main-content landmark', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    });
  });

  describe('KPI cards', () => {
    it('renders "Notes This Month" KPI card with usage count from DAL data', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockGetUsageForUser.mockResolvedValue(createMockUsage({ notesGenerated: 42 }));

      render(await DashboardPage());

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText(/Notes This Month/i)).toBeInTheDocument();
    });

    it('renders formatted month in the notes KPI card', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockGetUsageForUser.mockResolvedValue(createMockUsage({ currentMonth: '2026-02' }));

      render(await DashboardPage());

      expect(screen.getByText('February 2026')).toBeInTheDocument();
    });

    it('renders organization name when present in usage data', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockGetUsageForUser.mockResolvedValue(
        createMockUsage({ organization: { name: 'Acme PT', role: 'member' } })
      );

      render(await DashboardPage());

      expect(screen.getByText('Organization: Acme PT')).toBeInTheDocument();
    });

    it('does not render organization section when usage.organization is null', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockGetUsageForUser.mockResolvedValue(createMockUsage({ organization: null }));

      render(await DashboardPage());

      expect(screen.queryByText(/Organization:/)).not.toBeInTheDocument();
    });

    it('passes correct args (userId, organizationId) to getUsageForUser', async () => {
      mockGetSession.mockResolvedValue(
        createMockSession({ userId: 'user-42', organizationId: 'org-99' })
      );
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(mockGetUsageForUser).toHaveBeenCalledWith('user-42', 'org-99');
    });
  });

  describe('Subscription KPI card', () => {
    it('renders subscription badge in the subscription KPI card', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ subscriptionStatus: 'active' }));
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByTestId('subscription-badge')).toHaveTextContent('active');
    });

    it('shows "Trial active" for trialing status', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ subscriptionStatus: 'trialing' }));
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByText('Trial active')).toBeInTheDocument();
    });

    it('shows "Your subscription is active." for active status', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ subscriptionStatus: 'active' }));
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByText('Your subscription is active.')).toBeInTheDocument();
    });

    it('shows "Payment past due" for past_due status', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ subscriptionStatus: 'past_due' }));
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByText('Payment past due')).toBeInTheDocument();
    });

    it('shows "Subscription canceled" for canceled status', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ subscriptionStatus: 'canceled' }));
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByText('Subscription canceled')).toBeInTheDocument();
    });

    it('shows "Payment failed" for unpaid status', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ subscriptionStatus: 'unpaid' }));
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByText('Payment failed')).toBeInTheDocument();
    });

    it('shows "Trial ended" for unknown/expired status', async () => {
      mockGetSession.mockResolvedValue(
        createMockSession({ subscriptionStatus: 'expired' as SessionData['subscriptionStatus'] })
      );
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByText('Trial ended')).toBeInTheDocument();
    });
  });

  describe('Trial banner', () => {
    it('shows trial banner with days remaining for trialing status', async () => {
      // Set trialEndsAt far in the future to ensure days > 0
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      mockGetSession.mockResolvedValue(
        createMockSession({ subscriptionStatus: 'trialing', trialEndsAt: futureDate })
      );
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/remaining in your free trial/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /View Plans/i })).toHaveAttribute('href', '/pricing');
    });

    it('shows past_due banner for past_due status', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ subscriptionStatus: 'past_due' }));
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
      expect(screen.getByText(/Your payment is past due/)).toBeInTheDocument();
    });

    it('shows canceled banner for canceled status', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ subscriptionStatus: 'canceled' }));
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Your subscription has been canceled/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Subscribe Now/i })).toHaveAttribute(
        'href',
        '/pricing'
      );
    });

    it('shows unpaid banner for unpaid status', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ subscriptionStatus: 'unpaid' }));
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
      expect(screen.getByText(/Your payment failed/)).toBeInTheDocument();
    });

    it('shows expired banner for unknown/default status', async () => {
      mockGetSession.mockResolvedValue(
        createMockSession({ subscriptionStatus: 'expired' as SessionData['subscriptionStatus'] })
      );
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByRole('alert')).toBeInTheDocument();
      // Banner shows the full "Your trial has ended" message
      expect(screen.getByText(/Your trial has ended\. Subscribe to continue\./)).toBeInTheDocument();
    });

    it('does NOT show trial banner for active status', async () => {
      mockGetSession.mockResolvedValue(createMockSession({ subscriptionStatus: 'active' }));
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Shorthand CTA block', () => {
    it('renders shorthand CTA block with "Quick Shorthand" heading', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByRole('heading', { name: /Quick Shorthand/i })).toBeInTheDocument();
    });

    it('renders "Generate Professional Note" link pointing to /dashboard/notes/new', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      const link = screen.getByRole('link', { name: /Generate Professional Note/i });
      expect(link).toHaveAttribute('href', '/dashboard/notes/new');
    });
  });

  describe('Quick action stub cards', () => {
    it('renders "Add a Patient" stub card with "Coming soon" text', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByRole('heading', { name: /Add a Patient/i })).toBeInTheDocument();
      // Both quick action stubs share the same "Coming soon" text; verify at least one exists
      expect(screen.getAllByText('Coming soon').length).toBeGreaterThanOrEqual(1);
    });

    it('renders "Browse Templates" stub card with "Coming soon" text', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.getByRole('heading', { name: /Browse Templates/i })).toBeInTheDocument();
      expect(screen.getAllByText('Coming soon').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Negative tests', () => {
    it('does not render NoteGenerationForm', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.queryByTestId('note-generation-form')).not.toBeInTheDocument();
    });

    it('does not render "Need Help?" support card', async () => {
      mockGetSession.mockResolvedValue(createMockSession());
      mockGetUsageForUser.mockResolvedValue(createMockUsage());

      render(await DashboardPage());

      expect(screen.queryByText('Need Help?')).not.toBeInTheDocument();
    });
  });
});
