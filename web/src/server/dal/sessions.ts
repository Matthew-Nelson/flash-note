import 'server-only';

import type pg from 'pg';

import { db } from '@/server/db';

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
