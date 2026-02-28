import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordResetSection } from './PasswordResetSection';

// Mock requestPasswordResetAction
const mockRequestPasswordResetAction = vi.fn();
vi.mock('@/actions/auth', () => ({
  requestPasswordResetAction: (formData: FormData): unknown =>
    mockRequestPasswordResetAction(formData),
}));

// Mock UI components
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    loading,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} disabled={disabled || loading} {...props}>
      {children}
    </button>
  ),
  Alert: ({
    children,
    variant,
    onDismiss,
    className,
  }: {
    children: React.ReactNode;
    variant: string;
    onDismiss?: () => void;
    className?: string;
  }) => (
    <div data-testid={`alert-${variant}`} className={className}>
      {children}
      {onDismiss && <button onClick={onDismiss}>dismiss</button>}
    </div>
  ),
}));

describe('PasswordResetSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders send button', () => {
    render(<PasswordResetSection email="test@clinic.com" />);
    expect(screen.getByText('Send Password Reset Email')).toBeInTheDocument();
  });

  it('shows success alert after successful send', async () => {
    mockRequestPasswordResetAction.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(<PasswordResetSection email="test@clinic.com" />);
    await user.click(screen.getByText('Send Password Reset Email'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-success')).toHaveTextContent(
        'Password reset email sent!'
      );
    });
  });

  it('passes email in FormData to action', async () => {
    mockRequestPasswordResetAction.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(<PasswordResetSection email="jane@clinic.com" />);
    await user.click(screen.getByText('Send Password Reset Email'));

    await waitFor(() => {
      expect(mockRequestPasswordResetAction).toHaveBeenCalledOnce();
    });
    const formData = mockRequestPasswordResetAction.mock.calls[0][0] as FormData;
    expect(formData.get('email')).toBe('jane@clinic.com');
  });

  it('shows rate limit error message', async () => {
    mockRequestPasswordResetAction.mockResolvedValue({
      success: false,
      error: 'rate_limit_exceeded',
    });
    const user = userEvent.setup();

    render(<PasswordResetSection email="test@clinic.com" />);
    await user.click(screen.getByText('Send Password Reset Email'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-error')).toHaveTextContent(
        'Too many requests. Please try again later.'
      );
    });
  });

  it('shows generic error for unknown error codes', async () => {
    mockRequestPasswordResetAction.mockResolvedValue({
      success: false,
      error: 'internal_error',
    });
    const user = userEvent.setup();

    render(<PasswordResetSection email="test@clinic.com" />);
    await user.click(screen.getByText('Send Password Reset Email'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-error')).toHaveTextContent(
        'Failed to send password reset email. Please try again.'
      );
    });
  });

  it('dismisses error on dismiss click', async () => {
    mockRequestPasswordResetAction.mockResolvedValue({
      success: false,
      error: 'internal_error',
    });
    const user = userEvent.setup();

    render(<PasswordResetSection email="test@clinic.com" />);
    await user.click(screen.getByText('Send Password Reset Email'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-error')).toBeInTheDocument();
    });

    await user.click(screen.getByText('dismiss'));

    expect(screen.queryByTestId('alert-error')).not.toBeInTheDocument();
  });
});
