import { Request } from 'express';
import { isIP } from 'node:net';
import * as Sentry from '@sentry/node';

/**
 * Validates an IP address string for safe insertion into PostgreSQL INET columns.
 * Returns the IP if valid (IPv4 or IPv6), or null if malformed.
 * Prevents DB errors from invalid INET values inside transactions.
 */
export function sanitizeIpAddress(ip: string | undefined | null): string | null {
  if (!ip) return null;
  // isIP returns 4 for IPv4, 6 for IPv6, 0 for invalid
  return isIP(ip) ? ip : null;
}

/**
 * Extracts common request metadata for audit logging.
 * Centralizes IP and User-Agent extraction to ensure consistent handling.
 */
export function getRequestMetadata(req: Request): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  return {
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  };
}

/**
 * Safely logs to audit service without blocking the response.
 * Catches and logs any errors to prevent audit failures from breaking requests.
 */
export function safeAuditLog(
  auditPromise: Promise<void>,
  context: string
): void {
  auditPromise.catch((err) => {
    Sentry.captureException(err, {
      extra: {
        source: 'audit_service',
        errorType: 'safe_audit_log_failed',
        context,
      },
    });
    console.error(`Audit log failed (${context}):`, err);
  });
}
