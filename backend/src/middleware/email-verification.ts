import { Request, Response, NextFunction } from 'express';
import { findUserById } from '../db/queries/users.js';
import { auditService } from '../services/audit-service.js';
import { AuditAction, type AuthenticatedRequest } from '../types/index.js';
import { getRequestMetadata, safeAuditLog } from '../utils/request-utils.js';

/**
 * Middleware to require email verification for protected routes.
 * Must be used AFTER requireAuth middleware.
 *
 * SECURITY: Unverified users can log in but cannot:
 * - Generate notes
 * - Access billing/checkout
 *
 * This prevents abuse by accounts with unverified emails.
 */
export async function requireEmailVerification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { ipAddress, userAgent } = getRequestMetadata(req);
  const authenticatedReq = req as AuthenticatedRequest;
  const userId = authenticatedReq.user?.userId;

  if (!userId) {
    // This should never happen if used after requireAuth, but fail-secure
    res.status(401).json({
      success: false,
      error: { code: 'unauthorized', message: 'Authentication required' },
    });
    return;
  }

  try {
    const user = await findUserById(userId);

    if (!user) {
      // User deleted after token issued - fail secure
      res.status(401).json({
        success: false,
        error: { code: 'user_not_found', message: 'User not found' },
      });
      return;
    }

    if (!user.emailVerified) {
      // Log access denied for unverified user
      safeAuditLog(
        auditService.log({
          userId,
          action: AuditAction.ACCESS_DENIED,
          status: 'FAILURE',
          metadata: {
            reason: 'email_not_verified',
            path: req.path,
            method: req.method,
          },
          ipAddress,
          userAgent,
        }),
        'email-verification:denied'
      );

      res.status(403).json({
        success: false,
        error: {
          code: 'email_not_verified',
          message: 'Please verify your email address to access this feature',
        },
      });
      return;
    }

    next();
  } catch (error) {
    // SECURITY: Fail secure on database errors
    console.error('Email verification check failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'internal_error', message: 'An error occurred' },
    });
  }
}
