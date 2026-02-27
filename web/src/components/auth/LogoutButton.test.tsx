import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogoutButton } from './LogoutButton';

// Mock logoutAction
const mockLogoutAction = vi.fn();
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

describe('LogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
});
