import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDbQuery, resetMocks, createMockUserRow } from '../test/setup.js';
import bcrypt from 'bcryptjs';

// Mock config before any imports that use it
// Use vi.hoisted to ensure mock values are available before vi.mock hoisting
const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    JWT_SECRET: 'test-jwt-secret-minimum-32-characters-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars',
    NODE_ENV: 'production' as const,
  },
}));

vi.mock('../config.js', () => ({
  config: mockConfig,
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
        mockDbQuery
          .mockResolvedValueOnce({ rows: [user] }) // findUserByEmail
          .mockResolvedValueOnce({ rows: [] }); // storeRefreshToken

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
        mockDbQuery
          .mockResolvedValueOnce({ rows: [user] })
          .mockResolvedValueOnce({ rows: [] });

        mockGetLockoutStatus.mockResolvedValueOnce({ isLocked: false, failedAttempts: 3 });
        mockResetFailedAttempts.mockResolvedValueOnce(undefined);

        await authService.login('test@example.com', validPassword);

        expect(mockResetFailedAttempts).toHaveBeenCalledWith(user.id);
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
        mockDbQuery
          .mockResolvedValueOnce({ rows: [user] })
          .mockResolvedValueOnce({ rows: [] });

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
        mockDbQuery
          .mockResolvedValueOnce({ rows: [user] }) // findUserByEmail
          .mockResolvedValueOnce({ rows: [] }); // storeRefreshToken

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
});
