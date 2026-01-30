import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbQuery, mockAuditLog, resetMocks } from '../test/setup.js';
import { lockoutService } from './lockout-service.js';
import { AuditAction } from '../types/index.js';

describe('LockoutService', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('getAccountLockoutStatus', () => {
    it('should return not locked for user with no failed attempts', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 0, locked_until: null, last_failed_login_at: null }],
      });

      const status = await lockoutService.getAccountLockoutStatus('user-123');

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(0);
      expect(status.isPermanentlyLocked).toBe(false);
    });

    it('should return not locked for user with attempts below threshold', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 4, locked_until: null, last_failed_login_at: new Date() }],
      });

      const status = await lockoutService.getAccountLockoutStatus('user-123');

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(4);
    });

    it('should return locked when locked_until is in the future', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 5, locked_until: futureDate, last_failed_login_at: new Date() }],
      });

      const status = await lockoutService.getAccountLockoutStatus('user-123');

      expect(status.isLocked).toBe(true);
      expect(status.lockedUntil).toEqual(futureDate);
      expect(status.isPermanentlyLocked).toBe(false);
    });

    it('should return not locked when locked_until has passed', async () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 5, locked_until: pastDate, last_failed_login_at: new Date() }],
      });

      const status = await lockoutService.getAccountLockoutStatus('user-123');

      expect(status.isLocked).toBe(false);
    });

    it('should return permanently locked for 20+ attempts with null locked_until and recent failed login', async () => {
      // Permanent lockout requires: 20+ attempts, null locked_until, AND a last_failed_login_at
      // This distinguishes it from a fresh account (which also has null locked_until)
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 20, locked_until: null, last_failed_login_at: new Date() }],
      });

      const status = await lockoutService.getAccountLockoutStatus('user-123');

      expect(status.isLocked).toBe(true);
      expect(status.isPermanentlyLocked).toBe(true);
      expect(status.lockedUntil).toBeNull();
    });

    it('should NOT return permanently locked for 20+ attempts without last_failed_login_at', async () => {
      // This tests the fix for the permanent lockout logic bug
      // A fresh account has null last_failed_login_at and shouldn't be considered locked
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 20, locked_until: null, last_failed_login_at: null }],
      });

      const status = await lockoutService.getAccountLockoutStatus('user-123');

      // Should NOT be locked because last_failed_login_at is null
      expect(status.isLocked).toBe(false);
      expect(status.isPermanentlyLocked).toBe(false);
    });

    it('should handle non-existent user', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const status = await lockoutService.getAccountLockoutStatus('non-existent');

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(0);
    });
  });

  describe('recordFailedAttempt', () => {
    it('should increment failed attempts atomically', async () => {
      // Single atomic query returns both failed_login_attempts and locked_until
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 1, locked_until: null }],
      });

      const status = await lockoutService.recordFailedAttempt('user-123', {});

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('failed_login_attempts = failed_login_attempts + 1'),
        ['user-123']
      );
      // Verify the query also handles lockout atomically
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('locked_until = CASE'),
        ['user-123']
      );
      expect(status.failedAttempts).toBe(1);
      expect(status.isLocked).toBe(false);
    });

    it('should trigger 15-minute lockout at 5 failures (atomic)', async () => {
      // Single atomic query - lockout is set in the same query as increment
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 5, locked_until: lockedUntil }],
      });

      const status = await lockoutService.recordFailedAttempt('user-123', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      // Only ONE query should have been made (atomic operation)
      expect(mockDbQuery).toHaveBeenCalledTimes(1);

      expect(status.isLocked).toBe(true);
      expect(status.isPermanentlyLocked).toBe(false);
      expect(status.lockedUntil).toBeInstanceOf(Date);

      // Verify audit log was called
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: AuditAction.ACCOUNT_LOCKED,
          status: 'SUCCESS',
          metadata: expect.objectContaining({
            failedAttempts: 5,
            lockoutType: 'temporary',
            lockoutMinutes: 15,
          }),
        })
      );
    });

    it('should trigger 1-hour lockout at 10 failures (atomic)', async () => {
      const lockedUntil = new Date(Date.now() + 60 * 60 * 1000);
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 10, locked_until: lockedUntil }],
      });

      const status = await lockoutService.recordFailedAttempt('user-123', {});

      // Only ONE query should have been made (atomic operation)
      expect(mockDbQuery).toHaveBeenCalledTimes(1);
      expect(status.isLocked).toBe(true);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            lockoutMinutes: 60,
          }),
        })
      );
    });

    it('should trigger 24-hour lockout at 15 failures (atomic)', async () => {
      const lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 15, locked_until: lockedUntil }],
      });

      const status = await lockoutService.recordFailedAttempt('user-123', {});

      // Only ONE query should have been made (atomic operation)
      expect(mockDbQuery).toHaveBeenCalledTimes(1);
      expect(status.isLocked).toBe(true);
    });

    it('should trigger permanent lockout at 20 failures (atomic)', async () => {
      // Permanent lockout: locked_until is NULL (set by the CASE statement)
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 20, locked_until: null }],
      });

      const status = await lockoutService.recordFailedAttempt('user-123', {});

      // Only ONE query should have been made (atomic operation)
      expect(mockDbQuery).toHaveBeenCalledTimes(1);
      expect(status.isLocked).toBe(true);
      expect(status.isPermanentlyLocked).toBe(true);
      expect(status.lockedUntil).toBeNull();

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            lockoutType: 'permanent',
          }),
        })
      );
    });

    it('should not trigger lockout below threshold', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 4, locked_until: null }],
      });

      const status = await lockoutService.recordFailedAttempt('user-123', {});

      expect(status.isLocked).toBe(false);
      expect(mockAuditLog).not.toHaveBeenCalled();
    });

    it('should handle non-existent user gracefully', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const status = await lockoutService.recordFailedAttempt('non-existent', {});

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(0);
    });

    it('should use single atomic query to prevent race conditions', async () => {
      // This test verifies the race condition fix
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 5, locked_until: lockedUntil }],
      });

      await lockoutService.recordFailedAttempt('user-123', {});

      // Verify only ONE database call was made
      expect(mockDbQuery).toHaveBeenCalledTimes(1);

      // Verify the query contains both the increment AND the CASE for locked_until
      const queryArg = mockDbQuery.mock.calls[0]![0] as string;
      expect(queryArg).toContain('failed_login_attempts = failed_login_attempts + 1');
      expect(queryArg).toContain('locked_until = CASE');
      expect(queryArg).toContain('RETURNING failed_login_attempts, locked_until');
    });
  });

  describe('resetFailedAttempts', () => {
    it('should reset all lockout fields', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await lockoutService.resetFailedAttempts('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('failed_login_attempts = 0'),
        ['user-123']
      );
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('locked_until = NULL'),
        ['user-123']
      );
    });
  });

  describe('unlockAccount', () => {
    it('should reset lockout and log audit event', async () => {
      // Mock getAccountLockoutStatus - must include last_failed_login_at for permanent lock detection
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 20, locked_until: null, last_failed_login_at: new Date() }],
      });
      // Mock the reset query
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await lockoutService.unlockAccount('user-123', {
        ipAddress: '127.0.0.1',
        userAgent: 'admin-console',
      });

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: AuditAction.ACCOUNT_UNLOCKED,
          status: 'SUCCESS',
          metadata: expect.objectContaining({
            previousFailedAttempts: 20,
            wasPermanentlyLocked: true,
            unlockedBy: 'admin',
          }),
        })
      );
    });
  });

  describe('progressive lockout thresholds', () => {
    const testCases = [
      { attempts: 1, shouldLock: false },
      { attempts: 4, shouldLock: false },
      { attempts: 5, shouldLock: true, minutes: 15 },
      { attempts: 6, shouldLock: true, minutes: 15 },
      { attempts: 9, shouldLock: true, minutes: 15 },
      { attempts: 10, shouldLock: true, minutes: 60 },
      { attempts: 14, shouldLock: true, minutes: 60 },
      { attempts: 15, shouldLock: true, minutes: 1440 },
      { attempts: 19, shouldLock: true, minutes: 1440 },
      { attempts: 20, shouldLock: true, permanent: true },
      { attempts: 100, shouldLock: true, permanent: true },
    ];

    testCases.forEach(({ attempts, shouldLock, minutes, permanent }) => {
      it(`should ${shouldLock ? 'lock' : 'not lock'} at ${attempts} attempts${minutes ? ` for ${minutes} min` : ''}${permanent ? ' (permanent)' : ''}`, async () => {
        // Single atomic query returns both failed_login_attempts and locked_until
        const lockedUntil = shouldLock && !permanent
          ? new Date(Date.now() + (minutes ?? 0) * 60 * 1000)
          : null;

        mockDbQuery.mockResolvedValueOnce({
          rows: [{ failed_login_attempts: attempts, locked_until: lockedUntil }],
        });

        const status = await lockoutService.recordFailedAttempt('user-123', {});

        // Verify only ONE query was made (atomic operation)
        expect(mockDbQuery).toHaveBeenCalledTimes(1);
        expect(status.isLocked).toBe(shouldLock);
        if (permanent) {
          expect(status.isPermanentlyLocked).toBe(true);
        }
      });
    });
  });
});
