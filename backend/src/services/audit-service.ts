import * as Sentry from '@sentry/node';
import { db } from '../db/index.js';
import type { AuditLogEntry } from '../types/index.js';

class AuditService {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // HIPAA: Include user-agent for complete audit trail
      await db.query(
        `INSERT INTO audit_logs (user_id, action, status, metadata, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entry.userId,
          entry.action,
          entry.status,
          JSON.stringify(entry.metadata ?? {}),
          entry.ipAddress ?? null,
          entry.userAgent ?? null,
        ]
      );
    } catch (error) {
      // Capture to Sentry - HIPAA compliance requires reliable audit logging
      Sentry.captureException(error, {
        extra: {
          source: 'audit_service',
          action: entry.action,
          userId: entry.userId,
        },
      });
      // Don't throw - audit failures shouldn't break the app
      // But log them for monitoring
      console.error('Audit log failed:', error);
    }
  }
}

export const auditService = new AuditService();
