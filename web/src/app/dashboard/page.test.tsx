import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from './page';

// Mock auth context
const mockUseAuth = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: (): unknown => mockUseAuth(),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string
    ) {
      super(message);
    }
  },
}));

// Mock api
const mockGetUsage = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    getUsage: (...args: unknown[]): unknown => mockGetUsage(...args),
    createPortalSession: vi.fn(),
  },
}));

// Mock ProtectedRoute — pass children through
vi.mock('@/components/auth', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Spinner
vi.mock('@/components/ui', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SubscriptionBadge: ({ status }: { status: string }) => (
    <span data-testid="subscription-badge">{status}</span>
  ),
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button {...props}>{children}</button>
  ),
  Spinner: ({ size }: { size?: string }) => (
    <div role="status" aria-label="Loading" data-size={size}>Loading...</div>
  ),
}));

function createMockUser(overrides: Partial<{
  id: string;
  email: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  emailVerified: boolean;
}> = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    subscriptionStatus: 'active',
    trialEndsAt: null,
    emailVerified: true,
    ...overrides,
  };
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: createMockUser(),
      logout: vi.fn(),
      fetchUser: vi.fn(),
    });
  });

  it('should show loading spinner while fetching usage', () => {
    // Never resolve the usage fetch
    mockGetUsage.mockReturnValue(new Promise(() => {}));

    render(<DashboardPage />);

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('should show note count and formatted month after load', async () => {
    mockGetUsage.mockResolvedValueOnce({
      currentMonth: '2026-02',
      notesGenerated: 15,
      organization: null,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
    });
    expect(screen.getByText(/SOAP notes generated in February 2026/)).toBeInTheDocument();
  });

  it('should show org name when user is in an org', async () => {
    mockGetUsage.mockResolvedValueOnce({
      currentMonth: '2026-02',
      notesGenerated: 42,
      organization: { name: 'Acme PT', role: 'member' },
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Organization: Acme PT')).toBeInTheDocument();
    });
  });

  it('should not show org section when organization is null', async () => {
    mockGetUsage.mockResolvedValueOnce({
      currentMonth: '2026-02',
      notesGenerated: 10,
      organization: null,
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Organization:/)).not.toBeInTheDocument();
  });

  it('should handle usage fetch failure gracefully', async () => {
    mockGetUsage.mockRejectedValueOnce(new Error('Network error'));

    render(<DashboardPage />);

    // Should stop loading and show fallback (0 notes, no crash)
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  describe('subscription status messaging', () => {
    it('should show canceled message for canceled status', async () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser({ subscriptionStatus: 'canceled' }),
        logout: vi.fn(),
        fetchUser: vi.fn(),
      });
      mockGetUsage.mockResolvedValueOnce({
        currentMonth: '2026-02',
        notesGenerated: 0,
        organization: null,
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(
          screen.getByText('Your subscription has been canceled. Subscribe again to continue using FlashNote.')
        ).toBeInTheDocument();
      });
    });

    it('should show unpaid message for unpaid status', async () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser({ subscriptionStatus: 'unpaid' }),
        logout: vi.fn(),
        fetchUser: vi.fn(),
      });
      mockGetUsage.mockResolvedValueOnce({
        currentMonth: '2026-02',
        notesGenerated: 0,
        organization: null,
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(
          screen.getByText('Your payment failed. Please update your payment method to restore access.')
        ).toBeInTheDocument();
      });
    });

    it('should show default trial ended message for unknown status', async () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser({ subscriptionStatus: 'expired' }),
        logout: vi.fn(),
        fetchUser: vi.fn(),
      });
      mockGetUsage.mockResolvedValueOnce({
        currentMonth: '2026-02',
        notesGenerated: 0,
        organization: null,
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(
          screen.getByText('Your trial has ended. Subscribe to continue using FlashNote.')
        ).toBeInTheDocument();
      });
    });

    it('should show active subscription message', async () => {
      mockUseAuth.mockReturnValue({
        user: createMockUser({ subscriptionStatus: 'active' }),
        logout: vi.fn(),
        fetchUser: vi.fn(),
      });
      mockGetUsage.mockResolvedValueOnce({
        currentMonth: '2026-02',
        notesGenerated: 0,
        organization: null,
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(
          screen.getByText('Your subscription is active. Thank you for using FlashNote!')
        ).toBeInTheDocument();
      });
    });
  });
});
