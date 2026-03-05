import 'server-only';

import pg from 'pg';

import { config } from './config';

const { Pool } = pg;

const globalForDb = globalThis as unknown as { _flashnoteDb?: pg.Pool };

/**
 * Singleton PostgreSQL connection pool.
 *
 * Cloud Run runs the app as a long-lived container — pg.Pool works normally.
 * No serverless driver or connection pooler needed.
 *
 * In dev mode, Next.js HMR re-evaluates modules on code changes. The globalThis
 * cache prevents creating a new pool on each reload, avoiding connection exhaustion.
 */
const isNewPool = !globalForDb._flashnoteDb;
export const db = globalForDb._flashnoteDb ?? new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 30000,
  // SSL note: Cloud Run connects to Cloud SQL via the Auth Proxy sidecar,
  // which provides an encrypted tunnel without requiring application-level SSL.
  // If connecting directly to Cloud SQL (e.g., in local dev), set
  // ssl: { rejectUnauthorized: true } or use DATABASE_URL with ?sslmode=require.
});

// Pool error handler — prevents unhandled promise rejections from crashing the process.
// Only attach on first creation to avoid duplicate listeners on HMR reloads.
if (isNewPool) {
  db.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForDb._flashnoteDb = db;
}

/**
 * Graceful shutdown: drain the pool when Cloud Run sends SIGTERM.
 *
 * Requires NEXT_MANUAL_SIG_HANDLE=true to prevent Next.js from handling
 * the signal before this code runs. Only registered on first pool creation
 * to avoid duplicate listeners on HMR reloads.
 *
 * Timeout ensures shutdown completes within Cloud Run's 10-second grace
 * period even if checked-out clients never return.
 */
const SHUTDOWN_TIMEOUT_MS = 5000;

if (isNewPool) {
  let isShuttingDown = false;

  const shutdownHandler = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.warn(`Received ${signal}: draining database pool`);

    const forceExit = setTimeout(() => {
      console.error('Pool drain timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    // Prevent the timeout from keeping the event loop alive if pool.end()
    // resolves before it fires.
    forceExit.unref();

    db.end()
      .then(() => {
        console.warn('Database pool drained successfully');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error draining database pool:', err);
        process.exit(1);
      });
  };

  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT', () => shutdownHandler('SIGINT'));
}

/**
 * Get a dedicated PoolClient for multi-step transactions.
 * Caller is responsible for BEGIN/COMMIT/ROLLBACK and client.release().
 */
export async function getPoolClient(): Promise<pg.PoolClient> {
  return db.connect();
}
