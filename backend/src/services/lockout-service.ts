import { db } from '../db/index.js';
import { auditService } from './audit-service.js';
import { AuditAction } from '../types/index.js';

/**
 * Progressive lockout thresholds
 * After N failed attempts, account is locked for the specified duration
 */
const LOCKOUT_THRESHOLDS = [
  { attempts: 5, durationMinutes: 15 },      // First lockout: 15 minutes
  { attempts: 10, durationMinutes: 60 },     // Second lockout: 1 hour
  { attempts: 15, durationMinutes: 60 * 24 }, // Third lockout: 24 hours
  { attempts: 20, durationMinutes: null },   // Permanent lockout (requires admin unlock)
] as const;

interface LockoutStatus {
  isLocked: boolean;
  lockedUntil: Date | null;
  failedAttempts: number;
  isPermanentlyLocked: boolean;
}

interface LockoutContext {
  ipAddress?: string;
  userAgent?: string;
}

class LockoutService {
  /**
   * Check if an account is currently locked
   * Returns lockout status including time remaining
   */
  async getAccountLockoutStatus(userId: string): Promise<LockoutStatus> {
    const result = await db.query(
      `SELECT failed_login_attempts, locked_until
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        isLocked: false,
        lockedUntil: null,
        failedAttempts: 0,
        isPermanentlyLocked: false,
      };
    }

    const { failed_login_attempts, locked_until } = result.rows[0];
    const now = new Date();

    // Check if permanently locked (20+ attempts with no expiry)
    const isPermanentlyLocked = failed_login_attempts >= 20 && locked_until === null;

    // Check if time-limited lock is still active
    const isTimeLocked = locked_until !== null && new Date(locked_until) > now;

    return {
      isLocked: isPermanentlyLocked || isTimeLocked,
      lockedUntil: locked_until ? new Date(locked_until) : null,
      failedAttempts: failed_login_attempts,
      isPermanentlyLocked,
    };
  }

  /**
   * Record a failed login attempt and potentially trigger lockout
   * Returns the new lockout status
   */
  async recordFailedAttempt(
    userId: string,
    context: LockoutContext
  ): Promise<LockoutStatus> {
    // Atomically increment failed attempts and get new count
    const result = await db.query(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           last_failed_login_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING failed_login_attempts`,
      [userId]
    );

    if (result.rows.length === 0) {
      // User doesn't exist - shouldn't happen but handle gracefully
      return {
        isLocked: false,
        lockedUntil: null,
        failedAttempts: 0,
        isPermanentlyLocked: false,
      };
    }

    const newAttemptCount = result.rows[0].failed_login_attempts;

    // Determine if we should apply a lockout
    const lockout = this.determineLockout(newAttemptCount);

    if (lockout) {
      if (lockout.durationMinutes === null) {
        // Permanent lockout
        await db.query(
          `UPDATE users SET locked_until = NULL WHERE id = $1`,
          [userId]
        );

        // Log permanent lockout event
        await auditService.log({
          userId,
          action: AuditAction.ACCOUNT_LOCKED,
          status: 'SUCCESS',
          metadata: {
            failedAttempts: newAttemptCount,
            lockoutType: 'permanent',
            reason: 'Exceeded maximum failed login attempts',
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return {
          isLocked: true,
          lockedUntil: null,
          failedAttempts: newAttemptCount,
          isPermanentlyLocked: true,
        };
      } else {
        // Time-limited lockout
        const lockedUntil = new Date(Date.now() + lockout.durationMinutes * 60 * 1000);

        await db.query(
          `UPDATE users SET locked_until = $1 WHERE id = $2`,
          [lockedUntil, userId]
        );

        // Log lockout event
        await auditService.log({
          userId,
          action: AuditAction.ACCOUNT_LOCKED,
          status: 'SUCCESS',
          metadata: {
            failedAttempts: newAttemptCount,
            lockoutType: 'temporary',
            lockoutMinutes: lockout.durationMinutes,
            expiresAt: lockedUntil.toISOString(),
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return {
          isLocked: true,
          lockedUntil,
          failedAttempts: newAttemptCount,
          isPermanentlyLocked: false,
        };
      }
    }

    // No lockout triggered yet
    return {
      isLocked: false,
      lockedUntil: null,
      failedAttempts: newAttemptCount,
      isPermanentlyLocked: false,
    };
  }

  /**
   * Reset failed login attempts on successful login
   */
  async resetFailedAttempts(userId: string): Promise<void> {
    await db.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_failed_login_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
  }

  /**
   * Admin function to manually unlock an account
   */
  async unlockAccount(
    userId: string,
    adminContext: LockoutContext
  ): Promise<void> {
    const statusBefore = await this.getAccountLockoutStatus(userId);

    await db.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_failed_login_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    // Log the unlock action
    await auditService.log({
      userId,
      action: AuditAction.ACCOUNT_UNLOCKED,
      status: 'SUCCESS',
      metadata: {
        previousFailedAttempts: statusBefore.failedAttempts,
        wasPermanentlyLocked: statusBefore.isPermanentlyLocked,
        unlockedBy: 'admin', // Could be enhanced to include admin user ID
      },
      ipAddress: adminContext.ipAddress,
      userAgent: adminContext.userAgent,
    });
  }

  /**
   * Determine which lockout threshold applies based on attempt count
   */
  private determineLockout(
    attemptCount: number
  ): { attempts: number; durationMinutes: number | null } | null {
    // Find the highest threshold that's been exceeded
    for (let i = LOCKOUT_THRESHOLDS.length - 1; i >= 0; i--) {
      const threshold = LOCKOUT_THRESHOLDS[i];
      if (threshold && attemptCount >= threshold.attempts) {
        return {
          attempts: threshold.attempts,
          durationMinutes: threshold.durationMinutes,
        };
      }
    }
    return null;
  }
}

export const lockoutService = new LockoutService();
