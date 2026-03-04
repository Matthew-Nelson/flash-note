import 'server-only';

import type pg from 'pg';

import { db } from '@/server/db';
import { sanitizeIpAddress } from '@/server/lib/request-utils';
import type { AuditLogEntry } from '@/server/types';

const AUDIT_INSERT = `INSERT INTO audit_logs (user_id, action, status, metadata, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`;

function buildParams(entry: AuditLogEntry): unknown[] {
  return [
    entry.userId,
    entry.action,
    entry.status,
    JSON.stringify(entry.metadata ?? {}),
    sanitizeIpAddress(entry.ipAddress),
    entry.userAgent ?? null,
  ];
}

class AuditService {
  /**
   * Fire-and-forget audit log — errors are swallowed and logged.
   * Use for non-critical paths where audit failure shouldn't break the operation.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await db.query(AUDIT_INSERT, buildParams(entry));
    } catch (error) {
      // Don't throw — audit failures shouldn't break the app.
      // Rule 9: log at error level with structured context so Cloud Error Reporting
      // can group and alert on audit failures (especially security-critical events).
      // TODO: Replace with Pino structured logger when available
      // eslint-disable-next-line no-console
      console.error('Audit log failed:', {
        source: 'service_audit',
        errorType: 'audit_write_failed',
        userId: entry.userId,
        action: entry.action,
        status: entry.status,
        err: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Transactional audit log — errors propagate to the caller (Rule 9).
   * Use within a transaction so the audit entry is committed or rolled back
   * atomically with the action it documents.
   */
  async logWithClient(client: pg.PoolClient, entry: AuditLogEntry): Promise<void> {
    await client.query(AUDIT_INSERT, buildParams(entry));
  }
}

export const auditService = new AuditService();
