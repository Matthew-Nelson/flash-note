import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before importing (config.ts calls process.exit without DATABASE_URL)
vi.mock('@/server/db/config', () => ({
  BCRYPT_ROUNDS: 12,
  LEGAL_DOCUMENT_VERSIONS: { baa: '0.1', terms_of_service: '0.1', privacy_policy: '0.1' },
  EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS: 24,
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: 15,
  SESSION_IDLE_TTL_MS: 24 * 60 * 60 * 1000,
  SESSION_ABSOLUTE_MAX_MS: 7 * 24 * 60 * 60 * 1000,
  SESSION_REFRESH_THRESHOLD: 0.5,
  MAX_SESSIONS_PER_USER: 5,
  SESSION_COOKIE_MAX_AGE_SECONDS: 7 * 24 * 60 * 60,
  isProduction: false,
}));

import {
  mockDbQuery,
  mockClientQuery,
  mockGetPoolClient,
  resetMocks,
  createMockUserRow,
} from '@/test/dal-helpers';

// --- Mocks (vi.hoisted ensures declarations are available when vi.mock factories run) ---

const mockAuditLog = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetAccountLockoutStatus = vi.hoisted(() => vi.fn());
const mockRecordFailedAttempt = vi.hoisted(() => vi.fn());
const mockResetFailedAttempts = vi.hoisted(() => vi.fn());
const mockCreateToken = vi.hoisted(() => vi.fn());
const mockSendVerificationEmail = vi.hoisted(() => vi.fn());

vi.mock('@/server/services/audit', () => ({
  auditService: { log: mockAuditLog },
}));

vi.mock('./lockout', () => ({
  getAccountLockoutStatus: mockGetAccountLockoutStatus,
  recordFailedAttempt: mockRecordFailedAttempt,
  resetFailedAttempts: mockResetFailedAttempts,
}));

const mockValidateAndConsumeToken = vi.hoisted(() => vi.fn());

vi.mock('./token', () => ({
  createToken: mockCreateToken,
  validateAndConsumeToken: mockValidateAndConsumeToken,
}));

vi.mock('./email', () => ({
  sendVerificationEmail: mockSendVerificationEmail,
}));

// Mock bcrypt — keep compare functional for testing
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue('$2a$12$hashedvalue'),
  },
}));

import bcrypt from 'bcryptjs';

import { login, register, completePasswordReset, verifyEmail, sanitizeUser } from './auth';
import type { User } from '@/server/types';

// Helper to build a User object from a mock row
function buildUser(overrides: Partial<User> = {}): User {
  const row = createMockUserRow();
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    stripeCustomerId: row.stripe_customer_id,
    subscriptionId: row.subscription_id,
    subscriptionStatus: row.subscription_status as User['subscriptionStatus'],
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: row.locked_until,
    lastFailedLoginAt: row.last_failed_login_at,
    emailVerified: row.email_verified,
    emailVerifiedAt: row.email_verified_at,
    organizationId: row.organization_id,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
    ...overrides,
  };
}

function setupMockClient() {
  const mockClient = {
    query: mockClientQuery,
    release: vi.fn(),
  };
  mockGetPoolClient.mockResolvedValue(mockClient);
  return mockClient;
}

const context = { ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' };

describe('auth service', () => {
  beforeEach(() => {
    resetMocks();
    mockAuditLog.mockReset();
    mockGetAccountLockoutStatus.mockReset();
    mockRecordFailedAttempt.mockReset();
    mockResetFailedAttempts.mockReset();
    mockCreateToken.mockReset();
    mockValidateAndConsumeToken.mockReset();
    mockSendVerificationEmail.mockReset();
    vi.mocked(bcrypt.compare).mockReset();
    vi.mocked(bcrypt.hash).mockReset().mockResolvedValue('$2a$12$hashedvalue' as never);
  });

  describe('login', () => {
    it('returns user and token on successful login', async () => {
      const userRow = createMockUserRow({ email_verified: true });
      // findUserByEmail
      mockDbQuery.mockResolvedValueOnce({ rows: [userRow] });
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
      mockGetAccountLockoutStatus.mockResolvedValueOnce({
        isLocked: false, failedAttempts: 0, isPermanentlyLocked: false, lockedUntil: null,
      });
      mockResetFailedAttempts.mockResolvedValueOnce(undefined);

      // createSession: getPoolClient + BEGIN + count + insert + COMMIT
      const mockClient = setupMockClient();
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })  // COUNT sessions
        .mockResolvedValueOnce({ rows: [{ id: 'session-1' }] })  // INSERT session
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await login('test@example.com', 'password123', context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.id).toBe('test-user-id');
        expect(result.user.email).toBe('test@example.com');
        expect(result.token).toBeDefined();
        expect(result.emailVerificationRequired).toBe(false);
      }
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('uses DUMMY_HASH when user does not exist (timing safety)', async () => {
      // findUserByEmail returns null
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
      mockRecordFailedAttempt.mockResolvedValueOnce({
        isLocked: false, failedAttempts: 0, isPermanentlyLocked: false, lockedUntil: null,
      });

      const result = await login('nobody@example.com', 'password123', context);

      expect(result.success).toBe(false);
      // bcrypt.compare should still be called (with DUMMY_HASH)
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
      expect(vi.mocked(bcrypt.compare).mock.calls[0][1]).toBe(
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYq1IpHBBUGK'
      );
      // recordFailedAttempt MUST be called even for non-existent user (timing equalization)
      expect(mockRecordFailedAttempt).toHaveBeenCalledWith(null, context);
      expect(mockRecordFailedAttempt).toHaveBeenCalledTimes(1);
    });

    it('returns invalid_credentials on wrong password', async () => {
      const userRow = createMockUserRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [userRow] });
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
      mockRecordFailedAttempt.mockResolvedValueOnce({
        isLocked: false, failedAttempts: 1, isPermanentlyLocked: false, lockedUntil: null,
      });

      const result = await login('test@example.com', 'wrong', context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_credentials');
      }
      // recordFailedAttempt called with real user ID (not null) when user exists
      expect(mockRecordFailedAttempt).toHaveBeenCalledWith('test-user-id', context);
    });

    it('returns invalid_credentials for locked account (no lockout reveal)', async () => {
      const userRow = createMockUserRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [userRow] });
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
      mockGetAccountLockoutStatus.mockResolvedValueOnce({
        isLocked: true, failedAttempts: 5, isPermanentlyLocked: false,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      });

      const result = await login('test@example.com', 'password123', context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_credentials');
      }
    });

    it('fails secure when lockout check throws', async () => {
      const userRow = createMockUserRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [userRow] });
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
      mockGetAccountLockoutStatus.mockRejectedValueOnce(new Error('db error'));

      const result = await login('test@example.com', 'password123', context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_credentials');
      }
    });

    it('still allows login if recordFailedAttempt throws (for valid user, wrong password)', async () => {
      const userRow = createMockUserRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [userRow] });
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
      mockRecordFailedAttempt.mockRejectedValueOnce(new Error('lockout db error'));

      const result = await login('test@example.com', 'wrong', context);

      // Should still return error (not throw)
      expect(result.success).toBe(false);
    });

    it('fires LOGIN_FAILED audit when locked account submits correct password', async () => {
      // User exists with correct password, but account is locked.
      // The normal recordFailedAttempt path is bypassed when password is valid.
      // Verify the audit trail is still complete (Fix 6 / HIPAA requirement).
      const userRow = createMockUserRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [userRow] });
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never); // correct password
      mockGetAccountLockoutStatus.mockResolvedValueOnce({
        isLocked: true, failedAttempts: 5, isPermanentlyLocked: false,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      });

      const result = await login('test@example.com', 'correct-password', context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_credentials');
      }
      // Verify LOGIN_FAILED audit fired with reason: account_locked
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-id',
          action: 'LOGIN_FAILED',
          status: 'FAILURE',
          metadata: expect.objectContaining({ reason: 'account_locked' }),
        })
      );
    });

    it('resets failed attempts on successful login', async () => {
      const userRow = createMockUserRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [userRow] });
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
      mockGetAccountLockoutStatus.mockResolvedValueOnce({
        isLocked: false, failedAttempts: 3, isPermanentlyLocked: false, lockedUntil: null,
      });
      mockResetFailedAttempts.mockResolvedValueOnce(undefined);

      setupMockClient();
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'session-1' }] })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await login('test@example.com', 'password123', context);

      expect(mockResetFailedAttempts).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('register', () => {
    it('creates user, session, legal acceptances in transaction', async () => {
      // findUserByEmail returns null (no existing user)
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = setupMockClient();
      const userRow = createMockUserRow();

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [userRow] })  // createUserWithClient
        .mockResolvedValueOnce({ rows: [{ id: 'la-1' }] })  // legal acceptance 1
        .mockResolvedValueOnce({ rows: [{ id: 'la-2' }] })  // legal acceptance 2
        .mockResolvedValueOnce({ rows: [{ id: 'la-3' }] })  // legal acceptance 3
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })  // session count
        .mockResolvedValueOnce({ rows: [{ id: 'session-1' }] })  // session insert
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      mockCreateToken.mockResolvedValueOnce('verification-token');
      mockSendVerificationEmail.mockResolvedValueOnce(undefined);

      const result = await register('new@example.com', 'Password1', context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.email).toBe('test@example.com'); // from mock row
        expect(result.token).toBeDefined();
      }
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('returns email_exists when user already registered', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [createMockUserRow()] });

      const result = await register('existing@example.com', 'Password1', context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('email_exists');
      }
    });

    it('rolls back transaction on failure', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // findUserByEmail

      const mockClient = setupMockClient();
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockRejectedValueOnce(new Error('insert failed'))  // createUserWithClient
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(register('new@example.com', 'Password1', context))
        .rejects.toThrow('insert failed');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('returns email_exists on unique constraint violation (TOCTOU race)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // findUserByEmail — no user (race window)

      const mockClient = setupMockClient();
      const pgError = new Error('duplicate key value violates unique constraint');
      Object.assign(pgError, { code: '23505' });

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockRejectedValueOnce(pgError)       // createUserWithClient — unique violation
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const result = await register('race@example.com', 'Password1', context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('email_exists');
      }
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('fires audit logs after commit, not inside transaction', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // findUserByEmail

      setupMockClient();
      const userRow = createMockUserRow();
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [{ id: 'la-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'la-2' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'la-3' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ id: 's-1' }] })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      mockCreateToken.mockResolvedValueOnce('token');
      mockSendVerificationEmail.mockResolvedValueOnce(undefined);

      await register('new@example.com', 'Password1', context);

      // REGISTER and LEGAL_CONSENT_ACCEPTED should both be called
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REGISTER' })
      );
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LEGAL_CONSENT_ACCEPTED' })
      );
    });

    it('does not fail registration if verification email fails', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      setupMockClient();
      const userRow = createMockUserRow();
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [{ id: 'la-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'la-2' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'la-3' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ id: 's-1' }] })
        .mockResolvedValueOnce({ rows: [] });

      mockCreateToken.mockRejectedValueOnce(new Error('token creation failed'));

      const result = await register('new@example.com', 'Password1', context);

      // Registration should still succeed
      expect(result.success).toBe(true);
    });

    it('registers with beta invite code, marks code as used, fires INVITE_CODE_REDEEMED audit', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // findUserByEmail

      const mockClient = setupMockClient();
      const userRow = createMockUserRow();
      const inviteCodeRow = {
        id: 'code-1',
        code: 'ABCD1234',
        type: 'beta' as const,
        organization_id: null,
        created_by: 'admin-user',
        used_by: null,
        used_at: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        is_active: true,
        created_at: new Date(),
      };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                   // BEGIN
        .mockResolvedValueOnce({ rows: [inviteCodeRow] })      // findByCodeForUpdate
        .mockResolvedValueOnce({ rows: [userRow] })            // createUserWithClient
        .mockResolvedValueOnce({ rows: [{ id: 'la-1' }] })    // legal acceptance 1
        .mockResolvedValueOnce({ rows: [{ id: 'la-2' }] })    // legal acceptance 2
        .mockResolvedValueOnce({ rows: [{ id: 'la-3' }] })    // legal acceptance 3
        .mockResolvedValueOnce({ rows: [] })                   // markCodeAsUsed
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })    // session count
        .mockResolvedValueOnce({ rows: [{ id: 'session-1' }] }) // session insert
        .mockResolvedValueOnce({ rows: [] });                  // COMMIT

      mockCreateToken.mockResolvedValueOnce('verification-token');
      mockSendVerificationEmail.mockResolvedValueOnce(undefined);

      const result = await register('new@example.com', 'Password1', {
        ...context,
        inviteCode: 'ABCD1234',
      });

      expect(result.success).toBe(true);
      expect(mockClient.release).toHaveBeenCalled();

      // Verify markCodeAsUsed was called (7th client query = UPDATE invite_codes)
      expect(mockClientQuery.mock.calls[6][0]).toContain('UPDATE invite_codes');

      // Verify INVITE_CODE_REDEEMED audit was logged
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INVITE_CODE_REDEEMED',
          metadata: { codeId: 'code-1' },
        })
      );
    });

    it('registers with clinic invite code, joins org, fires ORG_MEMBER_JOINED audit', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // findUserByEmail

      const mockClient = setupMockClient();
      const userRow = createMockUserRow();
      const clinicCodeRow = {
        id: 'code-2',
        code: 'CLIN5678',
        type: 'clinic' as const,
        organization_id: 'org-1',
        created_by: 'admin-user',
        used_by: null,
        used_at: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        is_active: true,
        created_at: new Date(),
      };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                   // BEGIN
        .mockResolvedValueOnce({ rows: [clinicCodeRow] })      // findByCodeForUpdate
        .mockResolvedValueOnce({ rows: [userRow] })            // createUserWithClient
        .mockResolvedValueOnce({ rows: [{ id: 'la-1' }] })    // legal acceptance 1
        .mockResolvedValueOnce({ rows: [{ id: 'la-2' }] })    // legal acceptance 2
        .mockResolvedValueOnce({ rows: [{ id: 'la-3' }] })    // legal acceptance 3
        .mockResolvedValueOnce({ rows: [{ max_seats: 10, name: 'Test Clinic' }] }) // findOrganizationByIdForUpdate
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })    // countBillableSeats
        .mockResolvedValueOnce({ rows: [] })                   // addMember
        .mockResolvedValueOnce({ rows: [] })                   // updateUserOrganization
        .mockResolvedValueOnce({ rows: [] })                   // markCodeAsUsed
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })    // session count
        .mockResolvedValueOnce({ rows: [{ id: 'session-1' }] }) // session insert
        .mockResolvedValueOnce({ rows: [] });                  // COMMIT

      mockCreateToken.mockResolvedValueOnce('verification-token');
      mockSendVerificationEmail.mockResolvedValueOnce(undefined);

      const result = await register('new@example.com', 'Password1', {
        ...context,
        inviteCode: 'CLIN5678',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.organizationId).toBe('org-1');
      }
      expect(mockClient.release).toHaveBeenCalled();

      // Verify addMember was called (9th client query = INSERT INTO organization_members)
      expect(mockClientQuery.mock.calls[8][0]).toContain('INSERT INTO organization_members');

      // Verify updateUserOrganization was called (10th client query = UPDATE users SET organization_id)
      expect(mockClientQuery.mock.calls[9][0]).toContain('organization_id');

      // Verify ORG_MEMBER_JOINED audit was logged
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ORG_MEMBER_JOINED',
          metadata: { organizationId: 'org-1', source: 'registration' },
        })
      );

      // Verify INVITE_CODE_REDEEMED audit was also logged
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INVITE_CODE_REDEEMED',
          metadata: { codeId: 'code-2' },
        })
      );
    });

    it('returns invalid_invite_code when code not found in transaction', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // findUserByEmail

      const mockClient = setupMockClient();

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] })  // findByCodeForUpdate — not found
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const result = await register('new@example.com', 'Password1', {
        ...context,
        inviteCode: 'BADCODE1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_invite_code');
      }
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('returns no_seats_available when org is full', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // findUserByEmail

      const mockClient = setupMockClient();
      const userRow = createMockUserRow();
      const clinicCodeRow = {
        id: 'code-3',
        code: 'FULL1234',
        type: 'clinic' as const,
        organization_id: 'org-full',
        created_by: 'admin-user',
        used_by: null,
        used_at: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        is_active: true,
        created_at: new Date(),
      };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                   // BEGIN
        .mockResolvedValueOnce({ rows: [clinicCodeRow] })      // findByCodeForUpdate
        .mockResolvedValueOnce({ rows: [userRow] })            // createUserWithClient
        .mockResolvedValueOnce({ rows: [{ id: 'la-1' }] })    // legal acceptance 1
        .mockResolvedValueOnce({ rows: [{ id: 'la-2' }] })    // legal acceptance 2
        .mockResolvedValueOnce({ rows: [{ id: 'la-3' }] })    // legal acceptance 3
        .mockResolvedValueOnce({ rows: [{ max_seats: 5, name: 'Full Clinic' }] }) // findOrganizationByIdForUpdate
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })    // countBillableSeats — at limit
        .mockResolvedValueOnce({ rows: [] });                  // ROLLBACK

      const result = await register('new@example.com', 'Password1', {
        ...context,
        inviteCode: 'FULL1234',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('no_seats_available');
      }
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('returns invalid_invite_code when code is expired (validateCodeRedeemable fails)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // findUserByEmail

      const mockClient = setupMockClient();
      const expiredCodeRow = {
        id: 'code-expired',
        code: 'EXPIRED1',
        type: 'beta' as const,
        organization_id: null,
        created_by: 'admin-user',
        used_by: null,
        used_at: null,
        expires_at: new Date(Date.now() - 1000), // expired
        is_active: true,
        created_at: new Date(),
      };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                 // BEGIN
        .mockResolvedValueOnce({ rows: [expiredCodeRow] })   // findByCodeForUpdate
        .mockResolvedValueOnce({ rows: [] });                // ROLLBACK

      const result = await register('new@example.com', 'Password1', {
        ...context,
        inviteCode: 'EXPIRED1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_invite_code');
      }
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('returns invalid_invite_code when clinic code has no organizationId', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // findUserByEmail

      const mockClient = setupMockClient();
      const userRow = createMockUserRow();
      const clinicCodeNoOrg = {
        id: 'code-no-org',
        code: 'NOORG123',
        type: 'clinic' as const,
        organization_id: null, // clinic code missing org
        created_by: 'admin-user',
        used_by: null,
        used_at: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        is_active: true,
        created_at: new Date(),
      };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                  // BEGIN
        .mockResolvedValueOnce({ rows: [clinicCodeNoOrg] })   // findByCodeForUpdate
        .mockResolvedValueOnce({ rows: [userRow] })           // createUserWithClient
        .mockResolvedValueOnce({ rows: [{ id: 'la-1' }] })   // legal acceptance 1
        .mockResolvedValueOnce({ rows: [{ id: 'la-2' }] })   // legal acceptance 2
        .mockResolvedValueOnce({ rows: [{ id: 'la-3' }] })   // legal acceptance 3
        .mockResolvedValueOnce({ rows: [] });                 // ROLLBACK

      const result = await register('new@example.com', 'Password1', {
        ...context,
        inviteCode: 'NOORG123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_invite_code');
      }
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('returns invalid_invite_code when clinic code org not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // findUserByEmail

      const mockClient = setupMockClient();
      const userRow = createMockUserRow();
      const clinicCodeRow = {
        id: 'code-bad-org',
        code: 'BADORG12',
        type: 'clinic' as const,
        organization_id: 'org-gone',
        created_by: 'admin-user',
        used_by: null,
        used_at: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        is_active: true,
        created_at: new Date(),
      };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                  // BEGIN
        .mockResolvedValueOnce({ rows: [clinicCodeRow] })     // findByCodeForUpdate
        .mockResolvedValueOnce({ rows: [userRow] })           // createUserWithClient
        .mockResolvedValueOnce({ rows: [{ id: 'la-1' }] })   // legal acceptance 1
        .mockResolvedValueOnce({ rows: [{ id: 'la-2' }] })   // legal acceptance 2
        .mockResolvedValueOnce({ rows: [{ id: 'la-3' }] })   // legal acceptance 3
        .mockResolvedValueOnce({ rows: [] })                  // findOrganizationByIdForUpdate — not found
        .mockResolvedValueOnce({ rows: [] });                 // ROLLBACK

      const result = await register('new@example.com', 'Password1', {
        ...context,
        inviteCode: 'BADORG12',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_invite_code');
      }
      expect(mockClient.release).toHaveBeenCalled();
    });

  });

  describe('verifyEmail', () => {
    it('consumes token and marks email verified in a single transaction', async () => {
      const mockClient = setupMockClient();
      mockValidateAndConsumeToken.mockResolvedValueOnce('user-1');
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] })  // markEmailVerified
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const userId = await verifyEmail('valid-token');

      expect(userId).toBe('user-1');
      expect(mockClient.release).toHaveBeenCalled();

      // Verify transaction sequence
      expect(mockClientQuery.mock.calls[0][0]).toBe('BEGIN');
      // markEmailVerified updates users table
      expect(mockClientQuery.mock.calls[1][0]).toContain('email_verified = TRUE');
      expect(mockClientQuery.mock.calls[2][0]).toBe('COMMIT');
    });

    it('returns null for invalid/expired/consumed token', async () => {
      const mockClient = setupMockClient();
      mockValidateAndConsumeToken.mockResolvedValueOnce(null);
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const userId = await verifyEmail('bad-token');

      expect(userId).toBeNull();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('rolls back if markEmailVerified fails', async () => {
      const mockClient = setupMockClient();
      mockValidateAndConsumeToken.mockResolvedValueOnce('user-1');
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockRejectedValueOnce(new Error('db error'))  // markEmailVerified fails
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(verifyEmail('valid-token')).rejects.toThrow('db error');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('passes client to validateAndConsumeToken for transaction atomicity', async () => {
      setupMockClient();
      mockValidateAndConsumeToken.mockResolvedValueOnce('user-1');
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] })  // markEmailVerified
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await verifyEmail('valid-token');

      // validateAndConsumeToken should receive the client as 3rd arg
      expect(mockValidateAndConsumeToken).toHaveBeenCalledWith(
        'valid-token',
        'email_verification',
        expect.objectContaining({ query: mockClientQuery })
      );
    });

    it('returns null when password_reset token submitted to email verification (type confusion)', async () => {
      // verifyEmail calls validateAndConsumeToken with type='email_verification'.
      // If a password_reset token is submitted, consumeToken returns null due to
      // the token_type mismatch enforced by SQL WHERE clause (Gap 3 coverage).
      // This tests that the type parameter is correctly passed through the service layer.
      const mockClient = setupMockClient();
      mockValidateAndConsumeToken.mockResolvedValueOnce(null); // type mismatch → null
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const result = await verifyEmail('password-reset-token-value');

      expect(result).toBeNull();
      // Verify verifyEmail always passes 'email_verification' as the token type
      expect(mockValidateAndConsumeToken).toHaveBeenCalledWith(
        'password-reset-token-value',
        'email_verification',
        expect.anything()
      );
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('completePasswordReset', () => {
    it('consumes token, updates password, deletes sessions, resets lockout in transaction', async () => {
      const mockClient = setupMockClient();
      mockValidateAndConsumeToken.mockResolvedValueOnce('user-1');

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })              // BEGIN
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // updatePassword — 1 row affected
        .mockResolvedValueOnce({ rows: [] })              // deleteSessionsByUserId
        .mockResolvedValueOnce({ rows: [] })              // resetLockout
        .mockResolvedValueOnce({ rows: [] });             // COMMIT

      const result = await completePasswordReset('valid-token', 'NewPass1', context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.userId).toBe('user-1');
      }
      expect(mockClient.release).toHaveBeenCalled();

      // Verify transaction sequence
      expect(mockClientQuery.mock.calls[0][0]).toBe('BEGIN');
      expect(mockClientQuery.mock.calls[1][0]).toContain('UPDATE users');
      expect(mockClientQuery.mock.calls[2][0]).toContain('DELETE FROM sessions');
      expect(mockClientQuery.mock.calls[3][0]).toContain('failed_login_attempts = 0');
      expect(mockClientQuery.mock.calls[4][0]).toBe('COMMIT');
    });

    it('returns invalid_token when token is invalid/expired/consumed', async () => {
      const mockClient = setupMockClient();
      mockValidateAndConsumeToken.mockResolvedValueOnce(null);
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const result = await completePasswordReset('bad-token', 'NewPass1', context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_token');
      }
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('fires audit log after commit', async () => {
      setupMockClient();
      mockValidateAndConsumeToken.mockResolvedValueOnce('user-1');
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })              // BEGIN
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // updatePassword
        .mockResolvedValueOnce({ rows: [] })              // deleteSessionsByUserId
        .mockResolvedValueOnce({ rows: [] })              // resetLockout
        .mockResolvedValueOnce({ rows: [] });             // COMMIT

      await completePasswordReset('valid-token', 'NewPass1', context);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_RESET_SUCCESS',
          metadata: { sessionsInvalidated: true },
        })
      );
    });

    it('returns not_found when user does not exist or is deleted', async () => {
      const mockClient = setupMockClient();
      mockValidateAndConsumeToken.mockResolvedValueOnce('user-1');
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })              // BEGIN
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // updatePassword — 0 rows affected
        .mockResolvedValueOnce({ rows: [] });             // ROLLBACK

      const result = await completePasswordReset('valid-token', 'NewPass1', context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('not_found');
      }
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('rolls back on transaction failure', async () => {
      const mockClient = setupMockClient();
      mockValidateAndConsumeToken.mockResolvedValueOnce('user-1');
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                    // BEGIN
        .mockRejectedValueOnce(new Error('update failed'))      // updatePassword fails
        .mockResolvedValueOnce({ rows: [] });                   // ROLLBACK

      await expect(completePasswordReset('valid-token', 'NewPass1', context))
        .rejects.toThrow('update failed');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('passes client to validateAndConsumeToken for transaction atomicity', async () => {
      setupMockClient();
      mockValidateAndConsumeToken.mockResolvedValueOnce('user-1');
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })              // BEGIN
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // updatePassword
        .mockResolvedValueOnce({ rows: [] })              // deleteSessionsByUserId
        .mockResolvedValueOnce({ rows: [] })              // resetLockout
        .mockResolvedValueOnce({ rows: [] });             // COMMIT

      await completePasswordReset('valid-token', 'NewPass1', context);

      expect(mockValidateAndConsumeToken).toHaveBeenCalledWith(
        'valid-token',
        'password_reset',
        expect.objectContaining({ query: mockClientQuery })
      );
    });
  });

  describe('sanitizeUser', () => {
    it('strips sensitive fields', () => {
      const user = buildUser();
      const sanitized = sanitizeUser(user);

      expect(sanitized).toEqual({
        id: user.id,
        email: user.email,
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
        emailVerified: user.emailVerified,
        organizationId: user.organizationId,
      });

      // Sensitive fields should not be present
      expect(sanitized).not.toHaveProperty('passwordHash');
      expect(sanitized).not.toHaveProperty('failedLoginAttempts');
      expect(sanitized).not.toHaveProperty('lockedUntil');
      expect(sanitized).not.toHaveProperty('lastFailedLoginAt');
    });
  });
});
