import 'server-only';

import type pg from 'pg';

import { db, getPoolClient } from '@/server/db';
import type { TokenType } from '@/server/types';

/**
 * Create a new email token, invalidating existing tokens of the same type
 * in a single transaction. Prevents orphaned invalidation if the INSERT fails.
 */
export async function createEmailToken(
  userId: string,
  tokenHash: string,
  type: TokenType,
  expiresAt: Date
): Promise<void> {
  const client = await getPoolClient();
  try {
    await client.query('BEGIN');

    // Invalidate existing unused tokens of the same type
    await client.query(
      `UPDATE email_tokens
       SET used_at = NOW()
       WHERE user_id = $1 AND token_type = $2 AND used_at IS NULL`,
      [userId, type]
    );

    await client.query(
      `INSERT INTO email_tokens (user_id, token_hash, token_type, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, tokenHash, type, expiresAt]
    );

    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection may be unusable */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Validate a token and mark it as used in a single atomic operation.
 * Prevents replay attacks via single-use enforcement.
 * Returns the user ID if valid, null otherwise.
 */
export async function consumeToken(
  tokenHash: string,
  type: TokenType,
  client?: pg.PoolClient
): Promise<string | null> {
  const result = await (client ?? db).query<{ user_id: string }>(
    `UPDATE email_tokens
     SET used_at = NOW()
     WHERE token_hash = $1
       AND token_type = $2
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash, type]
  );

  if (result.rows.length === 0) return null;
  return result.rows[0].user_id;
}

/**
 * Check if a token is valid without consuming it.
 * Used for UI pre-validation (e.g., checking if reset link is valid before showing form).
 */
export async function checkTokenExists(
  tokenHash: string,
  type: TokenType
): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM email_tokens
     WHERE token_hash = $1
       AND token_type = $2
       AND used_at IS NULL
       AND expires_at > NOW()`,
    [tokenHash, type]
  );

  return result.rows.length > 0;
}

/**
 * Find user ID from a token regardless of validity.
 * Used to check if user is already verified when a consumed/expired token is presented.
 */
export async function findUserIdByTokenHash(
  tokenHash: string,
  type: TokenType
): Promise<string | null> {
  const result = await db.query<{ user_id: string }>(
    `SELECT user_id FROM email_tokens
     WHERE token_hash = $1 AND token_type = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [tokenHash, type]
  );

  if (result.rows.length === 0) return null;
  return result.rows[0].user_id;
}

/**
 * Clean up expired tokens (maintenance task).
 * Deletes tokens that expired more than 7 days ago.
 */
export async function deleteExpiredTokens(): Promise<number> {
  const result = await db.query(
    `DELETE FROM email_tokens
     WHERE expires_at < NOW() - INTERVAL '7 days'`
  );
  return result.rowCount ?? 0;
}
