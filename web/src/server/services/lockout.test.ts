import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before importing (config.ts calls process.exit without DATABASE_URL)
vi.mock('@/server/db/config', () => ({}));

import { mockDbQuery, resetMocks } from '@/test/dal-helpers';

// Mock audit service
const mockAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock('@/server/services/audit', () => ({
  auditService: { log: (...args: unknown[]) => mockAuditLog(...args) },
}));

import {
  getAccountLockoutStatus,
  recordFailedAttempt,
  resetFailedAttempts,
  unlockAccount,
} from './lockout';

describe('lockout service', () => {
  beforeEach(() => {
    resetMocks();
    mockAuditLog.mockReset();
  });

  describe('getAccountLockoutStatus', () => {
    it('returns unlocked for user with no failed attempts', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 0, locked_until: null, last_failed_login_at: null }],
      });

      const status = await getAccountLockoutStatus('user-1');

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(0);
      expect(status.isPermanentlyLocked).toBe(false);
    });

    it('returns unlocked when user not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const status = await getAccountLockoutStatus('nonexistent');

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(0);
    });

    it('returns time-locked when locked_until is in the future', async () => {
      const futureDate = new Date(Date.now() + 15 * 60 * 1000);
      mockDbQuery.mockResolvedValueOnce({
        rows: [{
          failed_login_attempts: 5,
          locked_until: futureDate,
          last_failed_login_at: new Date(),
        }],
      });

      const status = await getAccountLockoutStatus('user-1');

      expect(status.isLocked).toBe(true);
      expect(status.lockedUntil).toBe(futureDate);
      expect(status.isPermanentlyLocked).toBe(false);
    });

    it('returns unlocked when locked_until is in the past', async () => {
      const pastDate = new Date(Date.now() - 1000);
      mockDbQuery.mockResolvedValueOnce({
        rows: [{
          failed_login_attempts: 5,
          locked_until: pastDate,
          last_failed_login_at: new Date(),
        }],
      });

      const status = await getAccountLockoutStatus('user-1');

      expect(status.isLocked).toBe(false);
    });

    it('detects permanent lock (20+ attempts, null locked_until, has last_failed)', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{
          failed_login_attempts: 20,
          locked_until: null,
          last_failed_login_at: new Date(),
        }],
      });

      const status = await getAccountLockoutStatus('user-1');

      expect(status.isLocked).toBe(true);
      expect(status.isPermanentlyLocked).toBe(true);
    });

    it('does not false-positive permanent lock on fresh account', async () => {
      // Fresh account: 0 attempts, null locked_until, null last_failed_login_at
      mockDbQuery.mockResolvedValueOnce({
        rows: [{
          failed_login_attempts: 0,
          locked_until: null,
          last_failed_login_at: null,
        }],
      });

      const status = await getAccountLockoutStatus('user-1');

      expect(status.isLocked).toBe(false);
      expect(status.isPermanentlyLocked).toBe(false);
    });
  });

  describe('recordFailedAttempt', () => {
    const context = { ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' };

    it('records attempt with no lockout triggered (below threshold)', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 3, locked_until: null }],
      });

      const status = await recordFailedAttempt('user-1', context);

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(3);
      expect(mockAuditLog).not.toHaveBeenCalled();
    });

    it('triggers 15-min lockout at 5 attempts', async () => {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 5, locked_until: lockedUntil }],
      });

      const status = await recordFailedAttempt('user-1', context);

      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(5);
      expect(status.isPermanentlyLocked).toBe(false);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ACCOUNT_LOCKED',
          metadata: expect.objectContaining({
            lockoutType: 'temporary',
            lockoutMinutes: 15,
          }),
        })
      );
    });

    it('triggers 1-hour lockout at 10 attempts', async () => {
      const lockedUntil = new Date(Date.now() + 60 * 60 * 1000);
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 10, locked_until: lockedUntil }],
      });

      const status = await recordFailedAttempt('user-1', context);

      expect(status.isLocked).toBe(true);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ lockoutMinutes: 60 }),
        })
      );
    });

    it('triggers 24-hour lockout at 15 attempts', async () => {
      const lockedUntil = new Date(Date.now() + 1440 * 60 * 1000);
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 15, locked_until: lockedUntil }],
      });

      const status = await recordFailedAttempt('user-1', context);

      expect(status.isLocked).toBe(true);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ lockoutMinutes: 1440 }),
        })
      );
    });

    it('triggers permanent lockout at 20 attempts', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 20, locked_until: null }],
      });

      const status = await recordFailedAttempt('user-1', context);

      expect(status.isLocked).toBe(true);
      expect(status.isPermanentlyLocked).toBe(true);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            lockoutType: 'permanent',
            reason: 'Exceeded maximum failed login attempts',
          }),
        })
      );
    });

    it('does not fire audit for attempts above threshold but not at exact boundary', async () => {
      // 7 attempts — above 5-attempt threshold but not at 10-attempt threshold
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 7, locked_until: lockedUntil }],
      });

      const status = await recordFailedAttempt('user-1', context);

      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(7);
      expect(mockAuditLog).not.toHaveBeenCalled();
    });

    it('handles missing user gracefully', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const status = await recordFailedAttempt('nonexistent', context);

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(0);
    });
  });

  describe('resetFailedAttempts', () => {
    it('calls resetLockout DAL function', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await resetFailedAttempts('user-1');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('failed_login_attempts = 0'),
        ['user-1']
      );
    });
  });

  describe('unlockAccount', () => {
    it('resets lockout and fires audit log', async () => {
      // getAccountLockoutStatus query
      mockDbQuery.mockResolvedValueOnce({
        rows: [{
          failed_login_attempts: 20,
          locked_until: null,
          last_failed_login_at: new Date(),
        }],
      });
      // resetLockout query
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const context = { ipAddress: '127.0.0.1', userAgent: 'Admin/1.0' };
      await unlockAccount('user-1', context);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ACCOUNT_UNLOCKED',
          metadata: expect.objectContaining({
            previousFailedAttempts: 20,
            wasPermanentlyLocked: true,
          }),
        })
      );
    });
  });
});
