/**
 * Test helpers and factories for the web package.
 */
import type { User, StoredAuth, AuthResponse, ApiSuccessResponse, ApiErrorResponse } from '@/lib/types';

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    emailVerified: true,
    ...overrides,
  };
}

export function createMockStoredAuth(overrides: Partial<StoredAuth> = {}): StoredAuth {
  return {
    user: createMockUser(),
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    csrfToken: 'test-csrf-token',
    expiresAt: Date.now() + 55 * 60 * 1000,
    ...overrides,
  };
}

export function createMockAuthResponse(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    user: createMockUser(),
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    csrfToken: 'test-csrf-token',
    ...overrides,
  };
}

export function createMockApiResponse<T>(data: T): ApiSuccessResponse<T> {
  return { success: true, data };
}

export function createMockApiErrorResponse(
  code: string,
  message: string
): ApiErrorResponse {
  return {
    success: false,
    error: { code, message },
  };
}
