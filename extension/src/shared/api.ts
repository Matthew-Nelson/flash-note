import { storage, type StoredAuth } from './storage';

// Use localhost in development, production URL otherwise
const API_BASE = import.meta.env.DEV
  ? 'http://localhost:4000'
  : 'https://api.flashnote.com';

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

interface AuthResponse {
  user: {
    id: string;
    email: string;
    subscriptionStatus: string;
    trialEndsAt: string;
  };
  accessToken: string;
  refreshToken: string;
}

interface GenerateNoteInput {
  noteType: string;
  patientContext?: string;
  quickNotes: string;
}

interface GeneratedNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  metadata: {
    model: string;
    tokensUsed: number;
    generationTimeMs: number;
  };
}

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

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new ApiError(
        response.status,
        result.error?.code ?? 'unknown_error',
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
}

export const api = new ApiClient();
