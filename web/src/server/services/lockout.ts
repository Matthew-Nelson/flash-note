import 'server-only';

import {
  getLockoutFields,
  recordFailedLoginAttempt,
  resetLockout,
} from '@/server/dal/users';
import { auditService } from '@/server/services/audit';
import { AuditAction } from '@/server/types';
import type { SessionContext } from '@/server/types';

/**
 * Progressive lockout thresholds.
 * After N failed attempts, account is locked for the specified duration.
 */
const LOCKOUT_THRESHOLDS = [
  { attempts: 5, durationMinutes: 15 },
  { attempts: 10, durationMinutes: 60 },
  { attempts: 15, durationMinutes: 1440 },   // 24 hours
  { attempts: 20, durationMinutes: null },    // Permanent (requires admin unlock)
] as const;

export interface LockoutStatus {
  isLocked: boolean;
  lockedUntil: Date | null;
  failedAttempts: number;
  isPermanentlyLocked: boolean;
}

/**
 * Check if an account is currently locked.
 */
export async function getAccountLockoutStatus(userId: string): Promise<LockoutStatus> {
  const fields = await getLockoutFields(userId);

  if (!fields) {
    return { isLocked: false, lockedUntil: null, failedAttempts: 0, isPermanentlyLocked: false };
  }

  const { failedLoginAttempts, lockedUntil, lastFailedLoginAt } = fields;
  const now = new Date();

  // Permanent lock: 20+ attempts with a recent failed login but no locked_until
  // (locked_until is NULL for permanent locks — distinguished from fresh accounts
  // which also have NULL locked_until but 0 attempts and no last_failed_login_at)
  const isPermanentlyLocked =
    failedLoginAttempts >= 20 &&
    lockedUntil === null &&
    lastFailedLoginAt !== null;

  // Time-limited lock still active
  const isTimeLocked = lockedUntil !== null && lockedUntil > now;

  return {
    isLocked: isPermanentlyLocked || isTimeLocked,
    lockedUntil,
    failedAttempts: failedLoginAttempts,
    isPermanentlyLocked,
  };
}

/**
 * Record a failed login attempt and potentially trigger lockout.
 * The atomic SQL in the DAL prevents race conditions.
 */
export async function recordFailedAttempt(
  userId: string,
  context: SessionContext
): Promise<LockoutStatus> {
  const result = await recordFailedLoginAttempt(userId);

  if (!result) {
    return { isLocked: false, lockedUntil: null, failedAttempts: 0, isPermanentlyLocked: false };
  }

  const { failedLoginAttempts: newAttemptCount, lockedUntil } = result;
  const lockout = determineLockout(newAttemptCount);

  if (lockout) {
    const isPermanent = lockout.durationMinutes === null;

    // Only fire audit when crossing a threshold boundary (not on every subsequent attempt)
    // Fire-and-forget — auditService.log swallows errors
    if (newAttemptCount === lockout.attempts) {
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
    }

    return {
      isLocked: true,
      lockedUntil,
      failedAttempts: newAttemptCount,
      isPermanentlyLocked: isPermanent,
    };
  }

  return {
    isLocked: false,
    lockedUntil: null,
    failedAttempts: newAttemptCount,
    isPermanentlyLocked: false,
  };
}

/**
 * Reset failed login attempts on successful login.
 */
export async function resetFailedAttempts(userId: string): Promise<void> {
  await resetLockout(userId);
}

/**
 * Admin function to manually unlock an account.
 */
export async function unlockAccount(
  userId: string,
  context: SessionContext
): Promise<void> {
  const statusBefore = await getAccountLockoutStatus(userId);

  await resetLockout(userId);

  // Fire-and-forget — auditService.log swallows errors
  await auditService.log({
    userId,
    action: AuditAction.ACCOUNT_UNLOCKED,
    status: 'SUCCESS',
    metadata: {
      previousFailedAttempts: statusBefore.failedAttempts,
      wasPermanentlyLocked: statusBefore.isPermanentlyLocked,
      unlockedBy: 'admin',
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
}

/**
 * Determine which lockout threshold applies based on attempt count.
 */
function determineLockout(
  attemptCount: number
): { attempts: number; durationMinutes: number | null } | null {
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
