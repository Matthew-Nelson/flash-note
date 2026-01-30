import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
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
} from '../middleware/rate-limit.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { AuditAction, type AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/error-handler.js';
import { findUserByEmail, findUserById, markEmailVerified, updatePassword, incrementTokenVersion } from '../db/queries/users.js';
import { db } from '../db/index.js';
import { BCRYPT_ROUNDS } from '../config.js';

export const authRouter: Router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
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
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

const validateResetTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// POST /auth/register
authRouter.post('/register', registerRateLimit, async (req, res, next) => {
  try {
    const { email, password } = registerSchema.parse(req.body);
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    // HIGH-006: Pass context for device binding on session creation
    const result = await authService.register(email, password, { ipAddress, userAgent });

    await auditService.log({
      userId: result.user.id,
      action: AuditAction.REGISTER,
      status: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    res.status(201).json({
      success: true,
      data: result,
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
        metadata: { email },
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

    // Update password
    await updatePassword(userId, passwordHash);

    // SECURITY: Increment token version to immediately invalidate all access tokens
    // This is critical because access tokens are stateless JWTs that would otherwise
    // remain valid until expiry (up to 1 hour) even after password reset
    await incrementTokenVersion(userId);

    // SECURITY: Also delete all sessions (refresh tokens) to force re-login
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);

    // SECURITY: Reset lockout counter on password reset
    await db.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_failed_login_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    await auditService.log({
      userId,
      action: AuditAction.PASSWORD_RESET_SUCCESS,
      status: 'SUCCESS',
      metadata: { sessionsInvalidated: true },
      ipAddress,
      userAgent,
    });

    res.json({
      success: true,
      data: { message: 'Password reset successfully. Please log in with your new password.' },
    });
  } catch (error) {
    next(error);
  }
});
