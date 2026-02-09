import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as Sentry from '@sentry/node';
import { config, BCRYPT_ROUNDS, LEGAL_DOCUMENT_VERSIONS } from '../config.js';
import { db } from '../db/index.js';
import { findUserByEmail, findUserById, createUserWithClient } from '../db/queries/users.js';
import { recordLegalAcceptances } from '../db/queries/legal-acceptances.js';
import { AppError } from '../middleware/error-handler.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { lockoutService } from './lockout-service.js';
import { tokenService } from './token-service.js';
import { emailService } from './email-service.js';
import { auditService } from './audit-service.js';
import type { TokenPayload, User } from '../types/index.js';
import { AuditAction } from '../types/index.js';
import type { SessionValidationRow } from '../types/database.js';

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// MEDIUM-011: Session limit to prevent unbounded growth and mitigate O(n) legacy token validation
const MAX_SESSIONS_PER_USER = 5;

// SECURITY: Dummy hash for timing-safe password comparison when user doesn't exist
// This prevents timing attacks that could reveal whether an email is registered
// Generated with bcrypt.hashSync('dummy_password_never_matches', 12)
const DUMMY_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYq1IpHBBUGK';

interface LoginContext {
  ipAddress?: string;
  userAgent?: string;
}

interface RegisterContext extends LoginContext {
  acceptedLegalTerms: true;
}

class AuthService {
  async register(email: string, password: string, context: RegisterContext) {
    // Check if user exists
    const existing = await findUserByEmail(email);
    if (existing) {
      throw new AppError(409, 'email_exists', 'Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user + record legal consent atomically
    const client = await db.connect();
    let user;
    try {
      await client.query('BEGIN');
      user = await createUserWithClient(client, email, passwordHash);

      try {
        await recordLegalAcceptances(
          client,
          user.id,
          context.ipAddress ?? null,
          context.userAgent ?? null
        );
      } catch (error) {
        Sentry.captureException(error, {
          extra: {
            source: 'auth_service',
            errorType: 'legal_acceptance_recording_failed',
            userId: user.id,
          },
        });
        throw error;
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // HIPAA: Audit legal consent acceptance (coupled to DB recording above)
    await auditService.log({
      userId: user.id,
      action: AuditAction.LEGAL_CONSENT_ACCEPTED,
      status: 'SUCCESS',
      metadata: { documentVersions: LEGAL_DOCUMENT_VERSIONS },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Generate and send verification email
    // SECURITY: Do this after user creation to ensure audit trail
    try {
      const verificationToken = await tokenService.createToken(user.id, 'email_verification');
      await emailService.sendVerificationEmail(email, verificationToken);
    } catch (error) {
      // Capture to Sentry - new users silently blocked without verification email
      Sentry.captureException(error, {
        extra: {
          source: 'auth_service',
          errorType: 'verification_email_failed',
          userId: user.id,
        },
      });
      // Log error but don't fail registration - user can resend verification
      console.error('Failed to send verification email:', error);
    }

    // Generate access token
    const accessToken = this.generateAccessToken(user.id, user.email, user.tokenVersion);

    // Store refresh token and get session info (HIGH-006: includes device binding)
    const { refreshToken } = await this.storeRefreshToken(user.id, context);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
      csrfToken: generateCsrfToken(user.id),
      emailVerificationRequired: true,
    };
  }

  async login(email: string, password: string, context: LoginContext = {}) {
    const user = await findUserByEmail(email);

    // SECURITY: Always perform bcrypt comparison to prevent timing attacks
    // If user doesn't exist, compare against dummy hash
    // This ensures consistent response time regardless of whether email exists
    const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
    const validPassword = await bcrypt.compare(password, hashToCompare);

    // If user doesn't exist or password is wrong, record failure (if user exists) and return null
    if (!user || !validPassword) {
      if (user) {
        // Record failed attempt - may trigger lockout
        // SECURITY: Wrap in try-catch to fail-secure. If lockout service fails,
        // we still reject the login but don't want to leak error info or crash.
        try {
          await lockoutService.recordFailedAttempt(user.id, context);
        } catch (error) {
          // Capture to Sentry - security control failure visibility
          Sentry.captureException(error, {
            extra: {
              source: 'lockout_service',
              errorType: 'failed_attempt_recording',
              userId: user.id,
            },
          });
          // Log error for investigation but continue with login rejection
          // This prevents lockout service failures from blocking the auth flow
          console.error('Lockout service error during failed attempt recording:', error);
        }
      }
      return null;
    }

    // SECURITY: Check lockout status AFTER password validation
    // This prevents lockout status from being a timing oracle
    // Even if password is correct, locked accounts cannot log in
    let lockoutStatus;
    try {
      lockoutStatus = await lockoutService.getAccountLockoutStatus(user.id);
    } catch (error) {
      // Capture to Sentry - security control failure visibility
      Sentry.captureException(error, {
        extra: {
          source: 'lockout_service',
          errorType: 'status_check_failed',
          userId: user.id,
        },
      });
      // SECURITY: Fail-secure - if we can't check lockout status, deny access
      // Log error for investigation
      console.error('Lockout service error during status check:', error);
      return null;
    }

    if (lockoutStatus.isLocked) {
      // Don't reveal that the password was correct - return same error as invalid credentials
      return null;
    }

    // Success - reset failed attempts counter
    // SECURITY: Wrap in try-catch - if reset fails, still allow login but log error
    // The user has valid credentials and isn't locked, so blocking them here
    // would be unnecessarily disruptive
    try {
      await lockoutService.resetFailedAttempts(user.id);
    } catch (error) {
      // Capture to Sentry - security control failure visibility
      Sentry.captureException(error, {
        extra: {
          source: 'lockout_service',
          errorType: 'reset_failed_attempts',
          userId: user.id,
        },
      });
      // Log error but don't block successful login
      console.error('Lockout service error during failed attempts reset:', error);
    }

    // Generate access token
    const accessToken = this.generateAccessToken(user.id, user.email, user.tokenVersion);

    // Store refresh token and get session info (HIGH-006: includes device binding)
    const { refreshToken } = await this.storeRefreshToken(user.id, context);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
      csrfToken: generateCsrfToken(user.id),
    };
  }

  async refreshTokens(refreshToken: string, context: LoginContext = {}) {
    // Verify the refresh token
    const payload = this.verifyRefreshToken(refreshToken);
    if (!payload) return null;

    // Check if refresh token is valid in database (O(1) with sessionId, O(n) for legacy)
    // HIGH-006: Also checks device binding and logs mismatches
    const validationResult = await this.validateRefreshToken(
      payload.userId,
      payload.sessionId,
      refreshToken,
      context
    );
    if (!validationResult.valid) return null;

    // Get user
    const user = await findUserById(payload.userId);
    if (!user) return null;

    // Revoke old refresh token (O(1) with sessionId)
    await this.revokeRefreshToken(payload.sessionId);

    // Generate new access token
    const newAccessToken = this.generateAccessToken(user.id, user.email, user.tokenVersion);

    // Store new refresh token with device binding (preserves original device info)
    const { refreshToken: newRefreshToken } = await this.storeRefreshToken(user.id, context);

    return {
      user: this.sanitizeUser(user),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      csrfToken: generateCsrfToken(user.id),
    };
  }

  async logout(userId: string): Promise<void> {
    // Revoke all refresh tokens for user
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  private generateAccessToken(userId: string, email: string, tokenVersion: number): string {
    // SECURITY: Explicitly specify HS256 algorithm
    // SECURITY: Include tokenVersion to enable immediate invalidation on password reset
    return jwt.sign(
      { userId, email, tokenVersion } as TokenPayload,
      config.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY, algorithm: 'HS256' }
    );
  }

  private generateRefreshToken(userId: string, sessionId: string): string {
    // SECURITY: Explicitly specify HS256 algorithm
    // MEDIUM-002: Include sessionId for O(1) lookup instead of O(n) bcrypt loop
    return jwt.sign(
      { userId, sessionId, type: 'refresh' },
      config.JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY, algorithm: 'HS256' }
    );
  }

  private verifyRefreshToken(token: string): { userId: string; sessionId: string } | null {
    try {
      // SECURITY: Explicitly specify algorithm to prevent algorithm confusion attacks
      const payload = jwt.verify(token, config.JWT_REFRESH_SECRET, {
        algorithms: ['HS256'],
      }) as {
        userId: string;
        sessionId?: string;  // Optional for backwards compat with legacy tokens
        type: string;
      };
      if (payload.type !== 'refresh') return null;
      // Return empty string for sessionId if not present (legacy token)
      return { userId: payload.userId, sessionId: payload.sessionId ?? '' };
    } catch {
      return null;
    }
  }

  /**
   * Creates a new session and generates a refresh token for it.
   * Uses insert-then-update pattern to get sessionId before generating the token.
   *
   * HIGH-006: Stores device binding info (IP, user agent) for audit trail
   * MEDIUM-011: Enforces session limit before creating new session
   * MEDIUM-002: Returns sessionId to enable O(1) token validation
   */
  private async storeRefreshToken(
    userId: string,
    context: LoginContext = {}
  ): Promise<{ sessionId: string; refreshToken: string }> {
    // MEDIUM-011: Enforce session limit before creating new session
    await this.enforceSessionLimit(userId, context);

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    // Step 1: Insert session with placeholder hash to get the ID
    const insertResult = await db.query<{ id: string }>(
      `INSERT INTO sessions (user_id, refresh_token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, 'placeholder', $2, $3, $4)
       RETURNING id`,
      [userId, expiresAt, context.ipAddress ?? null, context.userAgent ?? null]
    );

    // INSERT with RETURNING always returns the inserted row
    if (!insertResult.rows[0]) {
      throw new Error('Failed to create session');
    }
    const sessionId = insertResult.rows[0].id;

    // Step 2: Generate token with sessionId included
    const refreshToken = this.generateRefreshToken(userId, sessionId);

    // Step 3: Hash and update the session with the real token hash
    const hash = await bcrypt.hash(refreshToken, 10);
    await db.query(
      'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
      [hash, sessionId]
    );

    return { sessionId, refreshToken };
  }

  /**
   * MEDIUM-011: Enforces max sessions per user by deleting oldest sessions.
   * Uses seamless UX approach - login always works, oldest sessions are cleaned up.
   */
  private async enforceSessionLimit(userId: string, context: LoginContext = {}): Promise<void> {
    const countResult = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM sessions WHERE user_id = $1',
      [userId]
    );

    // COUNT(*) always returns exactly one row
    const sessionCount = parseInt(countResult.rows[0]?.count ?? '0', 10);

    if (sessionCount >= MAX_SESSIONS_PER_USER) {
      // Calculate how many sessions to delete to make room for the new one
      const sessionsToDelete = sessionCount - MAX_SESSIONS_PER_USER + 1;

      // Delete oldest sessions (by created_at) and return their IDs for audit
      const deleteResult = await db.query<{ id: string }>(
        `DELETE FROM sessions
         WHERE id IN (
           SELECT id FROM sessions
           WHERE user_id = $1
           ORDER BY created_at ASC
           LIMIT $2
         )
         RETURNING id`,
        [userId, sessionsToDelete]
      );

      // HIPAA: Log session limit enforcement for audit trail
      await auditService.log({
        userId,
        action: AuditAction.SESSION_LIMIT_EXCEEDED,
        status: 'SUCCESS',
        metadata: {
          sessionsDeleted: deleteResult.rows.length,
          deletedSessionIds: deleteResult.rows.map((r) => r.id),
          maxSessions: MAX_SESSIONS_PER_USER,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }
  }

  /**
   * MEDIUM-002: O(1) token validation using sessionId from JWT payload.
   * Falls back to O(n) legacy validation for tokens without sessionId.
   *
   * HIGH-006: Checks device binding and logs mismatches (lenient - doesn't block).
   */
  private async validateRefreshToken(
    userId: string,
    sessionId: string,
    refreshToken: string,
    context: LoginContext = {}
  ): Promise<{ valid: boolean; session?: SessionValidationRow }> {
    // Backwards compat: Legacy tokens don't have sessionId
    if (!sessionId) {
      return this.validateLegacyRefreshToken(userId, refreshToken);
    }

    // O(1) lookup by session ID (primary key) + user_id for security
    const result = await db.query<SessionValidationRow>(
      `SELECT id, refresh_token_hash, ip_address, user_agent
       FROM sessions
       WHERE id = $1 AND user_id = $2 AND expires_at > NOW()`,
      [sessionId, userId]
    );

    const session = result.rows[0];
    if (!session) {
      return { valid: false };
    }

    // Single bcrypt comparison instead of O(n) loop
    const tokenValid = await bcrypt.compare(refreshToken, session.refresh_token_hash);
    if (!tokenValid) {
      return { valid: false };
    }

    // HIGH-006: Check device binding, log mismatches (lenient - don't block)
    await this.checkDeviceBinding(userId, sessionId, session, context);

    return { valid: true, session };
  }

  /**
   * HIGH-006: Logs device binding mismatches for security monitoring.
   * Lenient approach: logs but doesn't block, since PT staff frequently change networks.
   */
  private async checkDeviceBinding(
    userId: string,
    sessionId: string,
    session: SessionValidationRow,
    context: LoginContext
  ): Promise<void> {
    const ipChanged = session.ip_address !== null &&
                      context.ipAddress !== undefined &&
                      session.ip_address !== context.ipAddress;
    const uaChanged = session.user_agent !== null &&
                      context.userAgent !== undefined &&
                      session.user_agent !== context.userAgent;

    if (ipChanged || uaChanged) {
      // HIPAA: Log device change for security audit trail
      await auditService.log({
        userId,
        action: AuditAction.SESSION_DEVICE_CHANGE,
        status: 'WARNING',
        metadata: {
          sessionId,
          ipChanged,
          uaChanged,
          originalIp: session.ip_address,
          newIp: ipChanged ? context.ipAddress : undefined,
          // Don't log full user agents - they can be long and contain fingerprinting data
          userAgentChanged: uaChanged,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }
  }

  /**
   * Backwards compatibility: O(n) validation for legacy tokens without sessionId.
   * Will be deprecated once all legacy tokens expire (7 days after deployment).
   */
  private async validateLegacyRefreshToken(
    userId: string,
    refreshToken: string
  ): Promise<{ valid: boolean; session?: SessionValidationRow }> {
    const result = await db.query<SessionValidationRow>(
      `SELECT id, refresh_token_hash, ip_address, user_agent
       FROM sessions
       WHERE user_id = $1 AND expires_at > NOW()`,
      [userId]
    );

    for (const row of result.rows) {
      if (await bcrypt.compare(refreshToken, row.refresh_token_hash)) {
        return { valid: true, session: row };
      }
    }
    return { valid: false };
  }

  /**
   * Revokes a refresh token by deleting its session.
   * O(1) when sessionId is known (new tokens), legacy tokens cleaned up on logout/expiry.
   */
  private async revokeRefreshToken(sessionId: string): Promise<void> {
    if (!sessionId) {
      // Legacy tokens without sessionId - they'll be cleaned up on logout or expiry
      return;
    }
    await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }

  private sanitizeUser(user: User) {
    return sanitizeUser(user);
  }
}

/**
 * Strip sensitive fields from a User object for API responses.
 * Single source of truth for user data serialization — used by auth service and user routes.
 */
export function sanitizeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    subscriptionStatus: user.subscriptionStatus,
    trialEndsAt: user.trialEndsAt,
    emailVerified: user.emailVerified,
  };
}

export const authService = new AuthService();
