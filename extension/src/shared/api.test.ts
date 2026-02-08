import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { captureException } from '@/shared/sentry';
import { api, ApiError, AUTH_INVALIDATED_EVENT } from './api';
import { storage } from './storage';
import {
  createMockStoredAuth,
  createMockAuthResponse,
  createMockApiResponse,
  createMockApiErrorResponse,
  createMockGeneratedNote,
} from '@/test/helpers';

// Mock storage
vi.mock('./storage', () => ({
  storage: {
    getAuth: vi.fn(),
    setAuth: vi.fn(),
    clearAuth: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('Extension API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getAuth).mockResolvedValue(createMockStoredAuth());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ApiError', () => {
    it('should create an error with status, code, and message', () => {
      const error = new ApiError(401, 'invalid_token', 'Token expired');
      expect(error.status).toBe(401);
      expect(error.code).toBe('invalid_token');
      expect(error.message).toBe('Token expired');
      expect(error.name).toBe('ApiError');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('login', () => {
    it('should send credentials and store auth data', async () => {
      const mockResponse = createMockAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse(mockResponse)),
      });

      const result = await api.login('test@example.com', 'Password1');
      expect(result.user.email).toBe('test@example.com');
      expect(storage.setAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: mockResponse.accessToken,
          refreshToken: mockResponse.refreshToken,
          csrfToken: mockResponse.csrfToken,
        })
      );
    });

    it('should throw ApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve(
            createMockApiErrorResponse('invalid_credentials', 'Wrong password')
          ),
      });

      await expect(api.login('test@example.com', 'wrong')).rejects.toThrow(ApiError);
    });
  });

  describe('register', () => {
    it('should send registration data and store auth', async () => {
      const mockResponse = createMockAuthResponse();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse(mockResponse)),
      });

      const result = await api.register('new@example.com', 'Password1');
      expect(result.user).toBeDefined();
      expect(storage.setAuth).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should call logout endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse(undefined)),
      });

      await api.logout();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('token refresh', () => {
    it('should refresh token when expired', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(
        createMockStoredAuth({ expiresAt: Date.now() - 1000 })
      );

      const refreshResponse = createMockAuthResponse({ accessToken: 'new-token' });
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockApiResponse(refreshResponse)),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockApiResponse({ user: refreshResponse.user })),
        });

      await api.fetchUser();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall[0]).toContain('/auth/refresh');
    });

    it('should clear auth and capture Sentry on refresh network failure', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(
        createMockStoredAuth({ expiresAt: Date.now() - 1000 })
      );
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      const result = await api.fetchUser();
      expect(result).toBeNull();
      expect(storage.clearAuth).toHaveBeenCalled();
      expect(captureException).toHaveBeenCalled();
    });
  });

  describe('auth invalidation', () => {
    it('should dispatch auth-invalidated event on 401 + invalid_token', async () => {
      const eventHandler = vi.fn();
      window.addEventListener(AUTH_INVALIDATED_EVENT, eventHandler);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve(
            createMockApiErrorResponse('invalid_token', 'Token invalidated')
          ),
      });

      await expect(api.fetchUser()).resolves.toBeNull();
      expect(eventHandler).toHaveBeenCalled();
      expect(storage.clearAuth).toHaveBeenCalled();

      window.removeEventListener(AUTH_INVALIDATED_EVENT, eventHandler);
    });

    it('should NOT dispatch event on 401 with different error code', async () => {
      const eventHandler = vi.fn();
      window.addEventListener(AUTH_INVALIDATED_EVENT, eventHandler);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve(
            createMockApiErrorResponse('missing_token', 'No token provided')
          ),
      });

      await expect(api.fetchUser()).resolves.toBeNull();
      expect(eventHandler).not.toHaveBeenCalled();

      window.removeEventListener(AUTH_INVALIDATED_EVENT, eventHandler);
    });
  });

  describe('CSRF token', () => {
    it('should include X-CSRF-Token header in requests', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(
        createMockStoredAuth({ csrfToken: 'my-csrf-token' })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse({ user: createMockAuthResponse().user })),
      });

      await api.fetchUser();

      const fetchCall = mockFetch.mock.calls[0];
      const headers = (fetchCall[1] as RequestInit | undefined)?.headers as
        | Record<string, string>
        | undefined;
      expect(headers?.['X-CSRF-Token']).toBe('my-csrf-token');
    });
  });

  describe('generateNote (requestWithRetry)', () => {
    const input = {
      noteType: 'daily_note' as const,
      quickNotes: 'Patient reports improved mobility and decreased pain.',
    };

    it('should return generated note on success', async () => {
      const mockNote = createMockGeneratedNote();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse(mockNote)),
      });

      const result = await api.generateNote(input);
      expect(result.subjective).toBe(mockNote.subjective);
    });

    it('should retry on 500 errors with exponential backoff', async () => {
      vi.useFakeTimers();

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve(createMockApiErrorResponse('server_error', 'Internal error')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockApiResponse(createMockGeneratedNote())),
        });

      const promise = api.generateNote(input);
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;
      expect(result.subjective).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 4xx errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(createMockApiErrorResponse('validation_error', 'Invalid input')),
      });

      await expect(api.generateNote(input)).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      vi.useFakeTimers();

      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockApiResponse(createMockGeneratedNote())),
        });

      const promise = api.generateNote(input);
      await vi.advanceTimersByTimeAsync(1000);
      await promise;
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should capture Sentry on retry exhaustion', async () => {
      vi.useFakeTimers();

      for (let i = 0; i < 4; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve(createMockApiErrorResponse('server_error', 'Internal error')),
        });
      }

      // Capture the rejection immediately so it doesn't become unhandled
      let caughtError: unknown;
      const promise = api.generateNote(input).catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await promise;
      expect(caughtError).toBeInstanceOf(ApiError);
      expect(captureException).toHaveBeenCalled();
    });
  });

  describe('fetchUser', () => {
    it('should fetch user and update storage', async () => {
      const user = { id: 'u1', email: 'a@b.com', subscriptionStatus: 'active', trialEndsAt: null };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse({ user })),
      });

      const result = await api.fetchUser();
      expect(result).not.toBeNull();
      expect(result!.user.subscriptionStatus).toBe('active');
      expect(storage.setAuth).toHaveBeenCalled();
    });

    it('should return null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network'));
      const result = await api.fetchUser();
      expect(result).toBeNull();
    });
  });

  describe('refreshUser', () => {
    it('should refresh and update stored auth', async () => {
      const mockResponse = createMockAuthResponse({ accessToken: 'refreshed-token' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse(mockResponse)),
      });

      const result = await api.refreshUser();
      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe('refreshed-token');
      expect(storage.setAuth).toHaveBeenCalled();
    });

    it('should return null when no refresh token', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(null);
      const result = await api.refreshUser();
      expect(result).toBeNull();
    });

    it('should return null on server error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const result = await api.refreshUser();
      expect(result).toBeNull();
    });
  });
});
