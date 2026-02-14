/**
 * Test data helpers for web app E2E tests.
 *
 * Contains generated credentials, invalid inputs, and other test data.
 * These are NOT PHI - they're fictional examples for testing.
 */

/**
 * Generate a unique email for registration tests.
 * Uses timestamp + random suffix to ensure uniqueness.
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@example.com`;
}

/**
 * Generate a valid test password that meets policy requirements:
 * - Min 8 characters
 * - At least one uppercase
 * - At least one lowercase
 * - At least one number
 */
export function generateTestPassword(): string {
  return `TestPass${Date.now().toString().slice(-4)}!`;
}

/**
 * Invalid email examples for validation testing.
 */
export const invalidEmails = {
  noAt: 'invalidemail.com',
  noDomain: 'user@',
  noUser: '@domain.com',
  empty: '',
};

/**
 * Invalid password examples for validation testing.
 */
export const invalidPasswords = {
  tooShort: 'Ab1',
  noUppercase: 'abcdefg1',
  noLowercase: 'ABCDEFG1',
  noNumber: 'Abcdefgh',
  empty: '',
};

/**
 * Valid test credentials for forms.
 */
export const validCredentials = {
  email: 'newuser@example.com',
  password: 'ValidPass123',
  confirmPassword: 'ValidPass123',
};

// ─── Seeded test users ───────────────────────────────────────────────────────
// These must match the credentials in backend/src/db/seed-test-users.ts.
// All users share the same password.

const SHARED_PASSWORD = 'TestPassword123';

/**
 * Seeded test users for E2E tests requiring specific account states.
 * Each user is created by `pnpm db:seed:test` with the described state.
 */
export const TEST_USERS = {
  /** Verified, active trial, clean state. Used by all happy-path tests. */
  PRIMARY: { email: 'test@example.com', password: SHARED_PASSWORD },

  /** Verified, trial expired yesterday. Should get 402 on protected endpoints. */
  EXPIRED_TRIAL: { email: 'expired-trial@test.example.com', password: SHARED_PASSWORD },

  /** Email not verified. Active trial. Should be blocked from note gen and checkout. */
  UNVERIFIED: { email: 'unverified@test.example.com', password: SHARED_PASSWORD },

  /** Verified, locked (5 failed attempts, locked_until in future). */
  LOCKED: { email: 'locked@test.example.com', password: SHARED_PASSWORD },

  /** Verified, subscription_status='canceled', no trial. */
  CANCELED_SUB: { email: 'canceled@test.example.com', password: SHARED_PASSWORD },

  /** Verified, org owner of Test PT Clinic. */
  ORG_OWNER: { email: 'org-owner@test.example.com', password: SHARED_PASSWORD },

  /** Verified, org member of Test PT Clinic. Personal trial expired, org has active sub. */
  ORG_MEMBER: { email: 'org-member@test.example.com', password: SHARED_PASSWORD },
} as const;

/** Active clinic invite code for org join tests. */
export const TEST_INVITE_CODE = 'TESTCLINIC';

/** Deterministic password reset token. Matches what seed-test.ts inserts into email_tokens. */
export const TEST_RESET_TOKEN = 'e2e-test-reset-token-do-not-use-in-production';
