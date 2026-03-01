import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogoutButton } from './LogoutButton';

// Mock logoutAction
const mockLogoutAction = vi.hoisted(() => vi.fn<() => Promise<void>>());
vi.mock('@/actions/auth', () => ({
  logoutAction: (): Promise<void> => mockLogoutAction(),
}));

// Mock UI components
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

// Install a configurable clipboard stub before each test so both our spy and
// userEvent.setup() (which calls attachClipboardStubToView) can coexist.
// configurable: true allows userEvent to redefine the property without throwing.
// We install fresh before each test so vi.clearAllMocks() + re-stub keeps state clean.
const mockClipboardWriteText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  mockClipboardWriteText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mockClipboardWriteText },
    writable: true,
    configurable: true,
  });
});

describe('LogoutButton', () => {
  it('renders Sign out button', () => {
    render(<LogoutButton />);
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('calls logoutAction on click', async () => {
    mockLogoutAction.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<LogoutButton />);
    await user.click(screen.getByText('Sign out'));

    expect(mockLogoutAction).toHaveBeenCalledOnce();
  });

  it('shows "Signing out..." while pending', async () => {
    // Hold the action in a pending state
    let resolveLogout!: () => void;
    mockLogoutAction.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLogout = resolve;
      })
    );
    const user = userEvent.setup();

    render(<LogoutButton />);
    await user.click(screen.getByText('Sign out'));

    expect(screen.getByText('Signing out...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();

    resolveLogout();
  });

  it('clears clipboard before calling logoutAction', async () => {
    mockLogoutAction.mockResolvedValue(undefined);

    render(<LogoutButton />);
    // Use fireEvent rather than userEvent here so that userEvent does not replace
    // navigator.clipboard with its own stub (attachClipboardStubToView), which would
    // disconnect our mockClipboardWriteText from the active clipboard object.
    fireEvent.click(screen.getByText('Sign out'));

    // Wait for both calls to complete before checking invocation order.
    await vi.waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledWith('');
      expect(mockLogoutAction).toHaveBeenCalledOnce();
    });

    // Clipboard clear happens before logout
    const clipboardCallOrder = mockClipboardWriteText.mock.invocationCallOrder[0];
    const logoutCallOrder = mockLogoutAction.mock.invocationCallOrder[0];
    expect(clipboardCallOrder).toBeLessThan(logoutCallOrder);
  });

  it('still calls logoutAction even if clipboard.writeText rejects', async () => {
    mockClipboardWriteText.mockRejectedValueOnce(new Error('Clipboard permission denied'));
    mockLogoutAction.mockResolvedValue(undefined);

    render(<LogoutButton />);
    // Use fireEvent for the same reason: prevents userEvent from replacing the clipboard stub.
    fireEvent.click(screen.getByText('Sign out'));

    await vi.waitFor(() => {
      expect(mockLogoutAction).toHaveBeenCalledOnce();
    });
  });
});
