import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useSearchParams, useRouter } from 'next/navigation';
import VerifyEmailPage from './page';

const mockVerifyEmailAction = vi.hoisted(() => vi.fn());

vi.mock('@/actions/auth', () => ({
  verifyEmailAction: mockVerifyEmailAction,
}));

vi.mock('@/components/BetaBadge', () => ({
  BetaBadge: () => <span data-testid="beta-badge">BETA</span>,
}));

const mockPush = vi.fn();

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('token=verify-token') as ReturnType<typeof useSearchParams>
    );
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
      bfcacheId: '',
    });
  });

  it('should show error when no token provided', async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );

    render(<VerifyEmailPage />);
    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeInTheDocument();
    });
    expect(screen.getByText('No verification token provided')).toBeInTheDocument();
  });

  it('should show verifying state initially', () => {
    mockVerifyEmailAction.mockReturnValue(new Promise(() => {}));
    render(<VerifyEmailPage />);
    expect(screen.getByText('Verifying your email...')).toBeInTheDocument();
  });

  it('should show success after verification', async () => {
    mockVerifyEmailAction.mockResolvedValueOnce({ success: true });

    render(<VerifyEmailPage />);
    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeInTheDocument();
    });
    expect(mockVerifyEmailAction).toHaveBeenCalledTimes(1);
    const formData = mockVerifyEmailAction.mock.calls[0][0] as FormData;
    expect(formData.get('token')).toBe('verify-token');
  });

  it('should show already verified state', async () => {
    mockVerifyEmailAction.mockResolvedValueOnce({ success: true, data: { alreadyVerified: true } });

    render(<VerifyEmailPage />);
    await waitFor(() => {
      expect(screen.getByText('Already Verified')).toBeInTheDocument();
    });
  });

  it('should show curated error on action failure', async () => {
    mockVerifyEmailAction.mockResolvedValueOnce({ success: false, error: 'invalid_token' });

    render(<VerifyEmailPage />);
    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Invalid or expired verification link. Please request a new one.')
    ).toBeInTheDocument();
  });

  it('should show curated error on unexpected exception', async () => {
    mockVerifyEmailAction.mockRejectedValueOnce(new Error('Server error'));

    render(<VerifyEmailPage />);
    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Invalid or expired verification link. Please request a new one.')
    ).toBeInTheDocument();
  });

  it('should render request new link button on error', async () => {
    mockVerifyEmailAction.mockRejectedValueOnce(new Error('fail'));

    render(<VerifyEmailPage />);
    await waitFor(() => {
      expect(screen.getByText('Request a new verification link')).toBeInTheDocument();
    });
    expect(screen.getByText('Request a new verification link').closest('a')).toHaveAttribute(
      'href',
      '/resend-verification'
    );
  });

  it('should auto-redirect to dashboard after successful verification', async () => {
    mockVerifyEmailAction.mockResolvedValueOnce({ success: true });

    render(<VerifyEmailPage />);
    await waitFor(() => {
      expect(screen.getByText('Redirecting...')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    }, { timeout: 3000 });
  });

  it('should auto-redirect to dashboard for already-verified email', async () => {
    mockVerifyEmailAction.mockResolvedValueOnce({ success: true, data: { alreadyVerified: true } });

    render(<VerifyEmailPage />);
    await waitFor(() => {
      expect(screen.getByText('Redirecting...')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    }, { timeout: 3000 });
  });
});
