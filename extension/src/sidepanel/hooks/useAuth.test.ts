import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from './useAuth';
import { storage } from '@/shared/storage';
import { api, AUTH_INVALIDATED_EVENT } from '@/shared/api';
import { setUser as setSentryUser, captureException } from '@/shared/sentry';
import { createMockStoredAuth, createMockAuthResponse, createMockUser } from '@/test/helpers';

// Mock storage and api
vi.mock('@/shared/storage', () => ({
  storage: {
    getAuth: vi.fn(),
    setAuth: vi.fn(),
    clearAuth: vi.fn(),
  },
}));

vi.mock('@/shared/api', () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    fetchUser: vi.fn(),
    refreshUser: vi.fn(),
  },
  AUTH_INVALIDATED_EVENT: 'flashnote:auth-invalidated',
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getAuth).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start with loading=true then resolve', async () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(true);
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should load user from chrome.storage on mount', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());

      const { result } = renderHook(() => useAuth());
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.user).not.toBeNull();
        expect(result.current.user!.email).toBe('test@example.com');
      });
    });

    it('should set Sentry user context on load', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());
      expect(setSentryUser).toHaveBeenCalledWith('test-user-id');
    });

    it('should capture Sentry exception on storage error', async () => {
      vi.mocked(storage.getAuth).mockRejectedValue(new Error('Storage corrupt'));

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ source: 'extension_storage' })
      );
    });
  });

  describe('login', () => {
    it('should call api.login and update user', async () => {
      const mockResponse = createMockAuthResponse();
      vi.mocked(api.login).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login('test@example.com', 'Password1');
      });

      expect(api.login).toHaveBeenCalledWith('test@example.com', 'Password1');
      expect(result.current.user).not.toBeNull();
      expect(result.current.user!.email).toBe('test@example.com');
    });
  });

  describe('register', () => {
    it('should call api.register and update user', async () => {
      const mockResponse = createMockAuthResponse();
      vi.mocked(api.register).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.register('new@example.com', 'Password1');
      });

      expect(api.register).toHaveBeenCalledWith('new@example.com', 'Password1');
      expect(result.current.user).not.toBeNull();
    });
  });

  describe('logout', () => {
    it('should clear user and storage', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      vi.mocked(api.logout).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(storage.clearAuth).toHaveBeenCalled();
    });

    it('should clear user even if api.logout fails', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      vi.mocked(api.logout).mockRejectedValue(new Error('Network'));

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(storage.clearAuth).toHaveBeenCalled();
    });
  });

  describe('fetchUser', () => {
    it('should fetch and update user', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      const updatedUser = createMockUser({ subscriptionStatus: 'active' });
      vi.mocked(api.fetchUser).mockResolvedValue({ user: updatedUser });

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      await act(async () => {
        await result.current.fetchUser();
      });

      expect(result.current.user!.subscriptionStatus).toBe('active');
    });

    it('should return null on error', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      vi.mocked(api.fetchUser).mockRejectedValue(new Error('Network'));

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      let returned: unknown;
      await act(async () => {
        returned = await result.current.fetchUser();
      });

      expect(returned).toBeNull();
    });

    it('should return null when response has no user', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      vi.mocked(api.fetchUser).mockResolvedValue(null);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      let returned: unknown;
      await act(async () => {
        returned = await result.current.fetchUser();
      });

      expect(returned).toBeNull();
    });
  });

  describe('refreshUser', () => {
    it('should refresh and update user', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      const refreshed = createMockAuthResponse({
        user: createMockUser({ subscriptionStatus: 'active' }),
      });
      vi.mocked(api.refreshUser).mockResolvedValue(refreshed);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user!.subscriptionStatus).toBe('active');
    });

    it('should return null on failure', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      vi.mocked(api.refreshUser).mockRejectedValue(new Error('Network'));

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      let returned: unknown;
      await act(async () => {
        returned = await result.current.refreshUser();
      });

      expect(returned).toBeNull();
    });

    it('should return null when response has no user', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      vi.mocked(api.refreshUser).mockResolvedValue(null);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      let returned: unknown;
      await act(async () => {
        returned = await result.current.refreshUser();
      });

      expect(returned).toBeNull();
    });
  });

  describe('auth invalidation event', () => {
    it('should clear user on AUTH_INVALIDATED_EVENT', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      act(() => {
        window.dispatchEvent(new CustomEvent(AUTH_INVALIDATED_EVENT));
      });

      expect(result.current.user).toBeNull();
    });
  });

  describe('visibility change refresh', () => {
    it('should fetch user when tab becomes visible after debounce period', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      vi.mocked(api.fetchUser).mockResolvedValue({ user: createMockUser() });

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      // Switch to fake timers after initial render settles
      vi.useFakeTimers();
      vi.mocked(api.fetchUser).mockClear();

      // Advance past debounce period (30s)
      await vi.advanceTimersByTimeAsync(31_000);

      // Simulate tab becoming visible
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(api.fetchUser).toHaveBeenCalledTimes(1);
    });

    it('should NOT fetch user when tab becomes hidden', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      vi.mocked(api.fetchUser).mockResolvedValue({ user: createMockUser() });

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      vi.useFakeTimers();
      vi.mocked(api.fetchUser).mockClear();

      await vi.advanceTimersByTimeAsync(31_000);

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(api.fetchUser).not.toHaveBeenCalled();
    });
  });

  describe('focus refresh', () => {
    it('should fetch user on focus event after debounce period', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      vi.mocked(api.fetchUser).mockResolvedValue({ user: createMockUser() });

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      vi.useFakeTimers();
      vi.mocked(api.fetchUser).mockClear();

      // Advance past debounce period (30s)
      await vi.advanceTimersByTimeAsync(31_000);

      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(api.fetchUser).toHaveBeenCalledTimes(1);
    });

    it('should debounce rapid focus events', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      vi.mocked(api.fetchUser).mockResolvedValue({ user: createMockUser() });

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      vi.useFakeTimers();
      vi.mocked(api.fetchUser).mockClear();

      // Fire multiple focus events rapidly (within 30s debounce)
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });
      await vi.advanceTimersByTimeAsync(100);
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      // Should only fetch once because debounce blocks subsequent calls
      expect(api.fetchUser).toHaveBeenCalledTimes(1);
    });

    it('should not set up listeners when no user', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(null);
      vi.mocked(api.fetchUser).mockResolvedValue({ user: createMockUser() });

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      vi.useFakeTimers();
      vi.mocked(api.fetchUser).mockClear();

      await vi.advanceTimersByTimeAsync(31_000);

      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(api.fetchUser).not.toHaveBeenCalled();
    });
  });

  describe('background refresh interval', () => {
    it('should fetch user every 5 minutes when authenticated', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      vi.mocked(api.fetchUser).mockResolvedValue({ user: createMockUser() });

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      vi.mocked(api.fetchUser).mockClear();

      // Advance 5 minutes
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(api.fetchUser).toHaveBeenCalledTimes(1);
    });

    it('should not set up interval when no user', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(null);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      vi.useFakeTimers();
      vi.mocked(api.fetchUser).mockClear();

      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
      expect(api.fetchUser).not.toHaveBeenCalled();
    });

    it('should clean up interval on unmount', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
      vi.mocked(api.fetchUser).mockResolvedValue({ user: createMockUser() });

      const { result, unmount } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      vi.mocked(api.fetchUser).mockClear();
      unmount();

      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
      expect(api.fetchUser).not.toHaveBeenCalled();
    });
  });
});
