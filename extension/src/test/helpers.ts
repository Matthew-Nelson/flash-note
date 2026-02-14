/**
 * Test helpers and factories for the extension package.
 */
import type { StoredAuth, StoredUser, StoredPreferences } from '@/shared/storage';
import type { GeneratedNote, AuthResponse } from '@/shared/schemas';

export function createMockUser(overrides: Partial<StoredUser> = {}): StoredUser {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    emailVerified: true,
    organizationId: null,
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

export function createMockPreferences(overrides: Partial<StoredPreferences> = {}): StoredPreferences {
  return {
    defaultNoteType: 'daily_note',
    showFloatingBadge: true,
    ...overrides,
  };
}

export function createMockGeneratedNote(overrides: Partial<GeneratedNote> = {}): GeneratedNote {
  return {
    subjective: 'Patient reports improved mobility.',
    objective: 'ROM: 120 degrees flexion.',
    assessment: 'Patient making good progress.',
    plan: 'Continue current treatment plan.',
    ...overrides,
  };
}

export function createMockApiResponse<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

export function createMockApiErrorResponse(
  code: string,
  message: string
): { success: false; error: { code: string; message: string } } {
  return {
    success: false,
    error: { code, message },
  };
}
