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
import type { User, AuthResponse, ApiResponse, SessionEndReason, UsageResponse } from './types';

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

// Mutex: prevents concurrent refresh token calls from racing
let refreshPromise: Promise<string | null> | null = null;

/**
 * Get current access token, refreshing if needed
 */
async function getToken(): Promise<string | null> {
  const auth = storage.getAuth();
  if (!auth) return null;

  // Check if token is expired (with 60s buffer)
  if (Date.now() > auth.expiresAt - 60000) {
    // Deduplicate: if a refresh is already in-flight, await it instead of
    // starting a second one (which would fail and clear the valid tokens
    // the first call stored)
    if (refreshPromise) {
      return refreshPromise;
    }
    refreshPromise = refreshToken(auth.refreshToken)
      .finally(() => { refreshPromise = null; });
    return refreshPromise;
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

    // SECURITY: Auto-logout on any 401 auth failure
    // - invalid_token: password was reset, session invalidated, token version mismatch
    // - missing_token: refresh failed (expired session), auth storage cleared
    if (response.status === 401 && (errorCode === 'invalid_token' || errorCode === 'missing_token')) {
      const reason: SessionEndReason = errorCode === 'missing_token' ? 'session_expired' : 'session_invalidated';
      dispatchAuthInvalidated(reason);
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
  async register(email: string, password: string, acceptedLegalTerms: boolean, inviteCode?: string): Promise<AuthResponse> {
    const body: Record<string, unknown> = { email, password, acceptedLegalTerms };
    if (inviteCode) {
      body.inviteCode = inviteCode;
    }
    const data = await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
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
   * Used for polling state changes (subscription status, email verification)
   * without session churn.
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

  /**
   * Fetch current month usage stats and organization context
   */
  async getUsage(): Promise<UsageResponse> {
    return request<UsageResponse>('/usage/me');
  },

  /**
   * Validate a password reset token
   */
  async validateResetToken(token: string): Promise<{ valid: boolean }> {
    return request<{ valid: boolean }>(`/auth/validate-reset-token?token=${encodeURIComponent(token)}`);
  },

  /**
   * Reset password using a valid reset token
   */
  async resetPassword(token: string, password: string): Promise<void> {
    await request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  /**
   * Verify email address using a verification token
   */
  async verifyEmail(token: string): Promise<{ alreadyVerified?: boolean }> {
    return request<{ alreadyVerified?: boolean }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
};
