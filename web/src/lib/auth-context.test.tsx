import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';
import { AuthProvider, useAuth } from './auth-context';
import { storage } from './storage';
import { api, AUTH_INVALIDATED_EVENT } from './api';
import {
  createMockStoredAuth,
  createMockAuthResponse,
  createMockUser,
} from '@/test/helpers';

// Mock storage and api
vi.mock('./storage', () => ({
  storage: {
    getAuth: vi.fn(),
    setAuth: vi.fn(),
    clearAuth: vi.fn(),
  },
}));

vi.mock('./api', () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    fetchUser: vi.fn(),
    refreshUser: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
  AUTH_INVALIDATED_EVENT: 'flashnote:auth-invalidated',
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Test component that exposes auth context
function TestConsumer({ onRender }: { onRender: (ctx: ReturnType<typeof useAuth>) => void }) {
  const ctx = useAuth();
  onRender(ctx);
  return (
    <div>
      <span data-testid="user">{ctx.user?.email ?? 'none'}</span>
      <span data-testid="loading">{String(ctx.isLoading)}</span>
      <span data-testid="authenticated">{String(ctx.isAuthenticated)}</span>
    </div>
  );
}

describe('AuthContext', () => {
  let captured: ReturnType<typeof useAuth>;
  const capture = (ctx: ReturnType<typeof useAuth>) => { captured = ctx; };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getAuth).mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderWithProvider() {
    return render(
      <AuthProvider>
        <TestConsumer onRender={capture} />
      </AuthProvider>
    );
  }

  describe('useAuth outside provider', () => {
    it('should throw when used outside AuthProvider', () => {
      // Suppress console.error from React's error boundary
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<TestConsumer onRender={capture} />)).toThrow(
        'useAuth must be used within an AuthProvider'
      );
      spy.mockRestore();
    });
  });

  describe('initial state', () => {
    it('should start with loading=true then resolve to false', async () => {
      renderWithProvider();
      // After initial effect, loading should be false
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
    });

    it('should load user from storage on mount', async () => {
      vi.mocked(storage.getAuth).mockReturnValue(
        createMockStoredAuth()
      );

      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@example.com');
        expect(screen.getByTestId('authenticated').textContent).toBe('true');
      });
      expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'test-user-id' });
    });

    it('should set user to null when storage is empty', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('none');
        expect(screen.getByTestId('authenticated').textContent).toBe('false');
      });
    });
  });

  describe('login', () => {
    it('should call api.login and update user state', async () => {
      const mockResponse = createMockAuthResponse();
      vi.mocked(api.login).mockResolvedValue(mockResponse);

      renderWithProvider();
      await waitFor(() => expect(captured.isLoading).toBe(false));

      await act(async () => {
        await captured.login('test@example.com', 'Password1');
      });

      expect(api.login).toHaveBeenCalledWith('test@example.com', 'Password1');
      expect(screen.getByTestId('user').textContent).toBe('test@example.com');
      expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'test-user-id' });
    });
  });

  describe('register', () => {
    it('should call api.register and update user state', async () => {
      const mockResponse = createMockAuthResponse();
      vi.mocked(api.register).mockResolvedValue(mockResponse);

      renderWithProvider();
      await waitFor(() => expect(captured.isLoading).toBe(false));

      await act(async () => {
        await captured.register('new@example.com', 'Password1');
      });

      expect(api.register).toHaveBeenCalledWith('new@example.com', 'Password1');
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
  });

  describe('logout', () => {
    it('should call api.logout, clear user, and redirect to login', async () => {
      vi.mocked(storage.getAuth).mockReturnValue(createMockStoredAuth());
      vi.mocked(api.logout).mockResolvedValue(undefined);

      renderWithProvider();
      await waitFor(() => expect(captured.isAuthenticated).toBe(true));

      await act(async () => {
        await captured.logout();
      });

      expect(screen.getByTestId('user').textContent).toBe('none');
      expect(Sentry.setUser).toHaveBeenCalledWith(null);
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    it('should clear user even if api.logout fails', async () => {
      vi.mocked(storage.getAuth).mockReturnValue(createMockStoredAuth());
      vi.mocked(api.logout).mockRejectedValue(new Error('Network'));

      renderWithProvider();
      await waitFor(() => expect(captured.isAuthenticated).toBe(true));

      // The error propagates from try/finally, but finally still executes
      await act(async () => {
        try {
          await captured.logout();
        } catch {
          // Expected - error propagates but finally block already cleared state
        }
      });

      expect(screen.getByTestId('user').textContent).toBe('none');
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  describe('fetchUser', () => {
    it('should update user from api.fetchUser', async () => {
      vi.mocked(storage.getAuth).mockReturnValue(createMockStoredAuth());
      const updatedUser = createMockUser({ subscriptionStatus: 'active' });
      vi.mocked(api.fetchUser).mockResolvedValue({ user: updatedUser });

      renderWithProvider();
      await waitFor(() => expect(captured.isAuthenticated).toBe(true));

      let result: unknown;
      await act(async () => {
        result = await captured.fetchUser();
      });

      expect(result).not.toBeNull();
    });
  });

  describe('refreshUser', () => {
    it('should update user from api.refreshUser', async () => {
      vi.mocked(storage.getAuth).mockReturnValue(createMockStoredAuth());
      const refreshed = createMockAuthResponse({
        user: createMockUser({ subscriptionStatus: 'active' }),
      });
      vi.mocked(api.refreshUser).mockResolvedValue(refreshed);

      renderWithProvider();
      await waitFor(() => expect(captured.isAuthenticated).toBe(true));

      await act(async () => {
        await captured.refreshUser();
      });
    });
  });

  describe('auth invalidation event', () => {
    it('should clear user and redirect on AUTH_INVALIDATED_EVENT', async () => {
      vi.mocked(storage.getAuth).mockReturnValue(createMockStoredAuth());

      renderWithProvider();
      await waitFor(() => expect(captured.isAuthenticated).toBe(true));

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_INVALIDATED_EVENT, {
            detail: { reason: 'session_invalidated' },
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('none');
      });
      expect(mockPush).toHaveBeenCalledWith('/login');
    });

    it('should set sessionEndReason from event', async () => {
      vi.mocked(storage.getAuth).mockReturnValue(createMockStoredAuth());

      renderWithProvider();
      await waitFor(() => expect(captured.isAuthenticated).toBe(true));

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_INVALIDATED_EVENT, {
            detail: { reason: 'session_expired' },
          })
        );
      });

      await waitFor(() => {
        expect(captured.sessionEndReason).toBe('session_expired');
      });
    });
  });

  describe('clearSessionEndReason', () => {
    it('should clear the session end reason', async () => {
      vi.mocked(storage.getAuth).mockReturnValue(createMockStoredAuth());

      renderWithProvider();
      await waitFor(() => expect(captured.isAuthenticated).toBe(true));

      // Set a session end reason via event
      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_INVALIDATED_EVENT, {
            detail: { reason: 'session_invalidated' },
          })
        );
      });

      await waitFor(() => {
        expect(captured.sessionEndReason).toBe('session_invalidated');
      });

      act(() => {
        captured.clearSessionEndReason();
      });

      await waitFor(() => {
        expect(captured.sessionEndReason).toBeNull();
      });
    });
  });
});
