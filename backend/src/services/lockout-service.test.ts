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
        rows: [{ failed_login_attempts: 0, locked_until: null }],
      });

      const status = await lockoutService.getAccountLockoutStatus('user-123');

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(0);
      expect(status.isPermanentlyLocked).toBe(false);
    });

    it('should return not locked for user with attempts below threshold', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 4, locked_until: null }],
      });

      const status = await lockoutService.getAccountLockoutStatus('user-123');

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(4);
    });

    it('should return locked when locked_until is in the future', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 5, locked_until: futureDate }],
      });

      const status = await lockoutService.getAccountLockoutStatus('user-123');

      expect(status.isLocked).toBe(true);
      expect(status.lockedUntil).toEqual(futureDate);
      expect(status.isPermanentlyLocked).toBe(false);
    });

    it('should return not locked when locked_until has passed', async () => {
      const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 5, locked_until: pastDate }],
      });

      const status = await lockoutService.getAccountLockoutStatus('user-123');

      expect(status.isLocked).toBe(false);
    });

    it('should return permanently locked for 20+ attempts with null locked_until', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 20, locked_until: null }],
      });

      const status = await lockoutService.getAccountLockoutStatus('user-123');

      expect(status.isLocked).toBe(true);
      expect(status.isPermanentlyLocked).toBe(true);
      expect(status.lockedUntil).toBeNull();
    });

    it('should handle non-existent user', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const status = await lockoutService.getAccountLockoutStatus('non-existent');

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(0);
    });
  });

  describe('recordFailedAttempt', () => {
    it('should increment failed attempts', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 1 }],
      });

      const status = await lockoutService.recordFailedAttempt('user-123', {});

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('failed_login_attempts = failed_login_attempts + 1'),
        ['user-123']
      );
      expect(status.failedAttempts).toBe(1);
      expect(status.isLocked).toBe(false);
    });

    it('should trigger 15-minute lockout at 5 failures', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ failed_login_attempts: 5 }] }) // increment
        .mockResolvedValueOnce({ rows: [] }); // set locked_until

      const status = await lockoutService.recordFailedAttempt('user-123', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(status.isLocked).toBe(true);
      expect(status.isPermanentlyLocked).toBe(false);
      expect(status.lockedUntil).toBeInstanceOf(Date);

      // Verify lockout duration is approximately 15 minutes
      const expectedLockout = 15 * 60 * 1000;
      const actualLockout = status.lockedUntil!.getTime() - Date.now();
      expect(actualLockout).toBeGreaterThan(expectedLockout - 1000);
      expect(actualLockout).toBeLessThan(expectedLockout + 1000);

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

    it('should trigger 1-hour lockout at 10 failures', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ failed_login_attempts: 10 }] })
        .mockResolvedValueOnce({ rows: [] });

      const status = await lockoutService.recordFailedAttempt('user-123', {});

      expect(status.isLocked).toBe(true);

      // Verify lockout duration is approximately 1 hour
      const expectedLockout = 60 * 60 * 1000;
      const actualLockout = status.lockedUntil!.getTime() - Date.now();
      expect(actualLockout).toBeGreaterThan(expectedLockout - 1000);
      expect(actualLockout).toBeLessThan(expectedLockout + 1000);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            lockoutMinutes: 60,
          }),
        })
      );
    });

    it('should trigger 24-hour lockout at 15 failures', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ failed_login_attempts: 15 }] })
        .mockResolvedValueOnce({ rows: [] });

      const status = await lockoutService.recordFailedAttempt('user-123', {});

      expect(status.isLocked).toBe(true);

      // Verify lockout duration is approximately 24 hours
      const expectedLockout = 24 * 60 * 60 * 1000;
      const actualLockout = status.lockedUntil!.getTime() - Date.now();
      expect(actualLockout).toBeGreaterThan(expectedLockout - 1000);
      expect(actualLockout).toBeLessThan(expectedLockout + 1000);
    });

    it('should trigger permanent lockout at 20 failures', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ failed_login_attempts: 20 }] })
        .mockResolvedValueOnce({ rows: [] });

      const status = await lockoutService.recordFailedAttempt('user-123', {});

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
      mockDbQuery.mockResolvedValueOnce({ rows: [{ failed_login_attempts: 4 }] });

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
      // Mock getAccountLockoutStatus
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 20, locked_until: null }],
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
        mockDbQuery.mockResolvedValueOnce({ rows: [{ failed_login_attempts: attempts }] });
        if (shouldLock) {
          mockDbQuery.mockResolvedValueOnce({ rows: [] });
        }

        const status = await lockoutService.recordFailedAttempt('user-123', {});

        expect(status.isLocked).toBe(shouldLock);
        if (permanent) {
          expect(status.isPermanentlyLocked).toBe(true);
        }
      });
    });
  });
});
