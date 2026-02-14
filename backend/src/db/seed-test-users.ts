/**
 * Test seed data constants.
 *
 * Single source of truth for all test entities. Used by:
 * - backend/src/db/seed-test.ts (database seeding)
 * - web/tests/e2e/ (E2E test fixtures)
 * - extension/tests/e2e/ (E2E test fixtures)
 *
 * All test users share the same password for simplicity.
 * All dates are computed dynamically so re-seeding always produces valid state.
 *
 * IMPORTANT: This file must NOT import any backend modules (no db, no config).
 * It is imported by test tooling that may not have the full backend available.
 */

// ─── Users ───────────────────────────────────────────────────────────────────

export interface TestUser {
  email: string;
  password: string;
  emailVerified: boolean;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
}

const SHARED_PASSWORD = 'TestPassword123';

export const TEST_USERS = {
  /**
   * Primary test user. Verified, active trial, clean state.
   * Used by all existing happy-path E2E tests.
   */
  PRIMARY: {
    email: 'test@example.com',
    password: SHARED_PASSWORD,
    emailVerified: true,
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
  },

  /**
   * User whose free trial has expired. Verified but no subscription.
   * Used by: subscription enforcement tests (should get 402).
   */
  EXPIRED_TRIAL: {
    email: 'expired-trial@test.example.com',
    password: SHARED_PASSWORD,
    emailVerified: true,
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // expired yesterday
  },

  /**
   * User who has not verified their email. Active trial.
   * Used by: email verification enforcement tests (should be blocked from
   * note generation and checkout).
   */
  UNVERIFIED: {
    email: 'unverified@test.example.com',
    password: SHARED_PASSWORD,
    emailVerified: false,
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  },

  /**
   * User whose account is currently locked due to failed login attempts.
   * Used by: account lockout tests (correct password should still be rejected).
   */
  LOCKED: {
    email: 'locked@test.example.com',
    password: SHARED_PASSWORD,
    emailVerified: true,
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    failedLoginAttempts: 5,
    lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // locked for 15 more minutes
  },

  /**
   * User with a canceled subscription and no active trial.
   * Used by: subscription enforcement tests (different error code from expired trial).
   */
  CANCELED_SUB: {
    email: 'canceled@test.example.com',
    password: SHARED_PASSWORD,
    emailVerified: true,
    subscriptionStatus: 'canceled',
    trialEndsAt: null,
  },

  /**
   * Organization owner. Verified, active trial individually.
   * Member of Test PT Clinic as owner (non-billable).
   * Used by: organization tests, admin flows.
   */
  ORG_OWNER: {
    email: 'org-owner@test.example.com',
    password: SHARED_PASSWORD,
    emailVerified: true,
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  },

  /**
   * Organization member. Verified, personal trial expired.
   * Member of Test PT Clinic (active subscription) as billable member.
   * Used by: org subscription fallback tests (personal trial expired, but
   * org subscription is active — should be allowed through).
   */
  ORG_MEMBER: {
    email: 'org-member@test.example.com',
    password: SHARED_PASSWORD,
    emailVerified: true,
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // personal trial expired
  },
} as const satisfies Record<string, TestUser>;

// ─── Organization ────────────────────────────────────────────────────────────

export const TEST_ORG = {
  name: 'Test Physical Therapy Clinic',
  maxSeats: 10,
  subscriptionStatus: 'active',
  trialEndsAt: null,
} as const;

// ─── Invite Codes ────────────────────────────────────────────────────────────

export const TEST_INVITE_CODES = {
  /** Active clinic code — usable by any user not already in an org. */
  VALID: {
    code: 'TESTCLINIC',
    type: 'clinic' as const,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  },

  /** Already-used code (used by ORG_MEMBER). Should fail on reuse. */
  USED: {
    code: 'USEDCODE01',
    type: 'clinic' as const,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
} as const;

// ─── Password Reset Token ────────────────────────────────────────────────────

/**
 * A deterministic password reset token for E2E testing.
 * The plain token is what the "user" would receive in their email.
 * The seed script stores the SHA-256 hash in email_tokens.
 *
 * 15-minute expiry — token is re-created fresh each seed run,
 * so tests that run after seeding always have a valid window.
 */
export const TEST_RESET_TOKEN = {
  /** Plain token value — use this in E2E tests to simulate clicking the reset link. */
  plainToken: 'e2e-test-reset-token-do-not-use-in-production',
  /** Token expiry. 15 minutes from seed time. */
  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
} as const;
