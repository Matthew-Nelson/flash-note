import 'server-only';

import type pg from 'pg';

import { insertAuditLog, insertAuditLogWithClient } from '@/server/dal/audit-logs';
import type { AuditLogEntry } from '@/server/types';

class AuditService {
  /**
   * Fire-and-forget audit log — errors are swallowed and logged.
   * Use for non-critical paths where audit failure shouldn't break the operation.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await insertAuditLog(entry);
    } catch (error) {
      // Don't throw — audit failures shouldn't break the app.
      // Rule 9: log at error level with structured context so Cloud Error Reporting
      // can group and alert on audit failures (especially security-critical events).
      // TODO: Replace with Pino structured logger when available
      // eslint-disable-next-line no-console
      console.error('Audit log failed:', error, {
        source: 'service_audit',
        errorType: 'audit_write_failed',
        userId: entry.userId,
        action: entry.action,
        status: entry.status,
      });
    }
  }

  /**
   * Transactional audit log — errors propagate to the caller (Rule 9).
   * Use within a transaction so the audit entry is committed or rolled back
   * atomically with the action it documents.
   */
  async logWithClient(client: pg.PoolClient, entry: AuditLogEntry): Promise<void> {
    await insertAuditLogWithClient(client, entry);
  }
}

export const auditService = new AuditService();
