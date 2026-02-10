import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDbQuery, mockClientQuery, mockAuditLog, resetMocks, createMockUserRow } from '../test/setup.js';
import bcrypt from 'bcryptjs';

// Mock config before any imports that use it
// Use vi.hoisted to ensure mock values are available before vi.mock hoisting
const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    JWT_SECRET: 'test-jwt-secret-minimum-32-characters-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars',
    NODE_ENV: 'production' as const,
    BCRYPT_ROUNDS: 10,
  },
}));

vi.mock('../config.js', () => ({
  config: mockConfig,
  BCRYPT_ROUNDS: 10,
  LEGAL_DOCUMENT_VERSIONS: {
    baa: '1.0',
    terms_of_service: '1.0',
    privacy_policy: '1.0',
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
import { authService } from './auth-service.js';
import { AuditAction } from '../types/index.js';

/**
 * Helper to set up mocks for a successful login flow
 * The new storeRefreshToken requires:
 * 1. COUNT query for session limit check
 * 2. INSERT RETURNING for session creation
 * 3. UPDATE for token hash
 */
function mockSuccessfulLoginDbQueries(user: ReturnType<typeof createMockUserRow>) {
  mockDbQuery
    .mockResolvedValueOnce({ rows: [user] })           // findUserByEmail
    .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // enforceSessionLimit COUNT
    .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // INSERT session
    .mockResolvedValueOnce({ rows: [] });              // UPDATE token hash
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

        // Verify INSERT session was called with IP and user agent
        const insertCall = mockDbQuery.mock.calls.find(call =>
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
      mockDbQuery
        .mockResolvedValueOnce({ rows: [user] })           // findUserByEmail
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // enforceSessionLimit COUNT (under limit)
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] });              // UPDATE token hash

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
        .mockResolvedValueOnce({ rows: [{ id: 'old-session-1' }] }) // DELETE oldest RETURNING id
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] });              // UPDATE token hash

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
        .mockResolvedValueOnce({ rows: [{ id: 'old-1' }, { id: 'old-2' }, { id: 'old-3' }] }) // DELETE 3 oldest
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] }) // INSERT session
        .mockResolvedValueOnce({ rows: [] });              // UPDATE token hash

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
        .mockResolvedValueOnce({ rows: [{ id: 'old-session-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'session-123' }] })
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

        mockDbQuery
          .mockResolvedValueOnce({
            rows: [createMockSessionRow({ refresh_token_hash: tokenHash })]
          }) // O(1) session lookup
          .mockResolvedValueOnce({ rows: [user] }) // findUserById
          .mockResolvedValueOnce({ rows: [] })     // DELETE old session
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // enforceSessionLimit COUNT
          .mockResolvedValueOnce({ rows: [{ id: 'new-session' }] }) // INSERT new session
          .mockResolvedValueOnce({ rows: [] });    // UPDATE token hash

        const result = await authService.refreshTokens(tokenWithSessionId);

        expect(result).not.toBeNull();
        expect(result!.accessToken).toBeDefined();
        expect(result!.refreshToken).toBeDefined();

        // Verify O(1) lookup was used (query includes session id)
        const lookupCall = mockDbQuery.mock.calls[0];
        expect(lookupCall).toBeDefined();
        expect(lookupCall![0]).toContain('WHERE id = $1 AND user_id = $2');
        expect(lookupCall![1]).toContain('session-123');
      });

      it('should delete old session with O(1) operation', async () => {
        const user = createMockUserRow();
        const jwt = await import('jsonwebtoken');
        const tokenWithSessionId = jwt.sign(
          { userId: user.id, sessionId: 'session-to-delete', type: 'refresh' },
          mockConfig.JWT_REFRESH_SECRET,
          { algorithm: 'HS256', expiresIn: '7d' }
        );
        const tokenHash = await bcrypt.hash(tokenWithSessionId, 10);

        mockDbQuery
          .mockResolvedValueOnce({
            rows: [createMockSessionRow({ id: 'session-to-delete', refresh_token_hash: tokenHash })]
          })
          .mockResolvedValueOnce({ rows: [user] })
          .mockResolvedValueOnce({ rows: [] })     // DELETE by id
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'new-session' }] })
          .mockResolvedValueOnce({ rows: [] });

        await authService.refreshTokens(tokenWithSessionId);

        // Verify O(1) delete was used
        const deleteCall = mockDbQuery.mock.calls.find(call =>
          typeof call[0] === 'string' && call[0].includes('DELETE FROM sessions WHERE id')
        );
        expect(deleteCall).toBeDefined();
        expect(deleteCall![1]).toContain('session-to-delete');
      });
    });

    describe('legacy token fallback', () => {
      it('should fall back to O(n) validation for tokens without sessionId', async () => {
        const user = createMockUserRow();
        const jwt = await import('jsonwebtoken');

        // Legacy token WITHOUT sessionId
        const legacyToken = jwt.sign(
          { userId: user.id, type: 'refresh' },
          mockConfig.JWT_REFRESH_SECRET,
          { algorithm: 'HS256', expiresIn: '7d' }
        );
        const tokenHash = await bcrypt.hash(legacyToken, 10);

        mockDbQuery
          .mockResolvedValueOnce({
            rows: [createMockSessionRow({ refresh_token_hash: tokenHash })]
          }) // O(n) legacy lookup (by user_id only)
          .mockResolvedValueOnce({ rows: [user] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'new-session' }] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await authService.refreshTokens(legacyToken);

        expect(result).not.toBeNull();

        // Verify O(n) lookup was used (query only has user_id, not session id)
        const lookupCall = mockDbQuery.mock.calls[0];
        expect(lookupCall).toBeDefined();
        expect(lookupCall![0]).toContain('WHERE user_id = $1');
        expect(lookupCall![0]).not.toContain('WHERE id = $1');
      });

      it('should not call revokeRefreshToken for legacy tokens', async () => {
        const user = createMockUserRow();
        const jwt = await import('jsonwebtoken');

        const legacyToken = jwt.sign(
          { userId: user.id, type: 'refresh' },
          mockConfig.JWT_REFRESH_SECRET,
          { algorithm: 'HS256', expiresIn: '7d' }
        );
        const tokenHash = await bcrypt.hash(legacyToken, 10);

        mockDbQuery
          .mockResolvedValueOnce({
            rows: [createMockSessionRow({ refresh_token_hash: tokenHash })]
          })
          .mockResolvedValueOnce({ rows: [user] })
          // No DELETE call for legacy tokens
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'new-session' }] })
          .mockResolvedValueOnce({ rows: [] });

        await authService.refreshTokens(legacyToken);

        // Should NOT have DELETE FROM sessions WHERE id = $1 (only user-level delete in logout)
        const deleteByIdCall = mockDbQuery.mock.calls.find(call =>
          typeof call[0] === 'string' &&
          call[0].includes('DELETE FROM sessions WHERE id = $1') &&
          !call[0].includes('WHERE id IN')
        );
        expect(deleteByIdCall).toBeUndefined();
      });
    });

    describe('device binding (HIGH-006)', () => {
      it('should log SESSION_DEVICE_CHANGE when IP changes', async () => {
        const user = createMockUserRow();
        const jwt = await import('jsonwebtoken');
        const token = jwt.sign(
          { userId: user.id, sessionId: 'session-123', type: 'refresh' },
          mockConfig.JWT_REFRESH_SECRET,
          { algorithm: 'HS256', expiresIn: '7d' }
        );
        const tokenHash = await bcrypt.hash(token, 10);

        mockDbQuery
          .mockResolvedValueOnce({
            rows: [createMockSessionRow({
              refresh_token_hash: tokenHash,
              ip_address: '192.168.1.1', // Original IP
            })]
          })
          .mockResolvedValueOnce({ rows: [user] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'new-session' }] })
          .mockResolvedValueOnce({ rows: [] });

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

        mockDbQuery
          .mockResolvedValueOnce({
            rows: [createMockSessionRow({
              refresh_token_hash: tokenHash,
              ip_address: '192.168.1.1',
              user_agent: 'Chrome/120.0', // Original UA
            })]
          })
          .mockResolvedValueOnce({ rows: [user] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'new-session' }] })
          .mockResolvedValueOnce({ rows: [] });

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

        mockDbQuery
          .mockResolvedValueOnce({
            rows: [createMockSessionRow({
              refresh_token_hash: tokenHash,
              ip_address: '192.168.1.1',
              user_agent: 'Chrome/120.0',
            })]
          })
          .mockResolvedValueOnce({ rows: [user] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'new-session' }] })
          .mockResolvedValueOnce({ rows: [] });

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

        mockDbQuery
          .mockResolvedValueOnce({
            rows: [createMockSessionRow({
              refresh_token_hash: tokenHash,
              ip_address: '192.168.1.1',
              user_agent: 'Chrome/120.0',
            })]
          })
          .mockResolvedValueOnce({ rows: [user] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'new-session' }] })
          .mockResolvedValueOnce({ rows: [] });

        // Completely different device
        const result = await authService.refreshTokens(token, {
          ipAddress: '203.0.113.1', // Different IP
          userAgent: 'Safari/17.0', // Different UA
        });

        // Should still succeed (lenient mode)
        expect(result).not.toBeNull();
        expect(result!.accessToken).toBeDefined();
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

      // Session not found (expired or deleted)
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

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
      const mockAcceptanceRow = { id: 'acc-1', user_id: 'new-user-id', document_type: 'baa', document_version: '1.0', ip_address: null, user_agent: null, accepted_at: new Date() };
      mockClientQuery.mockResolvedValueOnce({ rows: [mockAcceptanceRow] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'terms_of_service' }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'privacy_policy' }] });
      // markCodeAsUsed
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Token creation for email verification (via pool query)
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // invalidate existing
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // insert new token

      // Mock email sending to succeed
      const { emailService } = await import('./email-service.js');
      const sendVerificationSpy = vi.spyOn(emailService, 'sendVerificationEmail')
        .mockResolvedValueOnce(undefined);

      // Session limit check
      mockDbQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Insert session
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'session-123' }] });
      // Update token hash
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

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
      const mockAcceptanceRow = { id: 'acc-1', user_id: 'new-user-id', document_type: 'baa', document_version: '1.0', ip_address: null, user_agent: null, accepted_at: new Date() };
      mockClientQuery.mockResolvedValueOnce({ rows: [mockAcceptanceRow] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'terms_of_service' }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ ...mockAcceptanceRow, document_type: 'privacy_policy' }] });
      // COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      // Token creation for email verification (via pool query)
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // invalidate existing
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // insert new token

      // Mock email sending to fail
      const { emailService } = await import('./email-service.js');
      const sendVerificationSpy = vi.spyOn(emailService, 'sendVerificationEmail')
        .mockRejectedValueOnce(new Error('SMTP error'));

      // Mock console.error for the error logging
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Session limit check
      mockDbQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Insert session
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: 'session-123' }] });
      // Update token hash
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

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
              baa: '1.0',
              terms_of_service: '1.0',
              privacy_policy: '1.0',
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

    it('should return null when legacy token has no matching hash', async () => {
      const user = createMockUserRow();
      const jwt = await import('jsonwebtoken');

      // Legacy token WITHOUT sessionId
      const legacyToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        mockConfig.JWT_REFRESH_SECRET,
        { algorithm: 'HS256', expiresIn: '7d' }
      );

      // Return sessions but none will match the token hash
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          { id: 'session-1', refresh_token_hash: '$2a$10$differenthash1' },
          { id: 'session-2', refresh_token_hash: '$2a$10$differenthash2' },
        ],
      });

      const result = await authService.refreshTokens(legacyToken);

      expect(result).toBeNull();
    });

    it('should return null when token hash does not match session hash', async () => {
      const user = createMockUserRow();
      const jwt = await import('jsonwebtoken');
      const token = jwt.sign(
        { userId: user.id, sessionId: 'session-123', type: 'refresh' },
        mockConfig.JWT_REFRESH_SECRET,
        { algorithm: 'HS256', expiresIn: '7d' }
      );

      // Session found but hash won't match
      mockDbQuery.mockResolvedValueOnce({
        rows: [{
          id: 'session-123',
          refresh_token_hash: '$2a$10$completelydifferenthash',
          ip_address: null,
          user_agent: null,
        }],
      });

      const result = await authService.refreshTokens(token);

      expect(result).toBeNull();
    });
  });
});
