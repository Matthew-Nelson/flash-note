import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { auditService } from '../services/audit-service.js';
import { AuditAction, type TokenPayload, type AuthenticatedRequest } from '../types/index.js';

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const ipAddress = req.ip || req.socket.remoteAddress;
  const userAgent = req.get('user-agent');

  if (!authHeader?.startsWith('Bearer ')) {
    // HIPAA: Log all authorization failures
    await auditService.log({
      userId: null,
      action: AuditAction.AUTH_FAILED,
      status: 'FAILURE',
      metadata: { reason: 'missing_token', path: req.path },
      ipAddress,
      userAgent,
    });
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
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    // HIPAA: Log all authorization failures
    await auditService.log({
      userId: null,
      action: AuditAction.AUTH_FAILED,
      status: 'FAILURE',
      metadata: { reason: 'invalid_token', path: req.path },
      ipAddress,
      userAgent,
    });
    res.status(401).json({
      success: false,
      error: { code: 'invalid_token', message: 'Invalid or expired token' },
    });
  }
}
