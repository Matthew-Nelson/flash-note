import 'server-only';

import { db } from '@/server/db';

const HEALTH_CHECK_TIMEOUT_MS = 3000;

/**
 * Verify database connectivity with a timeout.
 * Returns true if the DB responds to a simple query within the timeout.
 * Returns false on any error (connection failure, timeout, etc.).
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    await Promise.race([
      db.query('SELECT 1'),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB health check timed out')), HEALTH_CHECK_TIMEOUT_MS),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}
