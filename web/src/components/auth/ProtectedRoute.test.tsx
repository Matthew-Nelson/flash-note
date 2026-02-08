import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProtectedRoute } from './ProtectedRoute';

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: (): unknown => mockUseAuth(),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock LoadingSpinner
vi.mock('../ui', () => ({
  LoadingSpinner: () => <div data-testid="spinner">Loading...</div>,
}));

describe('ProtectedRoute', () => {
  it('should show loading spinner while auth is loading', () => {
    mockUseAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('should render children when authenticated', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('should redirect to login when not authenticated', async () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('should not render children while redirecting', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });

    const { container } = render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    expect(container.innerHTML).toBe('');
  });
});
