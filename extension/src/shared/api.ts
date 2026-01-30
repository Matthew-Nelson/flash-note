import { storage } from './storage';
import type { AuthResponse, GenerateNoteInput, GeneratedNote } from './schemas';

// API URL is set via environment variables at build time
// Development: VITE_API_URL=http://localhost:4000 (from .env.development)
// Production: VITE_API_URL=https://api.flashnote.com (from .env.production)
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

class ApiClient {
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

      const result = await response.json();
      const data = result.data as AuthResponse;

      await storage.setAuth({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        csrfToken: data.csrfToken,
        expiresAt: Date.now() + ACCESS_TOKEN_EXPIRY_MS,
      });

      return data.accessToken;
    } catch {
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

    const result = await response.json();

    if (!response.ok || !result.success) {
      const errorCode = result.error?.code ?? 'unknown_error';

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
        result.error?.message ?? 'An error occurred'
      );
    }

    return result.data as T;
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

  async register(email: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/register', {
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

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
  }

  async generateNote(input: GenerateNoteInput): Promise<GeneratedNote> {
    return this.request<GeneratedNote>('/notes/generate', {
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
   * Force refresh the access token and get updated user data.
   * Used to poll for email verification status changes.
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

      const result = await response.json();
      const data = result.data as AuthResponse;

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
