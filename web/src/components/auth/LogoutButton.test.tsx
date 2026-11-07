import { describe, it, expect, vi, beforeEach, onTestFinished } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
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

const mockClipboardWriteText = vi.fn().mockResolvedValue(undefined);

let user: UserEvent;

// userEvent.setup() attaches its own navigator.clipboard stub, so it must run before
// our mock is defined; otherwise writeText calls would go to userEvent's stub.
beforeEach(() => {
  user = userEvent.setup();
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
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('calls logoutAction on click', async () => {
    mockLogoutAction.mockResolvedValue(undefined);

    render(<LogoutButton />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

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

    render(<LogoutButton />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(screen.getByRole('button', { name: 'Signing out...' })).toBeDisabled();

    resolveLogout();
  });

  it('clears clipboard before calling logoutAction', async () => {
    mockLogoutAction.mockResolvedValue(undefined);

    render(<LogoutButton />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

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

  it('dispatches flashnote:logout event before logoutAction', async () => {
    mockLogoutAction.mockResolvedValue(undefined);
    const logoutListener = vi.fn();
    window.addEventListener('flashnote:logout', logoutListener);
    onTestFinished(() => window.removeEventListener('flashnote:logout', logoutListener));

    render(<LogoutButton />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await vi.waitFor(() => {
      expect(logoutListener).toHaveBeenCalledOnce();
      expect(mockLogoutAction).toHaveBeenCalledOnce();
    });

    // Event dispatched before logoutAction
    const eventCallOrder = logoutListener.mock.invocationCallOrder[0];
    const logoutCallOrder = mockLogoutAction.mock.invocationCallOrder[0];
    expect(eventCallOrder).toBeLessThan(logoutCallOrder);
  });

  it('still calls logoutAction even if clipboard.writeText rejects', async () => {
    mockClipboardWriteText.mockRejectedValueOnce(new Error('Clipboard permission denied'));
    mockLogoutAction.mockResolvedValue(undefined);

    render(<LogoutButton />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await vi.waitFor(() => {
      expect(mockLogoutAction).toHaveBeenCalledOnce();
    });
  });
});
