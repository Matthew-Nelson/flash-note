/**
 * API Client
 *
 * HTTP client for FlashNote backend with:
 * - Automatic token refresh (55-minute expiry with 5-minute buffer)
 * - CSRF token handling
 * - Exponential backoff retry for transient failures
 * - Auth invalidation events for forced logout
 *
 * Ported from extension/src/shared/api.ts for consistency.
 */

import * as Sentry from '@sentry/nextjs';
import { storage } from './storage';
import type { User, AuthResponse, ApiResponse, SessionEndReason } from './types';

// API URL from environment or default to localhost
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// 55 minutes in ms (5 min buffer before 1hr backend expiry)
const ACCESS_TOKEN_EXPIRY_MS = 55 * 60 * 1000;

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Custom event for auth invalidation - allows UI to react to forced logout
 */
export const AUTH_INVALIDATED_EVENT = 'flashnote:auth-invalidated';

/**
 * Dispatch auth invalidation event
 */
function dispatchAuthInvalidated(reason: SessionEndReason): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(AUTH_INVALIDATED_EVENT, {
        detail: { reason },
      })
    );
  }
}

/**
 * Retry configuration for transient failures
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1s, 2s, 4s with exponential backoff
  retryableStatusCodes: [500, 502, 503, 504, 520, 521, 522, 523, 524],
};

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // Network failures
    return true;
  }
  if (error instanceof ApiError) {
    return RETRY_CONFIG.retryableStatusCodes.includes(error.status);
  }
  return false;
}

/**
 * Get current access token, refreshing if needed
 */
async function getToken(): Promise<string | null> {
  const auth = storage.getAuth();
  if (!auth) return null;

  // Check if token is expired (with 60s buffer)
  if (Date.now() > auth.expiresAt - 60000) {
    return refreshToken(auth.refreshToken);
  }

  return auth.accessToken;
}

/**
 * Get CSRF token from storage
 */
function getCsrfToken(): string | null {
  const auth = storage.getAuth();
  return auth?.csrfToken ?? null;
}

/**
 * Refresh access token using refresh token
 */
async function refreshToken(refreshTokenValue: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    });

    if (!response.ok) {
      storage.clearAuth();
      return null;
    }

    const result = (await response.json()) as ApiResponse<AuthResponse>;
    if (!result.success) {
      storage.clearAuth();
      return null;
    }

    const data = result.data;
    storage.setAuth({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      csrfToken: data.csrfToken,
      expiresAt: Date.now() + ACCESS_TOKEN_EXPIRY_MS,
    });

    return data.accessToken;
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        source: 'token_refresh',
        errorType: 'refresh_network_failure',
      },
    });
    storage.clearAuth();
    return null;
  }
}

/**
 * Make authenticated API request
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const csrfToken = getCsrfToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      ...options.headers,
    },
  });

  const result = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !result.success) {
    const errorCode = result.success === false ? result.error.code : 'unknown_error';
    const errorMessage = result.success === false ? result.error.message : 'An error occurred';

    // SECURITY: Auto-logout on invalid token
    if (response.status === 401 && errorCode === 'invalid_token') {
      dispatchAuthInvalidated('session_invalidated');
      storage.clearAuth();
    }

    throw new ApiError(response.status, errorCode, errorMessage);
  }

  return result.data;
}

/**
 * Make request with automatic retry for transient failures
 */
async function requestWithRetry<T>(
  endpoint: string,
  options: RequestInit = {},
  maxRetries: number = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await request<T>(endpoint, options);
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt === maxRetries) {
        Sentry.captureException(lastError, {
          extra: {
            source: 'request_with_retry',
            errorType: 'retry_exhausted',
            endpoint,
            retriesAttempted: maxRetries,
          },
        });
        break;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * API client singleton
 */
export const api = {
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    storage.setAuth({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      csrfToken: data.csrfToken,
      expiresAt: Date.now() + ACCESS_TOKEN_EXPIRY_MS,
    });

    return data;
  },

  /**
   * Register new account
   */
  async register(email: string, password: string, acceptedLegalTerms: boolean): Promise<AuthResponse> {
    const data = await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, acceptedLegalTerms }),
    });

    storage.setAuth({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      csrfToken: data.csrfToken,
      expiresAt: Date.now() + ACCESS_TOKEN_EXPIRY_MS,
    });

    return data;
  },

  /**
   * Logout current session
   */
  async logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      // Always clear local auth, even if server request fails
      storage.clearAuth();
    }
  },

  /**
   * Fetch fresh user data from GET /user/me without rotating tokens.
   * Lightweight alternative to refreshUser() for polling state changes
   * (subscription status, email verification) without session churn.
   */
  async fetchUser(): Promise<{ user: User } | null> {
    try {
      const data = await request<{ user: User }>('/user/me');

      // Update stored user data without touching tokens
      const auth = storage.getAuth();
      if (auth) {
        storage.setAuth({
          ...auth,
          user: data.user,
        });
      }

      return data;
    } catch {
      return null;
    }
  },

  /**
   * Force refresh user data by rotating tokens.
   * Creates a new session - use fetchUser() for lightweight status checks.
   */
  async refreshUser(): Promise<AuthResponse | null> {
    const auth = storage.getAuth();
    if (!auth?.refreshToken) return null;

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const result = (await response.json()) as ApiResponse<AuthResponse>;
      if (!result.success) {
        return null;
      }

      const data = result.data;
      storage.setAuth({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        csrfToken: data.csrfToken,
        expiresAt: Date.now() + ACCESS_TOKEN_EXPIRY_MS,
      });

      return data;
    } catch {
      return null;
    }
  },

  /**
   * Request password reset email
   */
  async requestPasswordReset(email: string): Promise<void> {
    await request('/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    await request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  /**
   * Create Stripe checkout session and return redirect URL
   * Requires authenticated user with verified email
   */
  async createCheckoutSession(priceId: string): Promise<{ checkoutUrl: string }> {
    return requestWithRetry('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId }),
    });
  },

  /**
   * Create Stripe customer portal session and return redirect URL
   * Requires authenticated user with active subscription
   */
  async createPortalSession(): Promise<{ portalUrl: string }> {
    return requestWithRetry('/billing/portal', {
      method: 'POST',
    });
  },
};
