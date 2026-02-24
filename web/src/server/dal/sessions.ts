import 'server-only';

import crypto from 'node:crypto';

import type pg from 'pg';

import type { SessionWithUserRow } from '@/lib/types/database';
import { db, getPoolClient } from '@/server/db';
import { MAX_SESSIONS_PER_USER, SESSION_IDLE_TTL_MS } from '@/server/db/config';
import { sanitizeIpAddress } from '@/server/lib/request-utils';
import { auditService } from '@/server/services/audit';
import { AuditAction } from '@/server/types';
import type { SessionContext } from '@/server/types';

/**
 * Create a new session for a user.
 *
 * Generates an opaque UUID token, stores its SHA-256 hash, and enforces the
 * per-user session limit within a transaction (Rule 1).
 *
 * If an external PoolClient is provided (e.g., registration transaction),
 * uses that client — caller manages the transaction boundary.
 */
export async function createSession(
  userId: string,
  context: SessionContext = {},
  externalClient?: pg.PoolClient
): Promise<{ id: string; userId: string; token: string; expiresAt: Date }> {
  const token = crypto.randomUUID();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const sanitizedIp = sanitizeIpAddress(context.ipAddress);
  const expiresAt = new Date(Date.now() + SESSION_IDLE_TTL_MS);

  if (externalClient) {
    // Caller owns the transaction — just enforce limit + insert
    await enforceSessionLimit(userId, context, externalClient);

    const result = await externalClient.query<{ id: string }>(
      `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, tokenHash, expiresAt, sanitizedIp, context.userAgent ?? null]
    );

    if (result.rows.length === 0) {
      throw new Error('Session insert returned no rows');
    }

    return { id: result.rows[0].id, userId, token, expiresAt };
  }

  // No external client — manage our own transaction
  const client = await getPoolClient();
  try {
    await client.query('BEGIN');

    await enforceSessionLimit(userId, context, client);

    const result = await client.query<{ id: string }>(
      `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, tokenHash, expiresAt, sanitizedIp, context.userAgent ?? null]
    );

    if (result.rows.length === 0) {
      throw new Error('Session insert returned no rows');
    }

    await client.query('COMMIT');

    return { id: result.rows[0].id, userId, token, expiresAt };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection may be unusable */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Find a session by its token hash, joined with user data.
 * Returns null if session is expired or user is soft-deleted.
 */
export async function findSessionByTokenHash(
  tokenHash: string
): Promise<SessionWithUserRow | null> {
  const result = await db.query<SessionWithUserRow>(
    `SELECT
       s.id,
       s.user_id,
       s.token_hash,
       s.expires_at,
       s.created_at,
       s.ip_address,
       s.user_agent,
       u.email,
       u.subscription_status,
       u.trial_ends_at,
       u.email_verified,
       u.organization_id
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()
       AND NOT u.is_deleted`,
    [tokenHash]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Update session expiry for sliding window refresh.
 * Single-row UPDATE by primary key (~1ms) — awaited, not fire-and-forget.
 */
export async function refreshSessionExpiry(
  sessionId: string,
  newExpiresAt: Date
): Promise<void> {
  await db.query(
    'UPDATE sessions SET expires_at = $1 WHERE id = $2',
    [newExpiresAt, sessionId]
  );
}

/**
 * Delete a single session by ID.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

/**
 * Delete all sessions for a user — used on logout, password reset, etc.
 * Accepts optional PoolClient for transaction composition (Rule 1).
 */
export async function deleteSessionsByUserId(
  userId: string,
  client?: pg.PoolClient
): Promise<void> {
  await (client ?? db).query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

/**
 * Enforce the per-user session limit.
 * Deletes oldest sessions when the user has >= MAX_SESSIONS_PER_USER.
 * Must run within a transaction alongside createSession (Rule 1).
 */
export async function enforceSessionLimit(
  userId: string,
  context: SessionContext = {},
  client: pg.PoolClient
): Promise<void> {
  const countResult = await client.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM sessions WHERE user_id = $1',
    [userId]
  );

  const sessionCount = parseInt(countResult.rows[0]?.count ?? '0', 10);

  if (sessionCount >= MAX_SESSIONS_PER_USER) {
    const sessionsToDelete = sessionCount - MAX_SESSIONS_PER_USER + 1;

    const deleteResult = await client.query<{ id: string }>(
      `DELETE FROM sessions
       WHERE id IN (
         SELECT id FROM sessions
         WHERE user_id = $1
         ORDER BY created_at ASC
         LIMIT $2
       )
       RETURNING id`,
      [userId, sessionsToDelete]
    );

    // Rule 9: Audit log in the same transaction as the action it documents
    await auditService.logWithClient(client, {
      userId,
      action: AuditAction.SESSION_LIMIT_EXCEEDED,
      status: 'SUCCESS',
      metadata: {
        sessionsDeleted: deleteResult.rows.length,
        deletedSessionIds: deleteResult.rows.map((r) => r.id),
        maxSessions: MAX_SESSIONS_PER_USER,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }
}

/**
 * Check device binding — logs IP/UA mismatches for security monitoring.
 * Lenient: logs but doesn't block (PT staff frequently change networks).
 */
export async function checkDeviceBinding(
  userId: string,
  sessionId: string,
  session: { ip_address: string | null; user_agent: string | null },
  context: SessionContext
): Promise<void> {
  const ipChanged = session.ip_address !== null &&
                    context.ipAddress !== undefined &&
                    session.ip_address !== context.ipAddress;
  const uaChanged = session.user_agent !== null &&
                    context.userAgent !== undefined &&
                    session.user_agent !== context.userAgent;

  if (ipChanged || uaChanged) {
    await auditService.log({
      userId,
      action: AuditAction.SESSION_DEVICE_CHANGE,
      status: 'WARNING',
      metadata: {
        sessionId,
        ipChanged,
        uaChanged,
        originalIp: session.ip_address,
        newIp: ipChanged ? context.ipAddress : undefined,
        userAgentChanged: uaChanged,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }
}

/**
 * Delete all expired sessions. Returns count deleted.
 * Called by a scheduled cleanup job (Cloud Scheduler → Route Handler).
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.query<{ id: string }>(
    'DELETE FROM sessions WHERE expires_at < NOW() RETURNING id'
  );
  return result.rows.length;
}
