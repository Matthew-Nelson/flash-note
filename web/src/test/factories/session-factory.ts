/**
 * Test factory for SessionData — the shape getSession() resolves to.
 */
import type { SessionData } from '@/server/types';

export function createMockSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 'session-uuid',
    userId: 'user-uuid',
    email: 'therapist@example.com',
    subscriptionStatus: 'active',
    // Relative, so a trialing session built from defaults is still in its trial
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    emailVerified: true,
    organizationId: null,
    ...overrides,
  };
}
