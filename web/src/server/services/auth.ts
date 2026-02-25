import 'server-only';

import bcrypt from 'bcryptjs';

import { getPoolClient } from '@/server/db';
import { BCRYPT_ROUNDS, LEGAL_DOCUMENT_VERSIONS } from '@/server/db/config';
import { findUserByEmail, createUserWithClient, updatePassword, resetLockout, updateUserOrganization } from '@/server/dal/users';
import { createSession, deleteSessionsByUserId } from '@/server/dal/sessions';
import { recordLegalAcceptances } from '@/server/dal/legal-acceptances';
import { findByCodeForUpdate, markCodeAsUsed, validateCodeRedeemable } from '@/server/dal/invite-codes';
import { findOrganizationByIdForUpdate } from '@/server/dal/organizations';
import { addMember, countBillableSeats } from '@/server/dal/organization-members';
import { getAccountLockoutStatus, recordFailedAttempt, resetFailedAttempts } from './lockout';
import { createToken } from './token';
import { sendVerificationEmail } from './email';
import { auditService } from './audit';
import { AuditAction } from '@/server/types';
import type { User, SessionContext } from '@/server/types';

// SECURITY: Dummy hash for timing-safe password comparison when user doesn't exist.
// Prevents timing attacks that could reveal whether an email is registered.
// Generated with bcrypt.hashSync('dummy_password_never_matches', 12)
const DUMMY_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYq1IpHBBUGK';

// --- Result types ---

export interface SanitizedUser {
  id: string;
  email: string;
  subscriptionStatus: string;
  trialEndsAt: Date;
  emailVerified: boolean;
  organizationId: string | null;
}

type LoginResult =
  | { success: true; user: SanitizedUser; token: string; emailVerificationRequired: boolean }
  | { success: false; error: string };

type RegisterResult =
  | { success: true; user: SanitizedUser; token: string }
  | { success: false; error: string };

type ResetResult =
  | { success: true }
  | { success: false; error: string };

interface RegisterContext extends SessionContext {
  inviteCode?: string;
}

// --- Auth functions ---

/**
 * Authenticate a user with email and password.
 *
 * Security patterns:
 * - Timing-safe: always runs bcrypt compare (DUMMY_HASH for missing users)
 * - Fail-secure: lockout check errors → deny access
 * - Fail-soft: lockout reset errors → allow login (user has valid credentials)
 * - Same error for invalid credentials and locked account (no lockout reveal)
 */
export async function login(
  email: string,
  password: string,
  context: SessionContext
): Promise<LoginResult> {
  const user = await findUserByEmail(email);

  // Timing-safe: always compare, even when user doesn't exist
  const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
  const validPassword = await bcrypt.compare(password, hashToCompare);

  if (!user || !validPassword) {
    if (user) {
      // Record failed attempt — may trigger lockout
      try {
        await recordFailedAttempt(user.id, context);
      } catch (error) {
        // TODO: Replace with Pino structured logger when available
        // eslint-disable-next-line no-console
        console.error('Lockout service error during failed attempt recording:', error);
      }
    }
    return { success: false, error: 'invalid_credentials' };
  }

  // Check lockout status AFTER password validation (no timing oracle)
  let lockoutStatus;
  try {
    lockoutStatus = await getAccountLockoutStatus(user.id);
  } catch (error) {
    // Fail-secure: can't check lockout → deny access
    // TODO: Replace with Pino structured logger when available
    // eslint-disable-next-line no-console
    console.error('Lockout service error during status check:', error);
    return { success: false, error: 'invalid_credentials' };
  }

  if (lockoutStatus.isLocked) {
    // Don't reveal that the password was correct
    return { success: false, error: 'invalid_credentials' };
  }

  // Reset failed attempts (fail-soft: don't block login if reset fails)
  try {
    await resetFailedAttempts(user.id);
  } catch (error) {
    // TODO: Replace with Pino structured logger when available
    // eslint-disable-next-line no-console
    console.error('Lockout service error during failed attempts reset:', error);
  }

  // Create session
  const session = await createSession(user.id, context);

  return {
    success: true,
    user: sanitizeUser(user),
    token: session.token,
    emailVerificationRequired: !user.emailVerified,
  };
}

/**
 * Register a new user account.
 *
 * Transaction: user + legal acceptances + invite code redemption + org join + session
 * Audit logs fire AFTER commit (try-catch each, error-level on failure).
 * Verification email is non-blocking (try-catch, user can resend).
 */
export async function register(
  email: string,
  password: string,
  context: RegisterContext
): Promise<RegisterResult> {
  // Check if user exists
  const existing = await findUserByEmail(email);
  if (existing) {
    return { success: false, error: 'email_exists' };
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Transaction: create user + record legal consent + redeem invite code + session
  const client = await getPoolClient();
  let user: User;
  let sessionToken: string;
  let redeemedCodeId: string | undefined;
  let joinedOrganizationId: string | undefined;
  try {
    await client.query('BEGIN');

    // If invite code provided, lock and validate inside transaction
    let validatedCode: Awaited<ReturnType<typeof findByCodeForUpdate>> = null;
    if (context.inviteCode) {
      validatedCode = await findByCodeForUpdate(client, context.inviteCode);
      if (!validatedCode) {
        await client.query('ROLLBACK');
        return { success: false, error: 'invalid_invite_code' };
      }
      const invalidReason = validateCodeRedeemable(validatedCode);
      if (invalidReason) {
        await client.query('ROLLBACK');
        return { success: false, error: 'invalid_invite_code' };
      }
    }

    user = await createUserWithClient(client, email, passwordHash);

    await recordLegalAcceptances(
      client,
      user.id,
      context.ipAddress ?? null,
      context.userAgent ?? null
    );

    // Clinic invite code → auto-join organization
    if (validatedCode?.type === 'clinic') {
      if (!validatedCode.organizationId) {
        await client.query('ROLLBACK');
        return { success: false, error: 'invalid_invite_code' };
      }

      const orgRow = await findOrganizationByIdForUpdate(client, validatedCode.organizationId);
      if (!orgRow) {
        await client.query('ROLLBACK');
        return { success: false, error: 'invalid_invite_code' };
      }

      const billableSeats = await countBillableSeats(client, validatedCode.organizationId);
      if (billableSeats >= orgRow.maxSeats) {
        await client.query('ROLLBACK');
        return { success: false, error: 'no_seats_available' };
      }

      await addMember(client, validatedCode.organizationId, user.id, 'member', true);
      await updateUserOrganization(client, user.id, validatedCode.organizationId);

      joinedOrganizationId = validatedCode.organizationId;
      user = { ...user, organizationId: validatedCode.organizationId };
    }

    // Mark invite code as used
    if (validatedCode) {
      await markCodeAsUsed(client, validatedCode.id, user.id);
      redeemedCodeId = validatedCode.id;
    }

    // Create session within the same transaction
    const session = await createSession(user.id, context, client);
    sessionToken = session.token;

    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* connection may be unusable */ }
    // Handle unique constraint violation on email (TOCTOU race between findUserByEmail and INSERT)
    if (isUniqueViolation(error)) {
      return { success: false, error: 'email_exists' };
    }
    throw error;
  } finally {
    client.release();
  }

  // Audit logs OUTSIDE the transaction — each wrapped in try-catch
  try {
    await auditService.log({
      userId: user.id,
      action: AuditAction.REGISTER,
      status: 'SUCCESS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  } catch (error) {
    // TODO: Replace with Pino structured logger when available
    // eslint-disable-next-line no-console
    console.error('Audit log failed for REGISTER:', error);
  }

  try {
    await auditService.log({
      userId: user.id,
      action: AuditAction.LEGAL_CONSENT_ACCEPTED,
      status: 'SUCCESS',
      metadata: { documentVersions: LEGAL_DOCUMENT_VERSIONS },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Audit log failed for LEGAL_CONSENT_ACCEPTED:', error);
  }

  if (redeemedCodeId) {
    try {
      await auditService.log({
        userId: user.id,
        action: AuditAction.INVITE_CODE_REDEEMED,
        status: 'SUCCESS',
        metadata: { codeId: redeemedCodeId },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Audit log failed for INVITE_CODE_REDEEMED:', error);
    }
  }

  if (joinedOrganizationId) {
    try {
      await auditService.log({
        userId: user.id,
        action: AuditAction.ORG_MEMBER_JOINED,
        status: 'SUCCESS',
        metadata: { organizationId: joinedOrganizationId, source: 'registration' },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Audit log failed for ORG_MEMBER_JOINED:', error);
    }
  }

  // Send verification email (non-blocking — user can resend)
  try {
    const verificationToken = await createToken(user.id, 'email_verification');
    await sendVerificationEmail(email, verificationToken);
  } catch (error) {
    // TODO: Replace with Pino structured logger when available
    // eslint-disable-next-line no-console
    console.error('Failed to send verification email:', error);
  }

  return {
    success: true,
    user: sanitizeUser(user),
    token: sessionToken,
  };
}

/**
 * Complete a password reset flow.
 *
 * Transaction: update password + delete all sessions + reset lockout
 * Audit log fires AFTER commit (try-catch, error-level on failure).
 */
export async function completePasswordReset(
  userId: string,
  password: string,
  context: SessionContext
): Promise<ResetResult> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const client = await getPoolClient();
  try {
    await client.query('BEGIN');

    const rowsUpdated = await updatePassword(userId, passwordHash, client);
    if (rowsUpdated === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'not_found' };
    }

    await deleteSessionsByUserId(userId, client);
    await resetLockout(userId, client);

    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* connection may be unusable */ }
    throw error;
  } finally {
    client.release();
  }

  // Audit outside transaction
  try {
    await auditService.log({
      userId,
      action: AuditAction.PASSWORD_RESET_SUCCESS,
      status: 'SUCCESS',
      metadata: { sessionsInvalidated: true },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  } catch (error) {
    // TODO: Replace with Pino structured logger when available
    // eslint-disable-next-line no-console
    console.error('Audit log failed for PASSWORD_RESET_SUCCESS:', error);
  }

  return { success: true };
}

/**
 * Strip sensitive fields from a User for client consumption.
 */
export function sanitizeUser(user: User): SanitizedUser {
  return {
    id: user.id,
    email: user.email,
    subscriptionStatus: user.subscriptionStatus,
    trialEndsAt: user.trialEndsAt,
    emailVerified: user.emailVerified,
    organizationId: user.organizationId,
  };
}

// --- Internal helpers ---

/**
 * Check if an error is a PostgreSQL unique constraint violation (code 23505).
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}
