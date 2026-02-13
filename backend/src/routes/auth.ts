import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import * as Sentry from '@sentry/node';
import { authService } from '../services/auth-service.js';
import { auditService } from '../services/audit-service.js';
import { tokenService } from '../services/token-service.js';
import { emailService } from '../services/email-service.js';
import {
  loginRateLimit,
  registerRateLimit,
  refreshRateLimit,
  verificationResendRateLimit,
  verificationCompleteRateLimit,
  passwordResetRequestRateLimit,
  passwordResetCompleteRateLimit,
  inviteCodeValidateRateLimit,
} from '../middleware/rate-limit.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { AuditAction, type AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/error-handler.js';
import { findUserByEmail, findUserById, markEmailVerified } from '../db/queries/users.js';
import { db } from '../db/index.js';
import { findByCode, validateCodeRedeemable } from '../db/queries/invite-codes.js';
import { BCRYPT_ROUNDS, config } from '../config.js';

export const authRouter: Router = Router();

// PASSWORD POLICY - SOURCE OF TRUTH
// When updating, sync to: extension/src/shared/schemas.ts, web/src/app/reset-password/page.tsx
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  acceptedLegalTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the legal terms to create an account' }),
  }),
  inviteCode: z.string().max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const requestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

const validateResetTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// POST /auth/register
authRouter.post('/register', registerRateLimit, async (req, res, next) => {
  try {
    const { email, password, acceptedLegalTerms, inviteCode } = registerSchema.parse(req.body);
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    // Registration gating — enforce REGISTRATION_MODE
    if (config.REGISTRATION_MODE === 'closed') {
      throw new AppError(403, 'registration_closed', 'Registration is not available at this time');
    }

    // Invite code processing:
    // - In 'invite' mode: code is required, validated, and redeemed atomically
    // - In 'open' mode: invite code field is ignored (users register freely)
    const isInviteMode = config.REGISTRATION_MODE === 'invite';
    const normalizedCode = isInviteMode ? inviteCode?.trim().toUpperCase() : undefined;

    if (isInviteMode && !normalizedCode) {
      throw new AppError(400, 'invite_code_required', 'An invite code is required to register');
    }

    // Pre-check invite code before starting registration transaction
    // Authoritative validation happens inside the transaction with FOR UPDATE
    if (normalizedCode) {
      const code = await findByCode(normalizedCode);
      if (!code) {
        throw new AppError(400, 'invalid_invite_code', 'This invite code is invalid or has expired');
      }
      const invalidReason = validateCodeRedeemable(code);
      if (invalidReason) {
        throw new AppError(400, 'invalid_invite_code', 'This invite code is invalid or has expired');
      }
    }

    // HIGH-006: Pass context for device binding on session creation
    const result = await authService.register(email, password, {
      ipAddress,
      userAgent,
      acceptedLegalTerms,
      inviteCode: normalizedCode,
    });

    await auditService.log({
      userId: result.user.id,
      action: AuditAction.REGISTER,
      status: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    // Log invite code redemption (use codeId from transaction, never the code string)
    if (result.redeemedCodeId) {
      await auditService.log({
        userId: result.user.id,
        action: AuditAction.INVITE_CODE_REDEEMED,
        status: 'SUCCESS',
        metadata: { codeId: result.redeemedCodeId },
        ipAddress,
        userAgent,
      });
    }

    // Log organization join when clinic code auto-joins user
    if (result.joinedOrganizationId) {
      await auditService.log({
        userId: result.user.id,
        action: AuditAction.ORG_MEMBER_JOINED,
        status: 'SUCCESS',
        metadata: { organizationId: result.joinedOrganizationId, source: 'registration' },
        ipAddress,
        userAgent,
      });
    }

    // Strip internal fields before sending to client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { redeemedCodeId: _redeemedCodeId, joinedOrganizationId: _joinedOrgId, ...clientData } = result;

    res.status(201).json({
      success: true,
      data: clientData,
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/login
authRouter.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    // Pass context for lockout tracking and audit logging
    const result = await authService.login(email, password, { ipAddress, userAgent });

    if (!result) {
      // Note: Failed attempt is already recorded by authService.login() via lockoutService
      // This audit log captures the high-level event for security monitoring
      await auditService.log({
        userId: null,
        action: AuditAction.LOGIN_FAILED,
        status: 'FAILURE',
        metadata: { emailProvided: true },
        ipAddress,
        userAgent,
      });

      throw new AppError(401, 'invalid_credentials', 'Invalid email or password');
    }

    await auditService.log({
      userId: result.user.id,
      action: AuditAction.LOGIN,
      status: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/refresh
// SECURITY: Rate limited to prevent token enumeration attacks
authRouter.post('/refresh', refreshRateLimit, async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    // HIGH-006: Pass context for device binding check and new session creation
    const result = await authService.refreshTokens(refreshToken, { ipAddress, userAgent });

    if (!result) {
      throw new AppError(401, 'invalid_token', 'Invalid or expired refresh token');
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/logout
authRouter.post('/logout', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    await authService.logout(userId);

    await auditService.log({
      userId,
      action: AuditAction.LOGOUT,
      status: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/verify-email - Verify email with token
authRouter.post('/verify-email', verificationCompleteRateLimit, async (req, res, next) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    const userId = await tokenService.validateAndConsumeToken(token, 'email_verification');

    if (!userId) {
      // Token invalid - check if user is already verified (clicked link twice, etc.)
      const tokenUserId = await tokenService.findUserIdFromToken(token, 'email_verification');

      if (tokenUserId) {
        const user = await findUserById(tokenUserId);
        if (user?.emailVerified) {
          // User is already verified - return success-like response
          res.json({
            success: true,
            data: {
              message: 'Email already verified',
              alreadyVerified: true,
            },
          });
          return;
        }
      }

      await auditService.log({
        userId: null,
        action: AuditAction.EMAIL_VERIFICATION_FAILED,
        status: 'FAILURE',
        metadata: { reason: 'invalid_or_expired_token' },
        ipAddress,
        userAgent,
      });

      throw new AppError(400, 'invalid_token', 'Invalid or expired verification token');
    }

    await markEmailVerified(userId);

    await auditService.log({
      userId,
      action: AuditAction.EMAIL_VERIFICATION_SUCCESS,
      status: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    res.json({
      success: true,
      data: { message: 'Email verified successfully' },
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/resend-verification - Resend verification email
// SECURITY: Always returns success to prevent email enumeration
authRouter.post('/resend-verification', verificationResendRateLimit, async (req, res, next) => {
  try {
    const { email } = resendVerificationSchema.parse(req.body);
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    const user = await findUserByEmail(email);

    // SECURITY: Process request silently even if user doesn't exist
    // This prevents email enumeration attacks
    if (user && !user.emailVerified) {
      const token = await tokenService.createToken(user.id, 'email_verification');
      await emailService.sendVerificationEmail(email, token);

      await auditService.log({
        userId: user.id,
        action: AuditAction.EMAIL_VERIFICATION_RESENT,
        status: 'SUCCESS',
        ipAddress,
        userAgent,
      });
    }

    // Always return success to prevent enumeration
    res.json({
      success: true,
      data: { message: 'If an account exists with this email, a verification link has been sent.' },
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/request-password-reset - Request password reset email
// SECURITY: Always returns success to prevent email enumeration
authRouter.post('/request-password-reset', passwordResetRequestRateLimit, async (req, res, next) => {
  try {
    const { email } = requestPasswordResetSchema.parse(req.body);
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    const user = await findUserByEmail(email);

    // SECURITY: Process request silently even if user doesn't exist
    // This prevents email enumeration attacks
    if (user) {
      const token = await tokenService.createToken(user.id, 'password_reset');
      await emailService.sendPasswordResetEmail(email, token);

      await auditService.log({
        userId: user.id,
        action: AuditAction.PASSWORD_RESET_REQUESTED,
        status: 'SUCCESS',
        ipAddress,
        userAgent,
      });
    }

    // Always return success to prevent enumeration
    res.json({
      success: true,
      data: { message: 'If an account exists with this email, a password reset link has been sent.' },
    });
  } catch (error) {
    next(error);
  }
});

// GET /auth/validate-reset-token - Check if reset token is valid (for UI)
authRouter.get('/validate-reset-token', async (req, res, next) => {
  try {
    const { token } = validateResetTokenSchema.parse(req.query);

    const isValid = await tokenService.isTokenValid(token, 'password_reset');

    res.json({
      success: true,
      data: { valid: isValid },
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/reset-password - Complete password reset
authRouter.post('/reset-password', passwordResetCompleteRateLimit, async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    const userId = await tokenService.validateAndConsumeToken(token, 'password_reset');

    if (!userId) {
      await auditService.log({
        userId: null,
        action: AuditAction.PASSWORD_RESET_TOKEN_INVALID,
        status: 'FAILURE',
        metadata: { reason: 'invalid_or_expired_token' },
        ipAddress,
        userAgent,
      });

      throw new AppError(400, 'invalid_token', 'Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // CR-5: Wrap all password reset mutations in a transaction
    // Prevents partial state (e.g., password changed but sessions still valid)
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // SECURITY: Update password, increment token version (invalidates all access tokens),
      // and reset lockout state in a single UPDATE to minimize round-trips and lock duration
      await client.query(
        `UPDATE users
         SET password_hash = $1,
             token_version = token_version + 1,
             failed_login_attempts = 0,
             locked_until = NULL,
             last_failed_login_at = NULL,
             updated_at = NOW()
         WHERE id = $2`,
        [passwordHash, userId]
      );

      // SECURITY: Delete all sessions (refresh tokens) to force re-login
      await client.query(
        'DELETE FROM sessions WHERE user_id = $1',
        [userId]
      );

      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* connection unusable */ }
      throw err;
    } finally {
      client.release();
    }

    // Rule 9: Audit log outside transaction — wrap in try/catch with Sentry
    // so a failed audit write doesn't make the (already committed) password reset
    // appear to fail to the user
    try {
      await auditService.log({
        userId,
        action: AuditAction.PASSWORD_RESET_SUCCESS,
        status: 'SUCCESS',
        metadata: { sessionsInvalidated: true },
        ipAddress,
        userAgent,
      });
    } catch (auditError) {
      Sentry.captureException(auditError, {
        extra: {
          source: 'auth_service',
          errorType: 'password_reset_audit_failed',
          userId,
        },
      });
    }

    res.json({
      success: true,
      data: { message: 'Password reset successfully. Please log in with your new password.' },
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/invite-codes/validate - Pre-registration code validation (public)
const validateInviteCodeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(20),
});

authRouter.post('/invite-codes/validate', inviteCodeValidateRateLimit, async (req, res, next) => {
  try {
    const { code } = validateInviteCodeSchema.parse(req.body);
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    // Only validate codes when registration is in invite mode
    // In other modes, codes aren't accepted — don't leak code validity
    if (config.REGISTRATION_MODE !== 'invite') {
      res.json({ success: true, data: { valid: false } });
      return;
    }

    const uppercased = code.trim().toUpperCase();
    const inviteCode = await findByCode(uppercased);
    const invalidReason = inviteCode ? validateCodeRedeemable(inviteCode) : 'not_found';
    const valid = invalidReason === null;

    if (valid) {
      await auditService.log({
        userId: null,
        action: AuditAction.INVITE_CODE_VALIDATED,
        status: 'SUCCESS',
        metadata: { codeId: inviteCode!.id },
        ipAddress,
        userAgent,
      });
    } else {
      await auditService.log({
        userId: null,
        action: AuditAction.INVITE_CODE_VALIDATION_FAILED,
        status: 'FAILURE',
        metadata: {
          codeId: inviteCode?.id ?? null,
          reason: invalidReason,
        },
        ipAddress,
        userAgent,
      });
    }

    res.json({ success: true, data: { valid } });
  } catch (error) {
    next(error);
  }
});
