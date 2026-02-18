import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import VerifyEmailPage from './page';
import { api } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...original,
    api: {
      verifyEmail: vi.fn(),
    },
  };
});

const mockFetchUser = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    fetchUser: mockFetchUser,
  }),
}));

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('token=verify-token') as ReturnType<typeof useSearchParams>
    );
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
    vi.mocked(api.verifyEmail).mockReturnValue(new Promise(() => {}) as Promise<{ alreadyVerified?: boolean }>);
    render(<VerifyEmailPage />);
    expect(screen.getByText('Verifying your email...')).toBeInTheDocument();
  });

  it('should show success after verification', async () => {
    vi.mocked(api.verifyEmail).mockResolvedValueOnce({});

    render(<VerifyEmailPage />);
    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeInTheDocument();
    });
    expect(api.verifyEmail).toHaveBeenCalledWith('verify-token');
  });

  it('should show already verified state', async () => {
    vi.mocked(api.verifyEmail).mockResolvedValueOnce({ alreadyVerified: true });

    render(<VerifyEmailPage />);
    await waitFor(() => {
      expect(screen.getByText('Already Verified')).toBeInTheDocument();
    });
  });

  it('should show curated error on failure', async () => {
    vi.mocked(api.verifyEmail).mockRejectedValueOnce(new Error('Server error'));

    render(<VerifyEmailPage />);
    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Invalid or expired verification link. Please request a new one.')
    ).toBeInTheDocument();
  });

  it('should render request new link button on error', async () => {
    vi.mocked(api.verifyEmail).mockRejectedValueOnce(new Error('fail'));

    render(<VerifyEmailPage />);
    await waitFor(() => {
      expect(screen.getByText('Request a new verification link')).toBeInTheDocument();
    });
    expect(screen.getByText('Request a new verification link').closest('a')).toHaveAttribute(
      'href',
      '/resend-verification'
    );
  });
});
