import 'server-only';

import type pg from 'pg';

import { insertAuditLog, insertAuditLogWithClient } from '@/server/dal/audit-logs';
import { logger } from '@/server/lib/logger';
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
      // Rule 9 + M-6: log at error level with structured context so Cloud Error Reporting
      // can group and alert on audit failures (especially security-critical events).
      // errorType 'audit_write_failed' per Plan 04-02 M-6 so every fire-and-forget
      // audit path (e.g. PATIENT_VIEWED) surfaces consistently in Cloud Error Reporting.
      logger.error(
        {
          err: error instanceof Error ? error : new Error(String(error)),
          source: 'audit_service',
          errorType: 'audit_write_failed',
          audit: true,
          userId: entry.userId,
          action: entry.action,
          status: entry.status,
        },
        'Audit write failed (fire-and-forget)',
      );
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
