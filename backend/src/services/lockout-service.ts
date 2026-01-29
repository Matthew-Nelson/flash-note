import { db } from '../db/index.js';
import { auditService } from './audit-service.js';
import { AuditAction } from '../types/index.js';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Progressive lockout thresholds
 * After N failed attempts, account is locked for the specified duration
 * In development, thresholds are 10x higher to avoid lockouts during testing
 */
const LOCKOUT_THRESHOLDS = isDev ? [
  { attempts: 50, durationMinutes: 1 },       // Dev: very lenient
  { attempts: 100, durationMinutes: 5 },
  { attempts: 150, durationMinutes: 15 },
  { attempts: 200, durationMinutes: null },
] as const : [
  { attempts: 5, durationMinutes: 15 },       // First lockout: 15 minutes
  { attempts: 10, durationMinutes: 60 },      // Second lockout: 1 hour
  { attempts: 15, durationMinutes: 60 * 24 }, // Third lockout: 24 hours
  { attempts: 20, durationMinutes: null },    // Permanent lockout (requires admin unlock)
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
      `SELECT failed_login_attempts, locked_until, last_failed_login_at
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

    const { failed_login_attempts, locked_until, last_failed_login_at } = result.rows[0];
    const now = new Date();

    // Check if permanently locked (20+ attempts with a recent failed login)
    // We check last_failed_login_at to distinguish from fresh accounts (which have
    // failed_login_attempts = 0, locked_until = null, last_failed_login_at = null)
    const isPermanentlyLocked = failed_login_attempts >= 20 &&
      locked_until === null &&
      last_failed_login_at !== null;

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
   *
   * SECURITY: This uses a single atomic SQL query to both increment the counter
   * AND set the lockout timestamp, preventing race conditions where rapid concurrent
   * requests could slip through before lockout is applied.
   */
  async recordFailedAttempt(
    userId: string,
    context: LockoutContext
  ): Promise<LockoutStatus> {
    // SECURITY: Single atomic query that increments AND sets lockout in one operation
    // This prevents race conditions where concurrent requests could bypass lockout
    // Note: Thresholds match LOCKOUT_THRESHOLDS constant (adjusted for dev/prod)
    const t = LOCKOUT_THRESHOLDS;
    const result = await db.query(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           last_failed_login_at = NOW(),
           updated_at = NOW(),
           locked_until = CASE
             WHEN failed_login_attempts + 1 >= ${t[3]?.attempts ?? 200} THEN NULL
             WHEN failed_login_attempts + 1 >= ${t[2]?.attempts ?? 150} THEN NOW() + INTERVAL '${t[2]?.durationMinutes ?? 15} minutes'
             WHEN failed_login_attempts + 1 >= ${t[1]?.attempts ?? 100} THEN NOW() + INTERVAL '${t[1]?.durationMinutes ?? 5} minutes'
             WHEN failed_login_attempts + 1 >= ${t[0]?.attempts ?? 50} THEN NOW() + INTERVAL '${t[0]?.durationMinutes ?? 1} minutes'
             ELSE locked_until
           END
       WHERE id = $1
       RETURNING failed_login_attempts, locked_until`,
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

    const { failed_login_attempts: newAttemptCount, locked_until } = result.rows[0];

    // Determine if we triggered a lockout (for audit logging)
    const lockout = this.determineLockout(newAttemptCount);

    if (lockout) {
      const isPermanent = lockout.durationMinutes === null;
      const lockedUntil = locked_until ? new Date(locked_until) : null;

      // Log lockout event (audit logging is async but non-critical)
      await auditService.log({
        userId,
        action: AuditAction.ACCOUNT_LOCKED,
        status: 'SUCCESS',
        metadata: {
          failedAttempts: newAttemptCount,
          lockoutType: isPermanent ? 'permanent' : 'temporary',
          ...(isPermanent
            ? { reason: 'Exceeded maximum failed login attempts' }
            : { lockoutMinutes: lockout.durationMinutes, expiresAt: lockedUntil?.toISOString() }),
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return {
        isLocked: true,
        lockedUntil,
        failedAttempts: newAttemptCount,
        isPermanentlyLocked: isPermanent,
      };
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
