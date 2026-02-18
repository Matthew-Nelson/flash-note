import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import { api, ApiError, AUTH_INVALIDATED_EVENT, isAllowedRedirectUrl } from './api';
import { storage } from './storage';
import {
  createMockStoredAuth,
  createMockAuthResponse,
  createMockApiResponse,
  createMockApiErrorResponse,
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

describe('Web API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getAuth).mockReturnValue(createMockStoredAuth());
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
    it('should call logout endpoint and clear auth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse(undefined)),
      });

      await api.logout();
      expect(storage.clearAuth).toHaveBeenCalled();
    });

    it('should clear auth even if server request fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      await expect(api.logout()).rejects.toThrow();
      expect(storage.clearAuth).toHaveBeenCalled();
    });
  });

  describe('token refresh', () => {
    it('should refresh token when expired and use new token for subsequent request', async () => {
      vi.mocked(storage.getAuth).mockReturnValue(
        createMockStoredAuth({ expiresAt: Date.now() - 1000 })
      );

      // Mock refresh endpoint with new token
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

      // Verify refresh was called first
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toContain('/auth/refresh');

      // Verify the subsequent request used the refreshed token
      const secondCall = mockFetch.mock.calls[1];
      const headers = (secondCall[1] as RequestInit | undefined)?.headers as
        | Record<string, string>
        | undefined;
      expect(headers?.Authorization).toBe('Bearer new-token');
    });

    it('should clear auth and capture Sentry on refresh network failure', async () => {
      vi.mocked(storage.getAuth).mockReturnValue(
        createMockStoredAuth({ expiresAt: Date.now() - 1000 })
      );
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      const result = await api.fetchUser();
      expect(result).toBeNull();
      expect(storage.clearAuth).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('should clear auth when refresh response is not ok', async () => {
      vi.mocked(storage.getAuth).mockReturnValue(
        createMockStoredAuth({ expiresAt: Date.now() - 1000 })
      );
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await api.fetchUser();
      expect(result).toBeNull();
      expect(storage.clearAuth).toHaveBeenCalled();
    });

    it('should clear auth when refresh response is not successful', async () => {
      vi.mocked(storage.getAuth).mockReturnValue(
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
      vi.mocked(storage.getAuth).mockReturnValue(
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

  describe('requestWithRetry (via createCheckoutSession)', () => {
    it('should retry on 500 errors with exponential backoff', async () => {
      vi.useFakeTimers();

      // Fail twice with 500, succeed on third
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve(createMockApiErrorResponse('server_error', 'Internal error')),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve(createMockApiErrorResponse('server_error', 'Internal error')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockApiResponse({ checkoutUrl: 'https://checkout.stripe.com/session' })),
        });

      const promise = api.createCheckoutSession('price_123');

      // Advance past first retry delay (1s)
      await vi.advanceTimersByTimeAsync(1000);
      // Advance past second retry delay (2s)
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/session');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should NOT retry on 4xx errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve(createMockApiErrorResponse('forbidden', 'Forbidden')),
      });

      await expect(api.createCheckoutSession('price_123')).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on non-retryable errors (e.g. JSON parse error)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      });

      await expect(api.createCheckoutSession('price_123')).rejects.toThrow(SyntaxError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      vi.useFakeTimers();

      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createMockApiResponse({ checkoutUrl: 'https://checkout.stripe.com/session' })),
        });

      const promise = api.createCheckoutSession('price_123');
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/session');
    });

    it('should capture Sentry on retry exhaustion', async () => {
      vi.useFakeTimers();

      // Fail 4 times (1 initial + 3 retries)
      for (let i = 0; i < 4; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve(createMockApiErrorResponse('server_error', 'Internal error')),
        });
      }

      // Capture the rejection immediately so it doesn't become unhandled
      let caughtError: unknown;
      const promise = api.createCheckoutSession('price_123').catch((e) => {
        caughtError = e;
      });

      // Advance through all retry delays: 1s, 2s, 4s
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await promise;
      expect(caughtError).toBeInstanceOf(ApiError);
      expect(Sentry.captureException).toHaveBeenCalled();
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
      vi.mocked(storage.getAuth).mockReturnValue(null);
      const result = await api.refreshUser();
      expect(result).toBeNull();
    });

    it('should return null on server error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const result = await api.refreshUser();
      expect(result).toBeNull();
    });

    it('should return null when response is not successful', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(
            createMockApiErrorResponse('invalid_token', 'Token expired')
          ),
      });

      const result = await api.refreshUser();
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));
      const result = await api.refreshUser();
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

  describe('createPortalSession', () => {
    it('should call portal endpoint with retry', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(
            createMockApiResponse({ portalUrl: 'https://billing.stripe.com/portal' })
          ),
      });

      const result = await api.createPortalSession();
      expect(result.portalUrl).toBe('https://billing.stripe.com/portal');
    });
  });

  describe('validateResetToken', () => {
    it('should call validate endpoint with encoded token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse({ valid: true })),
      });

      const result = await api.validateResetToken('my-token');
      expect(result.valid).toBe(true);
      expect(mockFetch.mock.calls[0][0]).toContain(
        '/auth/validate-reset-token?token=my-token'
      );
    });

    it('should throw ApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve(
            createMockApiErrorResponse('invalid_token', 'Token expired')
          ),
      });

      await expect(api.validateResetToken('bad')).rejects.toThrow(ApiError);
    });
  });

  describe('resetPassword', () => {
    it('should send reset request with token and password', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse(undefined)),
      });

      await api.resetPassword('reset-token', 'NewPassword1');

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('/auth/reset-password');
      const body = JSON.parse((fetchCall[1] as RequestInit).body as string) as Record<string, unknown>;
      expect(body.token).toBe('reset-token');
      expect(body.password).toBe('NewPassword1');
    });

    it('should throw ApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve(
            createMockApiErrorResponse('invalid_token', 'Token expired')
          ),
      });

      await expect(api.resetPassword('bad', 'Pass1234')).rejects.toThrow(ApiError);
    });
  });

  describe('verifyEmail', () => {
    it('should send verification request with token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockApiResponse({})),
      });

      const result = await api.verifyEmail('verify-token');
      expect(result).toEqual({});

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('/auth/verify-email');
      const body = JSON.parse((fetchCall[1] as RequestInit).body as string) as Record<string, unknown>;
      expect(body.token).toBe('verify-token');
    });

    it('should return alreadyVerified when present', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(createMockApiResponse({ alreadyVerified: true })),
      });

      const result = await api.verifyEmail('verify-token');
      expect(result.alreadyVerified).toBe(true);
    });

    it('should throw ApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve(
            createMockApiErrorResponse('invalid_token', 'Token expired')
          ),
      });

      await expect(api.verifyEmail('bad')).rejects.toThrow(ApiError);
    });
  });
});

describe('isAllowedRedirectUrl', () => {
  it('should allow checkout.stripe.com', () => {
    expect(isAllowedRedirectUrl('https://checkout.stripe.com/c/pay/session123')).toBe(true);
  });

  it('should allow billing.stripe.com', () => {
    expect(isAllowedRedirectUrl('https://billing.stripe.com/p/session/test')).toBe(true);
  });

  it('should reject non-Stripe domains', () => {
    expect(isAllowedRedirectUrl('https://evil.com/steal')).toBe(false);
  });

  it('should reject http protocol', () => {
    expect(isAllowedRedirectUrl('http://checkout.stripe.com/session')).toBe(false);
  });

  it('should reject javascript protocol', () => {
    expect(isAllowedRedirectUrl('javascript:alert(1)')).toBe(false);
  });

  it('should reject invalid URLs', () => {
    expect(isAllowedRedirectUrl('not-a-url')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isAllowedRedirectUrl('')).toBe(false);
  });

  it('should reject subdomain spoofing', () => {
    expect(isAllowedRedirectUrl('https://checkout.stripe.com.evil.com/pay')).toBe(false);
  });
});
