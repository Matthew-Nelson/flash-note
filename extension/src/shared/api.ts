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
  // Mutex: prevents concurrent token refresh requests (H-9)
  private refreshPromise: Promise<string | null> | null = null;

  // AbortController for in-flight requests (M-18)
  private controller = new AbortController();

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
   * Aborts all in-flight requests and resets the controller.
   * Called on logout / forced auth invalidation.
   */
  abortAll(): void {
    this.controller.abort();
    this.controller = new AbortController();
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
      // Mutex: if a refresh is already in progress, await it instead of starting another
      if (this.refreshPromise) {
        return this.refreshPromise;
      }
      this.refreshPromise = this.refreshToken(auth.refreshToken)
        .finally(() => { this.refreshPromise = null; });
      return this.refreshPromise;
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
        signal: this.controller.signal,
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
      // Don't report intentional aborts (logout/forced-logout) to Sentry
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        captureException(error, {
          operation: 'token_refresh',
          errorType: 'network_error',
        });
      }
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
      signal: options.signal ?? this.controller.signal,
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

      // SECURITY: Auto-logout on invalid token (password was reset, session invalidated, etc.)
      if (response.status === 401 && errorCode === 'invalid_token') {
        // Dispatch event FIRST to ensure UI updates regardless of storage errors
        window.dispatchEvent(new CustomEvent(AUTH_INVALIDATED_EVENT, {
          detail: { reason: 'session_invalidated' }
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
    // Logout uses a standalone AbortController so it is never cancelled by abortAll()
    const logoutController = new AbortController();
    await this.request('/auth/logout', {
      method: 'POST',
      signal: logoutController.signal,
    });
  }

  async generateNote(input: GenerateNoteInput, signal?: AbortSignal): Promise<GeneratedNote> {
    // Use retry logic for note generation - this is critical for clinical UX
    // A transient network failure shouldn't lose the user's work
    return this.requestWithRetry<GeneratedNote>('/notes/generate', {
      method: 'POST',
      body: JSON.stringify(input),
      ...(signal && { signal }),
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
   * Uses the shared refresh mutex to avoid duplicate refresh calls.
   * Use fetchUser() for lightweight status checks that don't need token rotation.
   */
  async refreshUser(): Promise<AuthResponse | null> {
    const auth = await storage.getAuth();
    if (!auth?.refreshToken) return null;

    try {
      // Force a refresh by calling refreshToken through the mutex
      let newToken: string | null;
      if (this.refreshPromise) {
        newToken = await this.refreshPromise;
      } else {
        this.refreshPromise = this.refreshToken(auth.refreshToken)
          .finally(() => { this.refreshPromise = null; });
        newToken = await this.refreshPromise;
      }

      // Bail out if refresh failed — don't waste a request on /user/me without auth
      if (!newToken) return null;

      // Fetch updated user data with the fresh token
      const data = await this.request<{ user: AuthResponse['user'] }>('/user/me');
      const updatedAuth = await storage.getAuth();
      if (!updatedAuth) return null;

      await storage.setAuth({ ...updatedAuth, user: data.user });

      return {
        user: data.user,
        accessToken: updatedAuth.accessToken,
        refreshToken: updatedAuth.refreshToken,
        csrfToken: updatedAuth.csrfToken,
      };
    } catch {
      return null;
    }
  }
}

export const api = new ApiClient();
