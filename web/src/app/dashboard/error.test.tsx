import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardError from './error';

// Mock logoutAction
const mockLogoutAction = vi.hoisted(() => vi.fn<() => Promise<void>>());
const mockReportErrorBoundary = vi.hoisted(() => vi.fn());
vi.mock('@/actions/auth', () => ({
  logoutAction: (): Promise<void> => mockLogoutAction(),
}));
vi.mock('@/lib/telemetry', () => ({
  reportErrorBoundary: mockReportErrorBoundary,
}));

// Mock UI components
vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

// Install a configurable clipboard stub before each test so both our spy and
// userEvent.setup() (which calls attachClipboardStubToView) can coexist.
// configurable: true allows userEvent to redefine the property without throwing.
const mockClipboardWriteText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  mockClipboardWriteText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mockClipboardWriteText },
    writable: true,
    configurable: true,
  });
  // Reset window.location.href for fallback tests
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  });
});

describe('DashboardError', () => {
  it('renders a curated error message (not error.message)', () => {
    const error = new Error('Internal DB connection pool exhausted');
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument();
    // Rule 2 + Rule 7: raw error message must NOT be displayed
    expect(screen.queryByText('Internal DB connection pool exhausted')).not.toBeInTheDocument();
  });

  it('calls reset when Try Again button is clicked', async () => {
    const user = userEvent.setup();
    const error = new Error('test error');
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    await user.click(screen.getByText('Try Again'));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('does not link to /login?reason=session_expired', () => {
    const error = new Error('test error');
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    const signInElement = screen.getByText('Return to sign in');
    // Must be a button, not a link
    expect(signInElement.tagName).toBe('BUTTON');
    expect(signInElement.closest('a')).toBeNull();
  });

  it('calls logoutAction when Return to sign in is clicked', async () => {
    mockLogoutAction.mockResolvedValue(undefined);

    render(<DashboardError error={new Error('test')} reset={vi.fn()} />);
    fireEvent.click(screen.getByText('Return to sign in'));

    await vi.waitFor(() => {
      expect(mockLogoutAction).toHaveBeenCalledOnce();
    });
  });

  it('dispatches flashnote:logout event before logoutAction (Rule 4)', async () => {
    mockLogoutAction.mockResolvedValue(undefined);
    const logoutListener = vi.fn();
    window.addEventListener('flashnote:logout', logoutListener);

    render(<DashboardError error={new Error('test')} reset={vi.fn()} />);
    fireEvent.click(screen.getByText('Return to sign in'));

    await vi.waitFor(() => {
      expect(logoutListener).toHaveBeenCalledOnce();
      expect(mockLogoutAction).toHaveBeenCalledOnce();
    });

    // Event dispatched before logoutAction
    const eventCallOrder = logoutListener.mock.invocationCallOrder[0];
    const logoutCallOrder = mockLogoutAction.mock.invocationCallOrder[0];
    expect(eventCallOrder).toBeLessThan(logoutCallOrder);

    window.removeEventListener('flashnote:logout', logoutListener);
  });

  it('clears clipboard before calling logoutAction (Rule 4)', async () => {
    mockLogoutAction.mockResolvedValue(undefined);

    render(<DashboardError error={new Error('test')} reset={vi.fn()} />);
    fireEvent.click(screen.getByText('Return to sign in'));

    await vi.waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledWith('');
      expect(mockLogoutAction).toHaveBeenCalledOnce();
    });

    // Clipboard clear happens before logout
    const clipboardCallOrder = mockClipboardWriteText.mock.invocationCallOrder[0];
    const logoutCallOrder = mockLogoutAction.mock.invocationCallOrder[0];
    expect(clipboardCallOrder).toBeLessThan(logoutCallOrder);
  });

  it('shows Signing out... while logoutAction is pending', async () => {
    let resolveLogout!: () => void;
    mockLogoutAction.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLogout = resolve;
      })
    );

    render(<DashboardError error={new Error('test')} reset={vi.fn()} />);
    fireEvent.click(screen.getByText('Return to sign in'));

    await vi.waitFor(() => {
      expect(screen.getByText('Signing out...')).toBeInTheDocument();
    });
    expect(screen.getByText('Signing out...').closest('button')).toBeDisabled();

    resolveLogout();
  });

  it('falls back to homepage navigation when logoutAction fails', async () => {
    mockLogoutAction.mockRejectedValue(new Error('Server unreachable'));
    const logoutListener = vi.fn();
    window.addEventListener('flashnote:logout', logoutListener);

    render(<DashboardError error={new Error('test')} reset={vi.fn()} />);
    fireEvent.click(screen.getByText('Return to sign in'));

    await vi.waitFor(() => {
      expect(window.location.href).toBe('/login');
    });

    // Rule 4: PHI clearing must still happen even when logoutAction fails
    expect(logoutListener).toHaveBeenCalledOnce();
    expect(mockClipboardWriteText).toHaveBeenCalledWith('');

    window.removeEventListener('flashnote:logout', logoutListener);
  });

  it('still calls logoutAction when clipboard.writeText rejects', async () => {
    mockClipboardWriteText.mockRejectedValueOnce(new Error('Clipboard permission denied'));
    mockLogoutAction.mockResolvedValue(undefined);

    render(<DashboardError error={new Error('test')} reset={vi.fn()} />);
    fireEvent.click(screen.getByText('Return to sign in'));

    await vi.waitFor(() => {
      expect(mockLogoutAction).toHaveBeenCalledOnce();
    });
  });

  it('has an aria-live region for the sign-out button (Rule 13)', () => {
    render(<DashboardError error={new Error('test')} reset={vi.fn()} />);

    const button = screen.getByText('Return to sign in');
    const liveRegion = button.closest('[aria-live]');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('reports error via telemetry', () => {
    const error = Object.assign(new Error('secret details'), { digest: 'abc123' });
    const reset = vi.fn();

    render(<DashboardError error={error} reset={reset} />);

    expect(mockReportErrorBoundary).toHaveBeenCalledWith(error, 'abc123');
  });
});
