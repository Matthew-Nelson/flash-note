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

      const result = await api.register('new@example.com', 'Password1', true);
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
    it('should refresh token when expired and store updated CSRF token', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(
        createMockStoredAuth({ expiresAt: Date.now() - 1000 })
      );

      const refreshResponse = createMockAuthResponse({
        accessToken: 'new-token',
        csrfToken: 'new-csrf-token',
      });
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

      // Verify the new CSRF token was stored alongside the new access token
      expect(storage.setAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'new-token',
          csrfToken: 'new-csrf-token',
        })
      );
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

    it('should dispatch auth-invalidated event with session_expired on 401 + missing_token', async () => {
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
      expect(eventHandler).toHaveBeenCalled();
      const event = eventHandler.mock.calls[0][0] as CustomEvent<{ reason: string }>;
      expect(event.detail.reason).toBe('session_expired');
      expect(storage.clearAuth).toHaveBeenCalled();

      window.removeEventListener(AUTH_INVALIDATED_EVENT, eventHandler);
    });

    it('should dispatch with session_invalidated reason on 401 + invalid_token', async () => {
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
      const event = eventHandler.mock.calls[0][0] as CustomEvent<{ reason: string }>;
      expect(event.detail.reason).toBe('session_invalidated');

      window.removeEventListener(AUTH_INVALIDATED_EVENT, eventHandler);
    });

    it('should NOT dispatch event on 401 with unrelated error code', async () => {
      const eventHandler = vi.fn();
      window.addEventListener(AUTH_INVALIDATED_EVENT, eventHandler);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve(
            createMockApiErrorResponse('invalid_credentials', 'Wrong password')
          ),
      });

      await expect(api.login('test@example.com', 'wrong')).rejects.toThrow(ApiError);
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

    it('should report network_error on retry exhaustion from network failures', async () => {
      vi.useFakeTimers();

      for (let i = 0; i < 4; i++) {
        mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      }

      let caughtError: unknown;
      const promise = api.generateNote(input).catch((e) => {
        caughtError = e;
      });

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await promise;
      expect(caughtError).toBeInstanceOf(TypeError);
      expect(captureException).toHaveBeenCalledWith(
        expect.any(TypeError),
        expect.objectContaining({ errorType: 'network_error' })
      );
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

    it('should skip storage update when getAuth returns null after fetch', async () => {
      const user = { id: 'u1', email: 'a@b.com', subscriptionStatus: 'active', trialEndsAt: null };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse({ user })),
      });

      vi.mocked(storage.getAuth)
        .mockResolvedValueOnce(createMockStoredAuth()) // for getToken()
        .mockResolvedValueOnce(createMockStoredAuth()) // for getCsrfToken()
        .mockResolvedValueOnce(null);                   // for fetchUser() storage check

      const result = await api.fetchUser();
      expect(result).not.toBeNull();
      expect(storage.setAuth).not.toHaveBeenCalled();
    });
  });

  describe('token refresh edge cases', () => {
    it('should clear auth when refresh response is not ok', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(
        createMockStoredAuth({ expiresAt: Date.now() - 1000 })
      );
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await api.fetchUser();
      expect(result).toBeNull();
      expect(storage.clearAuth).toHaveBeenCalled();
    });

    it('should clear auth when refresh response is not successful', async () => {
      vi.mocked(storage.getAuth).mockResolvedValue(
        createMockStoredAuth({ expiresAt: Date.now() - 1000 })
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(
            createMockApiErrorResponse('invalid_token', 'Refresh token expired')
          ),
      });

      const result = await api.fetchUser();
      expect(result).toBeNull();
      expect(storage.clearAuth).toHaveBeenCalled();
    });
  });

  describe('auth invalidation storage error', () => {
    it('should still throw ApiError even if clearAuth fails', async () => {
      vi.mocked(storage.clearAuth).mockRejectedValueOnce(new Error('Storage error'));

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve(
            createMockApiErrorResponse('invalid_token', 'Token invalidated')
          ),
      });

      const result = await api.fetchUser();
      expect(result).toBeNull();
    });
  });

  describe('requestPasswordReset', () => {
    it('should send password reset request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse(undefined)),
      });

      await api.requestPasswordReset('user@example.com');

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('/auth/request-password-reset');
      const body = JSON.parse((fetchCall[1] as RequestInit).body as string) as Record<string, unknown>;
      expect(body.email).toBe('user@example.com');
    });

    it('should throw ApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve(
            createMockApiErrorResponse('invalid_request', 'Invalid email')
          ),
      });

      await expect(api.requestPasswordReset('bad')).rejects.toThrow(ApiError);
    });
  });

  describe('resendVerificationEmail', () => {
    it('should send verification email request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse(undefined)),
      });

      await api.resendVerificationEmail('user@example.com');

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('/auth/resend-verification');
      const body = JSON.parse((fetchCall[1] as RequestInit).body as string) as Record<string, unknown>;
      expect(body.email).toBe('user@example.com');
    });

    it('should throw ApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve(
            createMockApiErrorResponse('rate_limit_exceeded', 'Too many requests')
          ),
      });

      await expect(api.resendVerificationEmail('user@example.com')).rejects.toThrow(ApiError);
    });
  });

  describe('isRetryableError', () => {
    it('should NOT retry on non-retryable errors (e.g. JSON parse error)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      });

      await expect(api.generateNote({
        noteType: 'daily_note',
        quickNotes: 'Patient reports improved mobility',
      })).rejects.toThrow(SyntaxError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('unknown error response format', () => {
    it('should use unknown_error code for malformed error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}), // No success field
      });

      await expect(api.logout()).rejects.toMatchObject({
        code: 'unknown_error',
        message: 'An error occurred',
      });
    });
  });

});
