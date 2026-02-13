import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDbQuery, mockClientQuery, mockAuditLog, resetMocks, createMockUserRow } from '../test/setup.js';
import bcrypt from 'bcryptjs';

// Mock config before any imports that use it
// Use vi.hoisted to ensure mock values are available before vi.mock hoisting
const { mockConfig, mockSentry } = vi.hoisted(() => ({
  mockConfig: {
    JWT_SECRET: 'test-jwt-secret-minimum-32-characters-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars',
    NODE_ENV: 'production' as const,
    BCRYPT_ROUNDS: 10,
  },
  mockSentry: {
    captureException: vi.fn(),
  },
}));

vi.mock('@sentry/node', () => mockSentry);

vi.mock('../config.js', () => ({
  config: mockConfig,
  BCRYPT_ROUNDS: 10,
  LEGAL_DOCUMENT_VERSIONS: {
    baa: '0.1',
    terms_of_service: '0.1',
    privacy_policy: '0.1',
  },
}));

// We need to mock lockoutService separately since it's imported by auth-service
const mockGetLockoutStatus = vi.fn();
const mockRecordFailedAttempt = vi.fn();
const mockResetFailedAttempts = vi.fn();

vi.mock('./lockout-service.js', () => ({
  lockoutService: {
    getAccountLockoutStatus: (...args: unknown[]) => mockGetLockoutStatus(...args),
    recordFailedAttempt: (...args: unknown[]) => mockRecordFailedAttempt(...args),
    resetFailedAttempts: (...args: unknown[]) => mockResetFailedAttempts(...args),
  },
}));

// Mock CSRF token generation
vi.mock('../middleware/csrf.js', () => ({
  generateCsrfToken: () => 'mock-csrf-token',
}));

// Import after mocking
import { authService, sanitizeUser } from './auth-service.js';
import { AuditAction } from '../types/index.js';

/**
 * Helper to set up mocks for a successful login flow
 * M-26: storeRefreshToken now uses a transaction via client
 *
 * mockDbQuery: findUserByEmail, enforceSessionLimit COUNT
 * mockClientQuery: BEGIN, INSERT session, UPDATE hash, COMMIT
 */
function mockSuccessfulLoginDbQueries(user: ReturnType<typeof createMockUserRow>) {
  mockDbQuery
    .mockResolvedValueOnce({ rows: [user] })           // findUserByEmail
    .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // enforceSessionLimit COUNT

  mockClientQuery
    .mockResolvedValueOnce({ rows: [] })                      // BEGIN
    .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // INSERT session
    .mockResolvedValueOnce({ rows: [] })                      // UPDATE token hash
    .mockResolvedValueOnce({ rows: [] });                     // COMMIT
}

/**
 * Helper to create a mock session row for validation tests
 */
function createMockSessionRow(overrides: Partial<{
  id: string;
  refresh_token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
}> = {}) {
  return {
    id: 'session-123',
    refresh_token_hash: '$2a$10$mockhash',
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0 Test Browser',
    ...overrides,
  };
}

describe('AuthService', () => {
  beforeEach(() => {
    resetMocks();
    mockGetLockoutStatus.mockReset();
    mockRecordFailedAttempt.mockReset();
    mockResetFailedAttempts.mockReset();
    mockSentry.captureException.mockReset();
  });

  describe('login', () => {
    const validPassword = 'TestPassword123';
    let validPasswordHash: string;

    beforeEach(async () => {
      // Pre-compute hash for valid password
      validPasswordHash = await bcrypt.hash(validPassword, 10);
    });

    describe('timing-safe behavior', () => {
      it('should perform bcrypt comparison even for non-existent user', async () => {
        // User not found
        mockDbQuery.mockResolvedValueOnce({ rows: [] });

        const startTime = Date.now();
        const result = await authService.login('nonexistent@example.com', 'anypassword');
        const duration = Date.now() - startTime;

        expect(result).toBeNull();
        // Should take at least some time due to bcrypt (typically 50-200ms)
        // This verifies we're not short-circuiting when user doesn't exist
        expect(duration).toBeGreaterThan(10);
      });

      it('should return null for non-existent user without revealing it', async () => {
        mockDbQuery.mockResolvedValueOnce({ rows: [] });

        const result = await authService.login('nonexistent@example.com', 'password');

        expect(result).toBeNull();
        // Should NOT record failed attempt for non-existent user
        expect(mockRecordFailedAttempt).not.toHaveBeenCalled();
      });

      it('should return null for wrong password and record failed attempt', async () => {
        const user = createMockUserRow({ password_hash: validPasswordHash });
        mockDbQuery.mockResolvedValueOnce({ rows: [user] });
        mockRecordFailedAttempt.mockResolvedValueOnce({ isLocked: false, failedAttempts: 1 });

        const result = await authService.login('test@example.com', 'wrongpassword');

        expect(result).toBeNull();
        expect(mockRecordFailedAttempt).toHaveBeenCalledWith(
          user.id,
          expect.any(Object)
        );
      });

      it('should return null for locked account even with correct password', async () => {
        const user = createMockUserRow({ password_hash: validPasswordHash });
        mockDbQuery.mockResolvedValueOnce({ rows: [user] });
        mockGetLockoutStatus.mockResolvedValueOnce({ isLocked: true, failedAttempts: 5 });

        const result = await authService.login('test@example.com', validPassword);

        // Should return null (same as invalid credentials)
        expect(result).toBeNull();
        // Should check lockout status after password validation
        expect(mockGetLockoutStatus).toHaveBeenCalledWith(user.id);
        // Should NOT reset failed attempts for locked account
        expect(mockResetFailedAttempts).not.toHaveBeenCalled();
      });
    });

    describe('successful login', () => {
      it('should return tokens for valid credentials on unlocked account', async () => {
        const user = createMockUserRow({ password_hash: validPasswordHash });
        mockSuccessfulLoginDbQueries(user);

        mockGetLockoutStatus.mockResolvedValueOnce({ isLocked: false, failedAttempts: 0 });
        mockResetFailedAttempts.mockResolvedValueOnce(undefined);

        const result = await authService.login('test@example.com', validPassword);

        expect(result).not.toBeNull();
        expect(result!.accessToken).toBeDefined();
        expect(result!.refreshToken).toBeDefined();
        expect(result!.csrfToken).toBe('mock-csrf-token');
        expect(result!.user.email).toBe('test@example.com');
      });

      it('should reset failed attempts on successful login', async () => {
        const user = createMockUserRow({ password_hash: validPasswordHash });
        mockSuccessfulLoginDbQueries(user);

        mockGetLockoutStatus.mockResolvedValueOnce({ isLocked: false, failedAttempts: 3 });
        mockResetFailedAttempts.mockResolvedValueOnce(undefined);

        await authService.login('test@example.com', validPassword);

        expect(mockResetFailedAttempts).toHaveBeenCalledWith(user.id);
      });

      it('should store device binding info (IP and user agent) in session', async () => {
        const user = createMockUserRow({ password_hash: validPasswordHash });
        mockSuccessfulLoginDbQueries(user);

        mockGetLockoutStatus.mockResolvedValueOnce({ isLocked: false, failedAttempts: 0 });
        mockResetFailedAttempts.mockResolvedValueOnce(undefined);

        await authService.login('test@example.com', validPassword, {
          ipAddress: '10.0.0.1',
          userAgent: 'Chrome/120.0',
        });

        // M-26: INSERT session now goes through client (transaction)
        const insertCall = mockClientQuery.mock.calls.find(call =>
          typeof call[0] === 'string' && call[0].includes('INSERT INTO sessions')
        );
        expect(insertCall).toBeDefined();
        expect(insertCall![1]).toContain('10.0.0.1');
        expect(insertCall![1]).toContain('Chrome/120.0');
      });
    });

    describe('lockout integration', () => {
      it('should pass context to recordFailedAttempt', async () => {
        const user = createMockUserRow({ password_hash: validPasswordHash });
        mockDbQuery.mockResolvedValueOnce({ rows: [user] });
        mockRecordFailedAttempt.mockResolvedValueOnce({ isLocked: false, failedAttempts: 1 });

        await authService.login('test@example.com', 'wrongpassword', {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        });

        expect(mockRecordFailedAttempt).toHaveBeenCalledWith(
          user.id,
          {
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          }
        );
      });

      it('should check lockout status after password validation', async () => {
        const user = createMockUserRow({ password_hash: validPasswordHash });
        mockSuccessfulLoginDbQueries(user);

        mockGetLockoutStatus.mockResolvedValueOnce({ isLocked: false, failedAttempts: 0 });
        mockResetFailedAttempts.mockResolvedValueOnce(undefined);

        await authService.login('test@example.com', validPassword);

        // Verify lockout was checked
        expect(mockGetLockoutStatus).toHaveBeenCalledWith(user.id);
      });
    });

    describe('lockout service error handling', () => {
      it('should still reject login if recordFailedAttempt throws', async () => {
        const user = createMockUserRow({ password_hash: validPasswordHash });
        mockDbQuery.mockResolvedValueOnce({ rows: [user] });
        mockRecordFailedAttempt.mockRejectedValueOnce(new Error('Database connection failed'));

        // Mock console.error to verify error is logged
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await authService.login('test@example.com', 'wrongpassword');

        // Login should still be rejected (wrong password)
        expect(result).toBeNull();
        // Error should be logged
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Lockout service error during failed attempt recording:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });

      it('should deny login (fail-secure) if getAccountLockoutStatus throws', async () => {
        const user = createMockUserRow({ password_hash: validPasswordHash });
        mockDbQuery.mockResolvedValueOnce({ rows: [user] });
        mockGetLockoutStatus.mockRejectedValueOnce(new Error('Database connection failed'));

        // Mock console.error to verify error is logged
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await authService.login('test@example.com', validPassword);

        // SECURITY: Should deny login when lockout status cannot be checked (fail-secure)
        expect(result).toBeNull();
        // Error should be logged
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Lockout service error during status check:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });

      it('should still allow login if resetFailedAttempts throws', async () => {
        const user = createMockUserRow({ password_hash: validPasswordHash });
        mockSuccessfulLoginDbQueries(user);

        mockGetLockoutStatus.mockResolvedValueOnce({ isLocked: false, failedAttempts: 3 });
        mockResetFailedAttempts.mockRejectedValueOnce(new Error('Database connection failed'));

        // Mock console.error to verify error is logged
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await authService.login('test@example.com', validPassword);

        // Login should succeed despite reset failure (user has valid credentials)
        expect(result).not.toBeNull();
        expect(result!.accessToken).toBeDefined();
        // Error should be logged
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Lockout service error during failed attempts reset:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('session limit enforcement (MEDIUM-011)', () => {
    const validPassword = 'TestPassword123';
    let validPasswordHash: string;

    beforeEach(async () => {
      validPasswordHash = await bcrypt.hash(validPassword, 10);
    });

    it('should not delete sessions when under limit', async () => {
      const user = createMockUserRow({ password_hash: validPasswordHash });
      // M-26: storeRefreshToken uses client transaction
      mockDbQuery
        .mockResolvedValueOnce({ rows: [user] })           // findUserByEmail
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }); // enforceSessionLimit COUNT (under limit)
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                      // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] })                      // UPDATE token hash
        .mockResolvedValueOnce({ rows: [] });                     // COMMIT

      mockGetLockoutStatus.mockResolvedValueOnce({ isLocked: false, failedAttempts: 0 });
      mockResetFailedAttempts.mockResolvedValueOnce(undefined);

      await authService.login('test@example.com', validPassword);

      // Should NOT have called DELETE
      const deleteCall = mockDbQuery.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('DELETE FROM sessions')
      );
      expect(deleteCall).toBeUndefined();
    });

    it('should delete oldest session when at limit (5 sessions)', async () => {
      const user = createMockUserRow({ password_hash: validPasswordHash });
      mockDbQuery
        .mockResolvedValueOnce({ rows: [user] })           // findUserByEmail
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // enforceSessionLimit COUNT (at limit)
        .mockResolvedValueOnce({ rows: [{ id: 'old-session-1' }] }); // DELETE oldest RETURNING id
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                      // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] })                      // UPDATE token hash
        .mockResolvedValueOnce({ rows: [] });                     // COMMIT

      mockGetLockoutStatus.mockResolvedValueOnce({ isLocked: false, failedAttempts: 0 });
      mockResetFailedAttempts.mockResolvedValueOnce(undefined);

      await authService.login('test@example.com', validPassword);

      // Should have called DELETE with LIMIT 1
      const deleteCall = mockDbQuery.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('DELETE FROM sessions')
      );
      expect(deleteCall).toBeDefined();
      expect(deleteCall![1]).toContain(1); // sessionsToDelete = 5 - 5 + 1 = 1
    });

    it('should delete multiple sessions when over limit', async () => {
      const user = createMockUserRow({ password_hash: validPasswordHash });
      mockDbQuery
        .mockResolvedValueOnce({ rows: [user] })           // findUserByEmail
        .mockResolvedValueOnce({ rows: [{ count: '7' }] }) // enforceSessionLimit COUNT (over limit)
        .mockResolvedValueOnce({ rows: [{ id: 'old-1' }, { id: 'old-2' }, { id: 'old-3' }] }); // DELETE 3 oldest
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                      // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] })                      // UPDATE token hash
        .mockResolvedValueOnce({ rows: [] });                     // COMMIT

      mockGetLockoutStatus.mockResolvedValueOnce({ isLocked: false, failedAttempts: 0 });
      mockResetFailedAttempts.mockResolvedValueOnce(undefined);

      await authService.login('test@example.com', validPassword);

      // Should have called DELETE with LIMIT 3
      const deleteCall = mockDbQuery.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('DELETE FROM sessions')
      );
      expect(deleteCall).toBeDefined();
      expect(deleteCall![1]).toContain(3); // sessionsToDelete = 7 - 5 + 1 = 3
    });

    it('should log SESSION_LIMIT_EXCEEDED audit event', async () => {
      const user = createMockUserRow({ password_hash: validPasswordHash });
      mockDbQuery
        .mockResolvedValueOnce({ rows: [user] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'old-session-1' }] });
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      mockGetLockoutStatus.mockResolvedValueOnce({ isLocked: false, failedAttempts: 0 });
      mockResetFailedAttempts.mockResolvedValueOnce(undefined);

      await authService.login('test@example.com', validPassword, {
        ipAddress: '10.0.0.1',
        userAgent: 'Test/1.0',
      });

      // Should have logged SESSION_LIMIT_EXCEEDED
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id,
          action: AuditAction.SESSION_LIMIT_EXCEEDED,
          status: 'SUCCESS',
          metadata: expect.objectContaining({
            sessionsDeleted: 1,
            deletedSessionIds: ['old-session-1'],
            maxSessions: 5,
          }),
        })
      );
    });
  });

  describe('refreshTokens', () => {
    describe('O(1) token validation (MEDIUM-002)', () => {
      it('should validate token using sessionId from JWT payload', async () => {
        const user = createMockUserRow();

        // Create a real token with sessionId
        const jwt = await import('jsonwebtoken');
        const tokenWithSessionId = jwt.sign(
          { userId: user.id, sessionId: 'session-123', type: 'refresh' },
          mockConfig.JWT_REFRESH_SECRET,
          { algorithm: 'HS256', expiresIn: '7d' }
        );
        const tokenHash = await bcrypt.hash(tokenWithSessionId, 10);

        // CR-2: validateAndRevoke uses client transaction
        mockClientQuery
          .mockResolvedValueOnce({ rows: [] })  // BEGIN
          .mockResolvedValueOnce({
            rows: [createMockSessionRow({ refresh_token_hash: tokenHash })]
          }) // SELECT ... FOR UPDATE
          .mockResolvedValueOnce({ rows: [] })  // DELETE old session
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        mockDbQuery
          .mockResolvedValueOnce({ rows: [user] })           // findUserById
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // enforceSessionLimit COUNT

        // M-26: storeRefreshToken via client transaction
        mockClientQuery
          .mockResolvedValueOnce({ rows: [] })                      // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'new-session' }] }) // INSERT new session
          .mockResolvedValueOnce({ rows: [] })                      // UPDATE token hash
          .mockResolvedValueOnce({ rows: [] });                     // COMMIT

        const result = await authService.refreshTokens(tokenWithSessionId);

        expect(result).not.toBeNull();
        expect(result!.accessToken).toBeDefined();
        expect(result!.refreshToken).toBeDefined();

        // CR-2: Verify FOR UPDATE was used in the SELECT query
        const lookupCall = mockClientQuery.mock.calls[1]; // 2nd client call (after BEGIN)
        expect(lookupCall).toBeDefined();
        expect(lookupCall![0]).toContain('FOR UPDATE');
        expect(lookupCall![1]).toContain('session-123');
      });

      it('should delete old session atomically within transaction', async () => {
        const user = createMockUserRow();
        const jwt = await import('jsonwebtoken');
        const tokenWithSessionId = jwt.sign(
          { userId: user.id, sessionId: 'session-to-delete', type: 'refresh' },
          mockConfig.JWT_REFRESH_SECRET,
          { algorithm: 'HS256', expiresIn: '7d' }
        );
        const tokenHash = await bcrypt.hash(tokenWithSessionId, 10);

        // CR-2: validateAndRevoke uses client transaction
        mockClientQuery
          .mockResolvedValueOnce({ rows: [] })  // BEGIN
          .mockResolvedValueOnce({
            rows: [createMockSessionRow({ id: 'session-to-delete', refresh_token_hash: tokenHash })]
          }) // SELECT ... FOR UPDATE
          .mockResolvedValueOnce({ rows: [] })  // DELETE by id
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        mockDbQuery
          .mockResolvedValueOnce({ rows: [user] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] });
        mockClientQuery
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 'new-session' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        await authService.refreshTokens(tokenWithSessionId);

        // Verify DELETE was used within the transaction (3rd client call)
        const deleteCall = mockClientQuery.mock.calls[2];
        expect(deleteCall).toBeDefined();
        expect(typeof deleteCall![0] === 'string' && deleteCall![0].includes('DELETE FROM sessions WHERE id')).toBe(true);
        expect(deleteCall![1]).toContain('session-to-delete');
      });
    });

    describe('device binding (HIGH-006)', () => {
      /**
       * Helper to set up mocks for a refresh flow with device binding test
       * CR-2: validateAndRevoke uses client transaction
       * M-26: storeRefreshToken uses client transaction
       */
      function mockRefreshFlowForDeviceTest(
        user: ReturnType<typeof createMockUserRow>,
        tokenHash: string,
        sessionOverrides: Partial<Parameters<typeof createMockSessionRow>[0]> = {}
      ) {
        // CR-2: validateAndRevoke via client transaction
        mockClientQuery
          .mockResolvedValueOnce({ rows: [] })  // BEGIN
          .mockResolvedValueOnce({
            rows: [createMockSessionRow({ refresh_token_hash: tokenHash, ...sessionOverrides })]
          }) // SELECT ... FOR UPDATE
          .mockResolvedValueOnce({ rows: [] })  // DELETE old session
          .mockResolvedValueOnce({ rows: [] }); // COMMIT

        mockDbQuery
          .mockResolvedValueOnce({ rows: [user] })           // findUserById
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // enforceSessionLimit COUNT

        // M-26: storeRefreshToken via client transaction
        mockClientQuery
          .mockResolvedValueOnce({ rows: [] })                      // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'new-session' }] }) // INSERT new session
          .mockResolvedValueOnce({ rows: [] })                      // UPDATE token hash
          .mockResolvedValueOnce({ rows: [] });                     // COMMIT
      }

      it('should log SESSION_DEVICE_CHANGE when IP changes', async () => {
        const user = createMockUserRow();
        const jwt = await import('jsonwebtoken');
        const token = jwt.sign(
          { userId: user.id, sessionId: 'session-123', type: 'refresh' },
          mockConfig.JWT_REFRESH_SECRET,
          { algorithm: 'HS256', expiresIn: '7d' }
        );
        const tokenHash = await bcrypt.hash(token, 10);

        mockRefreshFlowForDeviceTest(user, tokenHash, { ip_address: '192.168.1.1' });

        await authService.refreshTokens(token, {
          ipAddress: '10.0.0.99', // Different IP
          userAgent: 'Mozilla/5.0 Test Browser', // Same UA
        });

        // Should have logged SESSION_DEVICE_CHANGE
        expect(mockAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: user.id,
            action: AuditAction.SESSION_DEVICE_CHANGE,
            status: 'WARNING',
            metadata: expect.objectContaining({
              sessionId: 'session-123',
              ipChanged: true,
              originalIp: '192.168.1.1',
              newIp: '10.0.0.99',
            }),
          })
        );
      });

      it('should log SESSION_DEVICE_CHANGE when user agent changes', async () => {
        const user = createMockUserRow();
        const jwt = await import('jsonwebtoken');
        const token = jwt.sign(
          { userId: user.id, sessionId: 'session-123', type: 'refresh' },
          mockConfig.JWT_REFRESH_SECRET,
          { algorithm: 'HS256', expiresIn: '7d' }
        );
        const tokenHash = await bcrypt.hash(token, 10);

        mockRefreshFlowForDeviceTest(user, tokenHash, {
          ip_address: '192.168.1.1',
          user_agent: 'Chrome/120.0',
        });

        await authService.refreshTokens(token, {
          ipAddress: '192.168.1.1', // Same IP
          userAgent: 'Firefox/121.0', // Different UA
        });

        // Should have logged SESSION_DEVICE_CHANGE
        expect(mockAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.SESSION_DEVICE_CHANGE,
            status: 'WARNING',
            metadata: expect.objectContaining({
              uaChanged: true,
              userAgentChanged: true,
            }),
          })
        );
      });

      it('should NOT log when device info matches', async () => {
        const user = createMockUserRow();
        const jwt = await import('jsonwebtoken');
        const token = jwt.sign(
          { userId: user.id, sessionId: 'session-123', type: 'refresh' },
          mockConfig.JWT_REFRESH_SECRET,
          { algorithm: 'HS256', expiresIn: '7d' }
        );
        const tokenHash = await bcrypt.hash(token, 10);

        mockRefreshFlowForDeviceTest(user, tokenHash, {
          ip_address: '192.168.1.1',
          user_agent: 'Chrome/120.0',
        });

        await authService.refreshTokens(token, {
          ipAddress: '192.168.1.1', // Same
          userAgent: 'Chrome/120.0', // Same
        });

        // Should NOT have logged SESSION_DEVICE_CHANGE
        expect(mockAuditLog).not.toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.SESSION_DEVICE_CHANGE,
          })
        );
      });

      it('should NOT block refresh when device changes (lenient mode)', async () => {
        const user = createMockUserRow();
        const jwt = await import('jsonwebtoken');
        const token = jwt.sign(
          { userId: user.id, sessionId: 'session-123', type: 'refresh' },
          mockConfig.JWT_REFRESH_SECRET,
          { algorithm: 'HS256', expiresIn: '7d' }
        );
        const tokenHash = await bcrypt.hash(token, 10);

        mockRefreshFlowForDeviceTest(user, tokenHash, {
          ip_address: '192.168.1.1',
          user_agent: 'Chrome/120.0',
        });

        // Completely different device
        const result = await authService.refreshTokens(token, {
          ipAddress: '203.0.113.1', // Different IP
          userAgent: 'Safari/17.0', // Different UA
        });

        // Should still succeed (lenient mode)
        expect(result).not.toBeNull();
        expect(result!.accessToken).toBeDefined();
      });

      it('should capture to Sentry and still succeed when audit log throws (Rule 9)', async () => {
        const user = createMockUserRow();
        const jwt = await import('jsonwebtoken');
        const token = jwt.sign(
          { userId: user.id, sessionId: 'session-123', type: 'refresh' },
          mockConfig.JWT_REFRESH_SECRET,
          { algorithm: 'HS256', expiresIn: '7d' }
        );
        const tokenHash = await bcrypt.hash(token, 10);

        mockRefreshFlowForDeviceTest(user, tokenHash, {
          ip_address: '192.168.1.1',
          user_agent: 'Chrome/120.0',
        });

        // Force auditService.log to throw (simulates DB error in audit write)
        const auditError = new Error('Audit DB connection failed');
        mockAuditLog.mockRejectedValueOnce(auditError);

        // Refresh should still succeed despite audit failure
        const result = await authService.refreshTokens(token, {
          ipAddress: '10.0.0.99', // Different IP triggers audit log
          userAgent: 'Chrome/120.0',
        });

        expect(result).not.toBeNull();
        expect(result!.accessToken).toBeDefined();

        // Rule 9: Audit failure must be captured to Sentry
        expect(mockSentry.captureException).toHaveBeenCalledWith(
          auditError,
          expect.objectContaining({
            extra: expect.objectContaining({
              source: 'auth_service',
              errorType: 'device_binding_audit_failed',
            }),
          })
        );
      });
    });

    it('should return null for invalid refresh token', async () => {
      const result = await authService.refreshTokens('invalid-token');
      expect(result).toBeNull();
    });

    it('should return null for expired session', async () => {
      const user = createMockUserRow();
      const jwt = await import('jsonwebtoken');
      const token = jwt.sign(
        { userId: user.id, sessionId: 'session-123', type: 'refresh' },
        mockConfig.JWT_REFRESH_SECRET,
        { algorithm: 'HS256', expiresIn: '7d' }
      );

      // CR-2: Session not found after FOR UPDATE (expired or already revoked)
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] })  // SELECT ... FOR UPDATE (no rows)
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const result = await authService.refreshTokens(token);
      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should delete all sessions for user', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await authService.logout('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE user_id = $1',
        ['user-123']
      );
    });
  });

  describe('register', () => {
    it('should throw 409 error when email already exists', async () => {
      const existingUser = createMockUserRow({ email: 'existing@example.com' });
      mockDbQuery.mockResolvedValueOnce({ rows: [existingUser] });

      await expect(
        authService.register('existing@example.com', 'ValidPass123', { acceptedLegalTerms: true })
      ).rejects.toThrow('Email already registered');
    });

    it('should redeem invite code atomically during registration', async () => {
      // User not found (email doesn't exist) - via pool query
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      // Transaction via client:
      const newUser = createMockUserRow({
        id: 'new-user-id',
        email: 'new@example.com',
        token_version: 1,
      });
      const mockInviteCodeRow = {
        id: 'code-uuid-1',
        code: 'AB3K-M7RN',
        type: 'beta',
        organization_id: null,
        created_by: 'admin-uuid',
        used_by: null,
        used_at: null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        is_active: true,
        created_at: new Date(),
      };
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate (SELECT ... FOR UPDATE)
      mockClientQuery.mockResolvedValueOnce({ rows: [mockInviteCodeRow] });
      // createUserWithClient
      mockClientQuery.mockResolvedValueOnce({ rows: [newUser] });
      // recordLegalAcceptances (3 document types)
      const mockAcceptanceRow = { id: 'acc-1', user_id: 'new-user-id', document_type: 'baa', document_version: '0.1', ip_address: null, user_agent: null, accepted_at: new Date() };
      mockClientQuery.mockResolvedValueOnce({ rows: [mockAcceptanceRow] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'terms_of_service' }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'privacy_policy' }] });
      // markCodeAsUsed
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // H-7: Token creation for email verification (via client transaction)
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] })  // UPDATE (invalidate existing)
        .mockResolvedValueOnce({ rows: [] })  // INSERT new token
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      // Mock email sending to succeed
      const { emailService } = await import('./email-service.js');
      const sendVerificationSpy = vi.spyOn(emailService, 'sendVerificationEmail')
        .mockResolvedValueOnce(undefined);

      // Session limit check (via pool)
      mockDbQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // M-26: storeRefreshToken via client transaction
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                      // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] })                      // UPDATE token hash
        .mockResolvedValueOnce({ rows: [] });                     // COMMIT

      const result = await authService.register('new@example.com', 'ValidPass123', {
        acceptedLegalTerms: true,
        inviteCode: 'AB3K-M7RN',
      });

      expect(result).not.toBeNull();
      expect(result.user.email).toBe('new@example.com');

      // Verify FOR UPDATE was used
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
        ['AB3K-M7RN']
      );

      // Verify code was marked as used
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invite_codes SET used_by'),
        ['new-user-id', 'code-uuid-1']
      );

      sendVerificationSpy.mockRestore();
    });

    it('should throw when invite code is not found during transaction', async () => {
      // User not found (email doesn't exist)
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate - not found
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // ROLLBACK (error handler)
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        authService.register('new@example.com', 'ValidPass123', {
          acceptedLegalTerms: true,
          inviteCode: 'XXXX-XXXX',
        })
      ).rejects.toThrow('This invite code is invalid or has expired');
    });

    it('should throw when invite code is expired during transaction', async () => {
      // User not found
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const expiredCode = {
        id: 'code-uuid-1',
        code: 'AB3K-M7RN',
        type: 'beta',
        organization_id: null,
        created_by: 'admin-uuid',
        used_by: null,
        used_at: null,
        expires_at: new Date(Date.now() - 1000), // expired
        is_active: true,
        created_at: new Date(),
      };

      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate - found but expired
      mockClientQuery.mockResolvedValueOnce({ rows: [expiredCode] });
      // ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        authService.register('new@example.com', 'ValidPass123', {
          acceptedLegalTerms: true,
          inviteCode: 'AB3K-M7RN',
        })
      ).rejects.toThrow('This invite code is invalid or has expired');
    });

    it('should throw when invite code is already used during transaction', async () => {
      // User not found
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const usedCode = {
        id: 'code-uuid-1',
        code: 'AB3K-M7RN',
        type: 'beta',
        organization_id: null,
        created_by: 'admin-uuid',
        used_by: 'other-user-id',
        used_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        is_active: true,
        created_at: new Date(),
      };

      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate - found but already used
      mockClientQuery.mockResolvedValueOnce({ rows: [usedCode] });
      // ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        authService.register('new@example.com', 'ValidPass123', {
          acceptedLegalTerms: true,
          inviteCode: 'AB3K-M7RN',
        })
      ).rejects.toThrow('This invite code is invalid or has expired');
    });

    it('should still succeed if verification email fails', async () => {
      // User not found (email doesn't exist) - via pool query
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      // Transaction via client:
      const newUser = createMockUserRow({
        id: 'new-user-id',
        email: 'new@example.com',
        token_version: 1,
      });
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // createUserWithClient
      mockClientQuery.mockResolvedValueOnce({ rows: [newUser] });
      // recordLegalAcceptances (3 document types)
      const mockAcceptanceRow = { id: 'acc-1', user_id: 'new-user-id', document_type: 'baa', document_version: '0.1', ip_address: null, user_agent: null, accepted_at: new Date() };
      mockClientQuery.mockResolvedValueOnce({ rows: [mockAcceptanceRow] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'terms_of_service' }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'privacy_policy' }] });
      // COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // H-7: Token creation for email verification (via client transaction)
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] })  // UPDATE (invalidate existing)
        .mockResolvedValueOnce({ rows: [] })  // INSERT new token
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      // Mock email sending to fail
      const { emailService } = await import('./email-service.js');
      const sendVerificationSpy = vi.spyOn(emailService, 'sendVerificationEmail')
        .mockRejectedValueOnce(new Error('SMTP error'));

      // Mock console.error for the error logging
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Session limit check (via pool)
      mockDbQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // M-26: storeRefreshToken via client transaction
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                      // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] })                      // UPDATE token hash
        .mockResolvedValueOnce({ rows: [] });                     // COMMIT

      const result = await authService.register('new@example.com', 'ValidPass123', { acceptedLegalTerms: true });

      // Registration should succeed despite email failure
      expect(result).not.toBeNull();
      expect(result.user.email).toBe('new@example.com');
      expect(result.emailVerificationRequired).toBe(true);

      // LEGAL_CONSENT_ACCEPTED audit log should have been called (coupled to consent recording)
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'new-user-id',
          action: AuditAction.LEGAL_CONSENT_ACCEPTED,
          status: 'SUCCESS',
          metadata: expect.objectContaining({
            documentVersions: {
              baa: '0.1',
              terms_of_service: '0.1',
              privacy_policy: '0.1',
            },
          }),
        })
      );

      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send verification email:',
        expect.any(Error)
      );

      sendVerificationSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('refreshTokens edge cases', () => {
    it('should return null for token with wrong type', async () => {
      const jwt = await import('jsonwebtoken');
      // Create token with wrong type
      const wrongTypeToken = jwt.sign(
        { userId: 'user-123', sessionId: 'session-123', type: 'access' }, // Wrong type
        mockConfig.JWT_REFRESH_SECRET,
        { algorithm: 'HS256', expiresIn: '7d' }
      );

      const result = await authService.refreshTokens(wrongTypeToken);

      expect(result).toBeNull();
    });

    it('should reject tokens without sessionId (legacy tokens expired)', async () => {
      const jwt = await import('jsonwebtoken');

      // Token without sessionId — all such tokens have expired
      const legacyToken = jwt.sign(
        { userId: 'user-123', type: 'refresh' },
        mockConfig.JWT_REFRESH_SECRET,
        { algorithm: 'HS256', expiresIn: '7d' }
      );

      const result = await authService.refreshTokens(legacyToken);

      expect(result).toBeNull();
      // Should be rejected at verification, never hitting the DB
      expect(mockClientQuery).not.toHaveBeenCalled();
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    it('should return null and ROLLBACK when token hash does not match (CR-2)', async () => {
      const user = createMockUserRow();
      const jwt = await import('jsonwebtoken');
      const token = jwt.sign(
        { userId: user.id, sessionId: 'session-123', type: 'refresh' },
        mockConfig.JWT_REFRESH_SECRET,
        { algorithm: 'HS256', expiresIn: '7d' }
      );

      // CR-2: Session found via FOR UPDATE but hash won't match → ROLLBACK
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            id: 'session-123',
            refresh_token_hash: '$2a$10$completelydifferenthash',
            ip_address: null,
            user_agent: null,
          }],
        }) // SELECT ... FOR UPDATE (found but hash mismatch)
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const result = await authService.refreshTokens(token);

      expect(result).toBeNull();
      // Verify ROLLBACK was called (not COMMIT)
      expect(mockClientQuery).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    });
  });

  describe('storeRefreshToken transaction (M-26)', () => {
    const validPassword = 'TestPassword123';
    let validPasswordHash: string;

    beforeEach(async () => {
      validPasswordHash = await bcrypt.hash(validPassword, 10);
    });

    it('should rollback if hash UPDATE fails after INSERT', async () => {
      const user = createMockUserRow({ password_hash: validPasswordHash });
      mockDbQuery
        .mockResolvedValueOnce({ rows: [user] })           // findUserByEmail
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // enforceSessionLimit COUNT

      mockGetLockoutStatus.mockResolvedValueOnce({ isLocked: false, failedAttempts: 0 });
      mockResetFailedAttempts.mockResolvedValueOnce(undefined);

      // storeRefreshToken transaction: INSERT succeeds but UPDATE fails
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                      // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // INSERT session (succeeds)
        .mockRejectedValueOnce(new Error('UPDATE failed'))        // UPDATE hash (fails)
        .mockResolvedValueOnce({ rows: [] });                     // ROLLBACK

      await expect(
        authService.login('test@example.com', validPassword)
      ).rejects.toThrow('UPDATE failed');

      // Verify ROLLBACK was called
      expect(mockClientQuery).toHaveBeenNthCalledWith(4, 'ROLLBACK');
    });

    it('should use BCRYPT_ROUNDS constant for hashing (M-2)', async () => {
      const user = createMockUserRow({ password_hash: validPasswordHash });
      mockSuccessfulLoginDbQueries(user);

      mockGetLockoutStatus.mockResolvedValueOnce({ isLocked: false, failedAttempts: 0 });
      mockResetFailedAttempts.mockResolvedValueOnce(undefined);

      const bcryptHashSpy = vi.spyOn(bcrypt, 'hash');

      await authService.login('test@example.com', validPassword);

      // All bcrypt.hash calls in storeRefreshToken should use the BCRYPT_ROUNDS constant
      // In test, BCRYPT_ROUNDS is mocked to 10
      const storeHashCalls = bcryptHashSpy.mock.calls.filter(call =>
        call[1] === 10  // matches mock BCRYPT_ROUNDS value
      );
      expect(storeHashCalls.length).toBeGreaterThan(0);

      bcryptHashSpy.mockRestore();
    });
  });

  describe('register with clinic invite code', () => {
    it('should auto-join organization when registering with clinic code', async () => {
      // User not found (email doesn't exist) - via pool query
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      // Transaction via client:
      const newUser = createMockUserRow({
        id: 'new-user-id',
        email: 'new@example.com',
        token_version: 1,
      });
      const clinicInviteCode = {
        id: 'code-uuid-1',
        code: 'CLIN-CODE',
        type: 'clinic',
        organization_id: 'org-uuid-1',
        created_by: 'admin-uuid',
        used_by: null,
        used_at: null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        is_active: true,
        created_at: new Date(),
      };
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate
      mockClientQuery.mockResolvedValueOnce({ rows: [clinicInviteCode] });
      // createUserWithClient
      mockClientQuery.mockResolvedValueOnce({ rows: [newUser] });
      // recordLegalAcceptances (3 document types)
      const mockAcceptanceRow = { id: 'acc-1', user_id: 'new-user-id', document_type: 'baa', document_version: '0.1', ip_address: null, user_agent: null, accepted_at: new Date() };
      mockClientQuery.mockResolvedValueOnce({ rows: [mockAcceptanceRow] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'terms_of_service' }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'privacy_policy' }] });
      // SELECT max_seats, name FROM organizations FOR UPDATE
      mockClientQuery.mockResolvedValueOnce({ rows: [{ max_seats: 5, name: 'Test Clinic' }] });
      // COUNT billable seats
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      // addMember INSERT
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // updateUserOrganization UPDATE
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // markCodeAsUsed
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // H-7: Token creation for email verification (via client transaction)
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] })  // UPDATE (invalidate existing)
        .mockResolvedValueOnce({ rows: [] })  // INSERT new token
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      // Mock email sending
      const { emailService } = await import('./email-service.js');
      const sendVerificationSpy = vi.spyOn(emailService, 'sendVerificationEmail')
        .mockResolvedValueOnce(undefined);

      // Session limit check (via pool)
      mockDbQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // M-26: storeRefreshToken via client transaction
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                      // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] })                      // UPDATE token hash
        .mockResolvedValueOnce({ rows: [] });                     // COMMIT

      const result = await authService.register('new@example.com', 'ValidPass123', {
        acceptedLegalTerms: true,
        inviteCode: 'CLIN-CODE',
      });

      expect(result.joinedOrganizationId).toBe('org-uuid-1');
      expect(result.redeemedCodeId).toBe('code-uuid-1');
      expect(result.user.organizationId).toBe('org-uuid-1');

      sendVerificationSpy.mockRestore();
    });

    it('should throw 409 when clinic seat limit exceeded during registration', async () => {
      // User not found
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const clinicInviteCode = {
        id: 'code-uuid-1',
        code: 'CLIN-CODE',
        type: 'clinic',
        organization_id: 'org-uuid-1',
        created_by: 'admin-uuid',
        used_by: null,
        used_at: null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        is_active: true,
        created_at: new Date(),
      };
      const newUser = createMockUserRow({ id: 'new-user-id', email: 'new@example.com', token_version: 1 });
      const mockAcceptanceRow = { id: 'acc-1', user_id: 'new-user-id', document_type: 'baa', document_version: '0.1', ip_address: null, user_agent: null, accepted_at: new Date() };

      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // findByCodeForUpdate
      mockClientQuery.mockResolvedValueOnce({ rows: [clinicInviteCode] });
      // createUserWithClient
      mockClientQuery.mockResolvedValueOnce({ rows: [newUser] });
      // recordLegalAcceptances (3)
      mockClientQuery.mockResolvedValueOnce({ rows: [mockAcceptanceRow] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'terms_of_service' }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'privacy_policy' }] });
      // SELECT max_seats, name FROM organizations FOR UPDATE
      mockClientQuery.mockResolvedValueOnce({ rows: [{ max_seats: 3, name: 'Small Clinic' }] });
      // COUNT billable seats — at limit
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '3' }] });
      // ROLLBACK
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        authService.register('new@example.com', 'ValidPass123', {
          acceptedLegalTerms: true,
          inviteCode: 'CLIN-CODE',
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'no_seats_available',
      });
    });

    it('should throw 500 when clinic code org not found during registration', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const clinicInviteCode = {
        id: 'code-uuid-1', code: 'CLIN-CODE', type: 'clinic',
        organization_id: 'org-uuid-1', created_by: 'admin-uuid',
        used_by: null, used_at: null,
        expires_at: new Date(Date.now() + 86400000),
        is_active: true, created_at: new Date(),
      };
      const newUser = createMockUserRow({ id: 'new-user-id', email: 'new@example.com', token_version: 1 });
      const mockAcceptanceRow = { id: 'acc-1', user_id: 'new-user-id', document_type: 'baa', document_version: '0.1', ip_address: null, user_agent: null, accepted_at: new Date() };

      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [clinicInviteCode] }); // findByCodeForUpdate
      mockClientQuery.mockResolvedValueOnce({ rows: [newUser] }); // createUser
      mockClientQuery.mockResolvedValueOnce({ rows: [mockAcceptanceRow] }); // legal 1
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'terms_of_service' }] }); // legal 2
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'privacy_policy' }] }); // legal 3
      // findOrganizationByIdForUpdate — org not found (markCodeAsUsed not reached)
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(
        authService.register('new@example.com', 'ValidPass123', {
          acceptedLegalTerms: true,
          inviteCode: 'CLIN-CODE',
        })
      ).rejects.toMatchObject({
        statusCode: 500,
        code: 'invalid_invite_code',
      });
    });

    it('should throw 500 when clinic code has no organizationId (broken invariant)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const brokenClinicCode = {
        id: 'code-uuid-1', code: 'CLIN-CODE', type: 'clinic',
        organization_id: null, // broken invariant
        created_by: 'admin-uuid', used_by: null, used_at: null,
        expires_at: new Date(Date.now() + 86400000),
        is_active: true, created_at: new Date(),
      };
      const newUser = createMockUserRow({ id: 'new-user-id', email: 'new@example.com', token_version: 1 });
      const mockAcceptanceRow = { id: 'acc-1', user_id: 'new-user-id', document_type: 'baa', document_version: '0.1', ip_address: null, user_agent: null, accepted_at: new Date() };

      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [brokenClinicCode] }); // findByCodeForUpdate
      mockClientQuery.mockResolvedValueOnce({ rows: [newUser] }); // createUser
      mockClientQuery.mockResolvedValueOnce({ rows: [mockAcceptanceRow] }); // legal 1
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'terms_of_service' }] }); // legal 2
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'privacy_policy' }] }); // legal 3
      // organizationId is null → throws before org query or markCodeAsUsed
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(
        authService.register('new@example.com', 'ValidPass123', {
          acceptedLegalTerms: true,
          inviteCode: 'CLIN-CODE',
        })
      ).rejects.toMatchObject({
        statusCode: 500,
        code: 'invalid_invite_code',
      });
    });

    it('should not join org when registering with beta code', async () => {
      // User not found
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const betaCode = {
        id: 'code-uuid-1', code: 'BETA-CODE', type: 'beta',
        organization_id: null, created_by: 'admin-uuid',
        used_by: null, used_at: null,
        expires_at: new Date(Date.now() + 86400000),
        is_active: true, created_at: new Date(),
      };
      const newUser = createMockUserRow({ id: 'new-user-id', email: 'new@example.com', token_version: 1 });
      const mockAcceptanceRow = { id: 'acc-1', user_id: 'new-user-id', document_type: 'baa', document_version: '0.1', ip_address: null, user_agent: null, accepted_at: new Date() };

      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [betaCode] }); // findByCodeForUpdate
      mockClientQuery.mockResolvedValueOnce({ rows: [newUser] }); // createUser
      mockClientQuery.mockResolvedValueOnce({ rows: [mockAcceptanceRow] }); // legal 1
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'terms_of_service' }] }); // legal 2
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'privacy_policy' }] }); // legal 3
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // markCodeAsUsed
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT

      // H-7: Token creation for email verification (via client transaction)
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] })  // UPDATE (invalidate existing)
        .mockResolvedValueOnce({ rows: [] })  // INSERT new token
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const { emailService } = await import('./email-service.js');
      const sendVerificationSpy = vi.spyOn(emailService, 'sendVerificationEmail')
        .mockResolvedValueOnce(undefined);

      mockDbQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // session limit
      // M-26: storeRefreshToken via client transaction
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })                      // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] })                      // UPDATE token hash
        .mockResolvedValueOnce({ rows: [] });                     // COMMIT

      const result = await authService.register('new@example.com', 'ValidPass123', {
        acceptedLegalTerms: true,
        inviteCode: 'BETA-CODE',
      });

      expect(result.joinedOrganizationId).toBeUndefined();
      expect(result.redeemedCodeId).toBe('code-uuid-1');

      sendVerificationSpy.mockRestore();
    });
  });

  describe('sanitizeUser', () => {
    it('should include organizationId in sanitized output', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        stripeCustomerId: null,
        subscriptionId: null,
        subscriptionStatus: 'trialing' as const,
        trialEndsAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        tokenVersion: 1,
        organizationId: 'org-456',
      };

      const sanitized = sanitizeUser(user);

      expect(sanitized.organizationId).toBe('org-456');
      expect(sanitized).not.toHaveProperty('passwordHash');
    });

    it('should include null organizationId when user has no org', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash',
        stripeCustomerId: null,
        subscriptionId: null,
        subscriptionStatus: 'trialing' as const,
        trialEndsAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        tokenVersion: 1,
        organizationId: null,
      };

      const sanitized = sanitizeUser(user);

      expect(sanitized.organizationId).toBeNull();
    });
  });
});
