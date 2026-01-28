import { Request } from 'express';

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
    console.error(`Audit log failed (${context}):`, err);
  });
}
