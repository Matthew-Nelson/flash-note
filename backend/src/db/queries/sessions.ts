import { db } from '../index.js';

/**
 * Delete all sessions for a user - used on logout, password reset, etc.
 */
export async function deleteSessionsByUserId(userId: string): Promise<void> {
  await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}
