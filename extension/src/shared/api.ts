import { storage } from './storage';
import { captureException } from './sentry';
import type { AuthResponse, GenerateNoteInput, GeneratedNote } from './schemas';

// API response envelope types
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// API URL is set via environment variables at build time
// Development: VITE_API_URL=http://localhost:4000 (from .env.development)
// Production: VITE_API_URL=https://api.flashnote.co (from .env.production)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const ACCESS_TOKEN_EXPIRY_MS = 55 * 60 * 1000; // 55 minutes

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

// Custom event for auth invalidation - allows UI to react to forced logout
export const AUTH_INVALIDATED_EVENT = 'flashnote:auth-invalidated';

// Reasons for session ending - used by SessionAlert component
export type SessionEndReason =
  | 'session_invalidated'  // Password reset, token version mismatch
  | 'session_expired'      // Refresh token expired naturally
  | 'session_limit'        // Too many devices, oldest session kicked (MEDIUM-011)
  | 'session_revoked';     // Admin action or security event

// Retry configuration for transient failures
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1s, 2s, 4s with exponential backoff
  retryableStatusCodes: [500, 502, 503, 504, 520, 521, 522, 523, 524],
};

class ApiClient {
  /**
   * Determines if an error is retryable (network failure or 5xx server error)
   */
  private isRetryableError(error: unknown): boolean {
    // Network failures (fetch throws TypeError for network errors)
    if (error instanceof TypeError) {
      return true;
    }
    // Server errors (5xx)
    if (error instanceof ApiError) {
      return RETRY_CONFIG.retryableStatusCodes.includes(error.status);
    }
    return false;
  }

  /**
   * Sleeps for the specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async getToken(): Promise<string | null> {
    const auth = await storage.getAuth();
    if (!auth) return null;

    // Check if token is expired (with 60s buffer)
    if (Date.now() > auth.expiresAt - 60000) {
      return this.refreshToken(auth.refreshToken);
    }

    return auth.accessToken;
  }

  private async getCsrfToken(): Promise<string | null> {
    const auth = await storage.getAuth();
    return auth?.csrfToken ?? null;
  }

  private async refreshToken(refreshToken: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        await storage.clearAuth();
        return null;
      }

      const result = (await response.json()) as ApiResponse<AuthResponse>;
      if (!result.success) {
        await storage.clearAuth();
        return null;
      }

      const data = result.data;
      await storage.setAuth({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        csrfToken: data.csrfToken,
        expiresAt: Date.now() + ACCESS_TOKEN_EXPIRY_MS,
      });

      return data.accessToken;
    } catch (error) {
      captureException(error, {
        operation: 'token_refresh',
        errorType: 'network_error',
      });
      await storage.clearAuth();
      return null;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken();
    const csrfToken = await this.getCsrfToken();

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
        // Dispatch event FIRST to ensure UI updates regardless of storage errors
        window.dispatchEvent(new CustomEvent(AUTH_INVALIDATED_EVENT, {
          detail: { reason }
        }));

        // Then clear storage (non-critical if this fails - user will see login prompt anyway)
        try {
          await storage.clearAuth();
        } catch (storageError) {
          console.error('Failed to clear auth storage:', storageError);
        }
      }

      throw new ApiError(
        response.status,
        errorCode,
        errorMessage
      );
    }

    return result.data;
  }

  /**
   * Makes a request with automatic retry for transient failures.
   * Uses exponential backoff: 1s, 2s, 4s between retries.
   * Only retries on network errors and 5xx server errors.
   *
   * MEDIUM-014: Prevents lost work in clinical environments with unstable networks.
   */
  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    maxRetries: number = RETRY_CONFIG.maxRetries
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.request<T>(endpoint, options);
      } catch (error) {
        lastError = error;

        // Don't retry on non-retryable errors (4xx, auth errors, etc.)
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Don't retry after the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delayMs = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `Request to ${endpoint} failed (attempt ${attempt + 1}/${maxRetries + 1}), ` +
          `retrying in ${delayMs}ms...`
        );
        await this.sleep(delayMs);
      }
    }

    // All retries exhausted - report to Sentry (this indicates a real infrastructure problem)
    captureException(lastError, {
      endpoint,
      retriesAttempted: maxRetries,
      errorType: lastError instanceof ApiError ? 'server_error' : 'network_error',
    });
    throw lastError;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    await storage.setAuth({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      csrfToken: data.csrfToken,
      expiresAt: Date.now() + ACCESS_TOKEN_EXPIRY_MS,
    });

    return data;
  }

  async register(email: string, password: string, acceptedLegalTerms: boolean): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, acceptedLegalTerms }),
    });

    await storage.setAuth({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      csrfToken: data.csrfToken,
      expiresAt: Date.now() + ACCESS_TOKEN_EXPIRY_MS,
    });

    return data;
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
  }

  async generateNote(input: GenerateNoteInput): Promise<GeneratedNote> {
    // Use retry logic for note generation - this is critical for clinical UX
    // A transient network failure shouldn't lose the user's work
    return this.requestWithRetry<GeneratedNote>('/notes/generate', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.request('/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resendVerificationEmail(email: string): Promise<void> {
    await this.request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * Fetch fresh user data from GET /user/me without rotating tokens.
   * Lightweight alternative to refreshUser() for polling state changes
   * (subscription status, email verification) without session churn.
   */
  async fetchUser(): Promise<{ user: AuthResponse['user'] } | null> {
    try {
      const data = await this.request<{ user: AuthResponse['user'] }>('/user/me');

      // Update stored user data without touching tokens
      const auth = await storage.getAuth();
      if (auth) {
        await storage.setAuth({
          ...auth,
          user: data.user,
        });
      }

      return data;
    } catch {
      return null;
    }
  }

  /**
   * Force refresh the access token and get updated user data.
   * Rotates tokens and creates a new session - use fetchUser() for
   * lightweight status checks that don't need token rotation.
   */
  async refreshUser(): Promise<AuthResponse | null> {
    const auth = await storage.getAuth();
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
      await storage.setAuth({
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
  }
}

export const api = new ApiClient();
