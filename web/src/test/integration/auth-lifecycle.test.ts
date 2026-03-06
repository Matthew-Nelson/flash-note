/**
 * Auth Lifecycle Integration Test
 *
 * Tests the auth service layer (auth.ts → lockout.ts → token.ts → DAL) against
 * a mocked DB driver. This is NOT a unit test — we do not mock the service or DAL
 * functions themselves. We mock only:
 *   - @/server/db (DB driver/pool)
 *   - @/server/services/email (external I/O)
 *   - @/server/services/audit (fire-and-forget, side-effect)
 *
 * BCRYPT_ROUNDS: 1 — use reduced rounds for test speed (documents the deviation).
 * The real bcrypt path is still exercised; only the work factor is reduced.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockDbQuery,
  mockClientQuery,
  mockGetPoolClient,
  resetMocks,
  createMockUserRow,
} from '@/test/dal-helpers';

// Config mock — must come before service imports.
// BCRYPT_ROUNDS: 1 (deviation from production 12) for test speed.
vi.mock('@/server/db/config', () => ({
  BCRYPT_ROUNDS: 1,
  LEGAL_DOCUMENT_VERSIONS: { baa: '0.1', terms_of_service: '0.1', privacy_policy: '0.1' },
  EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS: 24,
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: 15,
  MAX_SESSIONS_PER_USER: 5,
  SESSION_IDLE_TTL_MS: 24 * 60 * 60 * 1000,
  SESSION_ABSOLUTE_MAX_MS: 7 * 24 * 60 * 60 * 1000,
  SESSION_REFRESH_THRESHOLD: 0.5,
  SESSION_COOKIE_MAX_AGE_SECONDS: 7 * 24 * 60 * 60,
  isProduction: false,
}));

vi.mock('@/server/services/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

const mockAuditLog = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/server/services/audit', () => ({
  auditService: {
    log: mockAuditLog,
    logWithClient: mockAuditLog,
  },
}));

// Import after mocks are declared
import { register, login, verifyEmail, completePasswordReset } from '@/server/services/auth';
import bcrypt from 'bcryptjs';

const context = { ipAddress: '127.0.0.1', userAgent: 'IntegrationTest/1.0' };

describe('auth service integration', () => {
  beforeEach(() => {
    resetMocks();
    mockAuditLog.mockReset().mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------------------
  // register()
  // ---------------------------------------------------------------------------

  describe('register()', () => {
    it('creates user, legal acceptances, and session in a transaction (Rule 1)', async () => {
      // No existing user
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = {
        query: mockClientQuery,
        release: vi.fn(),
      };
      mockGetPoolClient.mockResolvedValue(mockClient);

      const userRow = createMockUserRow({ email: 'new@example.com' });
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })              // BEGIN
        .mockResolvedValueOnce({ rows: [userRow] })       // createUserWithClient
        .mockResolvedValueOnce({ rows: [{ id: 'la-1' }] }) // legal acceptance 1 (BAA)
        .mockResolvedValueOnce({ rows: [{ id: 'la-2' }] }) // legal acceptance 2 (TOS)
        .mockResolvedValueOnce({ rows: [{ id: 'la-3' }] }) // legal acceptance 3 (privacy)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // session count
        .mockResolvedValueOnce({ rows: [{ id: 'session-1' }] }) // session insert
        .mockResolvedValueOnce({ rows: [] });              // COMMIT

      const result = await register('new@example.com', 'Password1!', context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.token).toBeDefined();
        expect(result.user.email).toBe('new@example.com'); // register uses the input email
      }
      // Transaction must be committed
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('fires REGISTER + LEGAL_CONSENT_ACCEPTED audit logs inside transaction (Rule 9)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery, release: vi.fn() };
      mockGetPoolClient.mockResolvedValue(mockClient);

      const userRow = createMockUserRow();
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [userRow] })
        .mockResolvedValueOnce({ rows: [{ id: 'la-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'la-2' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'la-3' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'session-1' }] })
        .mockResolvedValueOnce({ rows: [] });

      await register('new@example.com', 'Password1!', context);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.anything(), // client
        expect.objectContaining({ action: 'REGISTER', status: 'SUCCESS' })
      );
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.anything(), // client
        expect.objectContaining({ action: 'LEGAL_CONSENT_ACCEPTED', status: 'SUCCESS' })
      );
    });

    it('returns email_exists when user already registered (before transaction)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [createMockUserRow()] });

      const result = await register('existing@example.com', 'Password1!', context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('email_exists');
      }
      // No transaction should be started
      expect(mockClientQuery).not.toHaveBeenCalled();
    });

    it('rolls back transaction on failure (Rule 1)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery, release: vi.fn() };
      mockGetPoolClient.mockResolvedValue(mockClient);

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })           // BEGIN
        .mockRejectedValueOnce(new Error('DB failure')) // createUserWithClient fails
        .mockResolvedValueOnce({ rows: [] });           // ROLLBACK

      await expect(register('new@example.com', 'Password1!', context)).rejects.toThrow('DB failure');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // login()
  // ---------------------------------------------------------------------------

  describe('login()', () => {
    it('returns user and token on successful login with correct credentials', async () => {
      // Register a password to get a real hash, then test login with it
      const testPassword = 'CorrectPass1!';
      const realHash = await bcrypt.hash(testPassword, 1);

      const userRow = createMockUserRow({ password_hash: realHash, email_verified: true });
      // findUserByEmail
      mockDbQuery.mockResolvedValueOnce({ rows: [userRow] });
      // getAccountLockoutStatus — calls DB via DAL
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 0, locked_until: null }],
      });
      // resetFailedAttempts
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      // createSession transaction
      const mockClient = { query: mockClientQuery, release: vi.fn() };
      mockGetPoolClient.mockResolvedValue(mockClient);
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })               // BEGIN
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // session count
        .mockResolvedValueOnce({ rows: [{ id: 'sess-1' }] }) // session insert
        .mockResolvedValueOnce({ rows: [] });               // COMMIT

      const result = await login('test@example.com', testPassword, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.token).toBeDefined();
        expect(result.emailVerificationRequired).toBe(false);
      }
    });

    it('returns invalid_credentials on wrong password and increments failed count (real bcrypt)', async () => {
      const realHash = await bcrypt.hash('correct-pass', 1);
      const userRow = createMockUserRow({ password_hash: realHash });
      mockDbQuery.mockResolvedValueOnce({ rows: [userRow] }); // findUserByEmail

      // recordFailedAttempt → getAccountLockoutStatus (within lockout service)
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 1, locked_until: null }],
      });

      const result = await login('test@example.com', 'wrong-password', context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_credentials');
      }
      // recordFailedAttempt should have been called (2nd DB call)
      expect(mockDbQuery).toHaveBeenCalledTimes(2);
    });

    it('returns invalid_credentials for locked account with correct password + fires LOGIN_FAILED audit (Fix 6)', async () => {
      const testPassword = 'CorrectPass1!';
      const realHash = await bcrypt.hash(testPassword, 1);

      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      const userRow = createMockUserRow({ password_hash: realHash });
      mockDbQuery.mockResolvedValueOnce({ rows: [userRow] }); // findUserByEmail
      // getAccountLockoutStatus — returns locked
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 5, locked_until: lockedUntil }],
      });

      const result = await login('test@example.com', testPassword, context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_credentials');
      }
      // LOGIN_FAILED audit must fire for locked account with correct password
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          status: 'FAILURE',
          metadata: expect.objectContaining({ reason: 'account_locked' }),
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // verifyEmail()
  // ---------------------------------------------------------------------------

  describe('verifyEmail()', () => {
    it('consumes email_verification token and marks user verified in transaction (Rule 1)', async () => {
      const mockClient = { query: mockClientQuery, release: vi.fn() };
      mockGetPoolClient.mockResolvedValue(mockClient);

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        // validateAndConsumeToken → consumeToken (UPDATE email_tokens)
        .mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] })
        .mockResolvedValueOnce({ rows: [] }) // markEmailVerified (UPDATE users)
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const userId = await verifyEmail('valid-token-value');

      expect(userId).toBe('user-1');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('returns null when token is invalid/expired/consumed', async () => {
      const mockClient = { query: mockClientQuery, release: vi.fn() };
      mockGetPoolClient.mockResolvedValue(mockClient);

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // consumeToken returns nothing → null
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const result = await verifyEmail('invalid-token');

      expect(result).toBeNull();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // completePasswordReset()
  // ---------------------------------------------------------------------------

  describe('completePasswordReset()', () => {
    it('consumes token, updates password, deletes sessions, resets lockout atomically (Rule 1)', async () => {
      const mockClient = { query: mockClientQuery, release: vi.fn() };
      mockGetPoolClient.mockResolvedValue(mockClient);

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })              // BEGIN
        // validateAndConsumeToken → consumeToken
        .mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] })
        // updatePassword
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        // deleteSessionsByUserId
        .mockResolvedValueOnce({ rows: [] })
        // resetLockout
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await completePasswordReset('valid-reset-token', 'NewPass1!', context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.userId).toBe('user-1');
      }
      // Verify transaction sequence
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      // Verify audit log fired after commit
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PASSWORD_RESET_SUCCESS', status: 'SUCCESS' })
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('returns invalid_token when token is invalid and rolls back', async () => {
      const mockClient = { query: mockClientQuery, release: vi.fn() };
      mockGetPoolClient.mockResolvedValue(mockClient);

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // consumeToken returns nothing → null
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const result = await completePasswordReset('expired-token', 'NewPass1!', context);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_token');
      }
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
