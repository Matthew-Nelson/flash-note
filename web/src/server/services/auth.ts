import 'server-only';

import bcrypt from 'bcryptjs';

import { getPoolClient } from '@/server/db';
import { BCRYPT_ROUNDS, LEGAL_DOCUMENT_VERSIONS } from '@/server/db/config';
import { findUserByEmail, createUserWithClient, updatePassword, resetLockout, updateUserOrganization, markEmailVerified } from '@/server/dal/users';
import { createSession, deleteSessionsByUserId } from '@/server/dal/sessions';
import { recordLegalAcceptances } from '@/server/dal/legal-acceptances';
import { findByCodeForUpdate, markCodeAsUsed, validateCodeRedeemable } from '@/server/dal/invite-codes';
import { findOrganizationByIdForUpdate } from '@/server/dal/organizations';
import { addMember, countBillableSeats } from '@/server/dal/organization-members';
import { getAccountLockoutStatus, recordFailedAttempt, resetFailedAttempts } from './lockout';
import { createToken, validateAndConsumeToken } from './token';
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
  | { success: true; userId: string }
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
    // Timing equalization: always call recordFailedAttempt regardless of whether
    // the user exists. When user is null, recordFailedAttempt executes the same
    // primary DB round-trip against a nil UUID (no rows match) to equalize the
    // dominant cost of both paths.
    try {
      await recordFailedAttempt(user?.id ?? null, context);
    } catch (error) {
      // TODO: Replace with Pino structured logger when available
      // eslint-disable-next-line no-console
      console.error('Lockout service error during failed attempt recording:', error);
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
    // HIPAA: Log the authentication attempt for the locked account audit trail.
    // When a locked account submits the correct password, the normal
    // recordFailedAttempt path is bypassed. Audit this event separately.
    await auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN_FAILED,
      status: 'FAILURE',
      metadata: { reason: 'account_locked', emailProvided: true },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
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

  // Audit logs OUTSIDE the transaction (fire-and-forget — auditService.log swallows errors)
  await auditService.log({
    userId: user.id,
    action: AuditAction.REGISTER,
    status: 'SUCCESS',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  await auditService.log({
    userId: user.id,
    action: AuditAction.LEGAL_CONSENT_ACCEPTED,
    status: 'SUCCESS',
    metadata: { documentVersions: LEGAL_DOCUMENT_VERSIONS },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  if (redeemedCodeId) {
    await auditService.log({
      userId: user.id,
      action: AuditAction.INVITE_CODE_REDEEMED,
      status: 'SUCCESS',
      metadata: { codeId: redeemedCodeId },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  if (joinedOrganizationId) {
    await auditService.log({
      userId: user.id,
      action: AuditAction.ORG_MEMBER_JOINED,
      status: 'SUCCESS',
      metadata: { organizationId: joinedOrganizationId, source: 'registration' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
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
 * Verify a user's email address atomically.
 *
 * Transaction: consume token + mark email verified (Rule 1).
 * Returns userId on success, null if token is invalid/expired/consumed.
 */
export async function verifyEmail(token: string): Promise<string | null> {
  const client = await getPoolClient();
  try {
    await client.query('BEGIN');

    const userId = await validateAndConsumeToken(token, 'email_verification', client);
    if (!userId) {
      await client.query('ROLLBACK');
      return null;
    }

    await markEmailVerified(userId, client);

    await client.query('COMMIT');
    return userId;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* connection may be unusable */ }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Complete a password reset flow.
 *
 * Transaction: consume token + update password + delete all sessions + reset lockout (Rule 1).
 * Audit log fires AFTER commit (try-catch, error-level on failure).
 */
export async function completePasswordReset(
  token: string,
  password: string,
  context: SessionContext
): Promise<ResetResult> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const client = await getPoolClient();
  let userId: string;
  try {
    await client.query('BEGIN');

    const resolvedUserId = await validateAndConsumeToken(token, 'password_reset', client);
    if (!resolvedUserId) {
      await client.query('ROLLBACK');
      return { success: false, error: 'invalid_token' };
    }
    userId = resolvedUserId;

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

  // Audit outside transaction (fire-and-forget)
  await auditService.log({
    userId,
    action: AuditAction.PASSWORD_RESET_SUCCESS,
    status: 'SUCCESS',
    metadata: { sessionsInvalidated: true },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return { success: true, userId };
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
