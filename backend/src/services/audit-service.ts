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
      // Don't throw - audit failures shouldn't break the app
      // But log them for monitoring
      console.error('Audit log failed:', error);
    }
  }
}

export const auditService = new AuditService();
