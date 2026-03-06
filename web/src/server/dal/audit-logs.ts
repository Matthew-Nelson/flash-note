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

/**
 * Insert an audit log entry using the shared pool.
 * Throws on failure — callers that need fire-and-forget semantics (e.g. AuditService.log)
 * must wrap this in their own try/catch.
 */
export async function insertAuditLog(entry: AuditLogEntry): Promise<void> {
  await db.query(AUDIT_INSERT, buildParams(entry));
}

/**
 * Insert an audit log entry using a dedicated client (within a transaction).
 * Rule 9: audit entry is committed or rolled back atomically with the action it documents.
 */
export async function insertAuditLogWithClient(
  client: pg.PoolClient,
  entry: AuditLogEntry,
): Promise<void> {
  await client.query(AUDIT_INSERT, buildParams(entry));
}
