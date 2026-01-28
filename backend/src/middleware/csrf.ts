import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { auditService } from '../services/audit-service.js';
import { getRequestMetadata, safeAuditLog } from '../utils/request-utils.js';
import { AuditAction, type AuthenticatedRequest } from '../types/index.js';

const CSRF_HEADER = 'x-csrf-token';
const CSRF_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a stateless signed CSRF token.
 * Token format: base64url(userId:timestamp:hmac_signature)
 */
export function generateCsrfToken(userId: string): string {
  const timestamp = Date.now().toString();
  const data = `${userId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', config.CSRF_SECRET)
    .update(data)
    .digest('hex');
  return Buffer.from(`${data}:${signature}`).toString('base64url');
}

/**
 * Validate a CSRF token.
 * Checks: user binding, timestamp expiry, and HMAC signature.
 */
export function validateCsrfToken(token: string, userId: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;

    const tokenUserId = parts[0];
    const timestamp = parts[1];
    const signature = parts[2];

    // TypeScript safety: ensure parts are defined (guaranteed by length check above)
    if (!tokenUserId || !timestamp || !signature) return false;

    // Verify user binding
    if (tokenUserId !== userId) return false;

    // Verify timestamp within expiry window
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > CSRF_TOKEN_EXPIRY_MS || tokenAge < 0) return false;

    // Verify HMAC signature using timing-safe comparison
    const data = `${tokenUserId}:${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', config.CSRF_SECRET)
      .update(data)
      .digest('hex');

    // Ensure both buffers have same length before comparison
    if (signature.length !== expectedSignature.length) return false;

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Middleware to require a valid CSRF token for state-changing requests.
 * Must be applied after requireAuth middleware.
 */
export function requireCsrf(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const csrfToken = req.get(CSRF_HEADER);
  const userId = (req as AuthenticatedRequest).user?.userId;

  const { ipAddress, userAgent } = getRequestMetadata(req);

  if (!csrfToken) {
    safeAuditLog(
      auditService.log({
        userId: userId ?? null,
        action: AuditAction.CSRF_FAILED,
        status: 'FAILURE',
        metadata: { reason: 'missing_token', endpoint: req.originalUrl },
        ipAddress,
        userAgent,
      }),
      'csrf-missing'
    );
    res.status(403).json({
      success: false,
      error: { code: 'missing_csrf_token', message: 'CSRF token required' },
    });
    return;
  }

  if (!userId || !validateCsrfToken(csrfToken, userId)) {
    safeAuditLog(
      auditService.log({
        userId: userId ?? null,
        action: AuditAction.CSRF_FAILED,
        status: 'FAILURE',
        metadata: { reason: 'invalid_token', endpoint: req.originalUrl },
        ipAddress,
        userAgent,
      }),
      'csrf-invalid'
    );
    res.status(403).json({
      success: false,
      error: { code: 'invalid_csrf_token', message: 'Invalid CSRF token' },
    });
    return;
  }

  next();
}
