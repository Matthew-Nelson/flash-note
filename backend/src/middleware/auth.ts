import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { auditService } from '../services/audit-service.js';
import { AuditAction, type TokenPayload, type AuthenticatedRequest } from '../types/index.js';
import { getRequestMetadata, safeAuditLog } from '../utils/request-utils.js';
import { getTokenVersion } from '../db/queries/users.js';

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const { ipAddress, userAgent } = getRequestMetadata(req);

  if (!authHeader?.startsWith('Bearer ')) {
    // HIPAA: Log all authorization failures (non-blocking)
    safeAuditLog(
      auditService.log({
        userId: null,
        action: AuditAction.AUTH_FAILED,
        status: 'FAILURE',
        metadata: { reason: 'missing_token', path: req.path },
        ipAddress,
        userAgent,
      }),
      'auth:missing_token'
    );
    res.status(401).json({
      success: false,
      error: { code: 'missing_token', message: 'Authorization header required' },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // SECURITY: Explicitly specify algorithm to prevent algorithm confusion attacks
    const payload = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as TokenPayload;

    // SECURITY: Validate token version to ensure immediate invalidation after password reset
    // This prevents old tokens from being used even if they haven't expired yet
    const currentTokenVersion = await getTokenVersion(payload.userId);

    if (currentTokenVersion === null) {
      // User no longer exists
      safeAuditLog(
        auditService.log({
          userId: payload.userId,
          action: AuditAction.AUTH_FAILED,
          status: 'FAILURE',
          metadata: { reason: 'user_not_found', path: req.path },
          ipAddress,
          userAgent,
        }),
        'auth:user_not_found'
      );
      res.status(401).json({
        success: false,
        error: { code: 'invalid_token', message: 'Invalid or expired token' },
      });
      return;
    }

    if (payload.tokenVersion !== currentTokenVersion) {
      // Token version mismatch - token was invalidated (likely due to password reset)
      safeAuditLog(
        auditService.log({
          userId: payload.userId,
          action: AuditAction.AUTH_FAILED,
          status: 'FAILURE',
          metadata: {
            reason: 'token_version_mismatch',
            tokenVersion: payload.tokenVersion,
            currentVersion: currentTokenVersion,
            path: req.path,
          },
          ipAddress,
          userAgent,
        }),
        'auth:token_version_mismatch'
      );
      res.status(401).json({
        success: false,
        error: { code: 'invalid_token', message: 'Invalid or expired token' },
      });
      return;
    }

    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    // HIPAA: Log all authorization failures (non-blocking)
    safeAuditLog(
      auditService.log({
        userId: null,
        action: AuditAction.AUTH_FAILED,
        status: 'FAILURE',
        metadata: { reason: 'invalid_token', path: req.path },
        ipAddress,
        userAgent,
      }),
      'auth:invalid_token'
    );
    res.status(401).json({
      success: false,
      error: { code: 'invalid_token', message: 'Invalid or expired token' },
    });
  }
}
