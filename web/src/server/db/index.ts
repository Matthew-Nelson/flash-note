import 'server-only';

import pg from 'pg';

import { config } from './config';
import { logger } from '@/server/lib/logger';

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

/**
 * Build pg.Pool options with TLS enforcement in production.
 *
 * PHI-10 code-side prerequisite (per Phase 4 CONTEXT D-10): in production the
 * connection to Postgres MUST be encrypted. Two acceptable paths:
 *   (a) Cloud SQL Auth Proxy sidecar — provides a local-socket tunnel that is
 *       already encrypted by Google's managed proxy. No app-level SSL needed;
 *       DATABASE_URL points at 127.0.0.1 / unix socket.
 *   (b) Direct TCP connection to Cloud SQL (or any external Postgres) — MUST
 *       include `?sslmode=require` (or verify-full) OR the pg.Pool config must
 *       set `ssl: { rejectUnauthorized: true }`.
 *
 * This helper enforces TLS in production unless the connection string already
 * signals a local/socket-tunnel path (Cloud SQL proxy or localhost). Dev and
 * test connections keep TLS optional — local Postgres typically doesn't run
 * with TLS.
 */
export function buildPoolConfig(): pg.PoolConfig {
  const url = config.DATABASE_URL;
  const base: pg.PoolConfig = {
    connectionString: url,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    statement_timeout: 30000,
  };

  if (process.env.NODE_ENV !== 'production') {
    return base;
  }

  // Production TLS enforcement. Skip when connecting via the Cloud SQL Auth
  // Proxy sidecar (localhost / unix socket) — that path is already encrypted
  // by the managed proxy. Otherwise require TLS at the driver level.
  const isProxyTunnel =
    url.includes('@127.0.0.1') ||
    url.includes('@localhost') ||
    url.includes('host=/cloudsql/');
  const hasSslMode = /[?&]sslmode=(require|verify-ca|verify-full)\b/.test(url);

  if (!isProxyTunnel && !hasSslMode) {
    base.ssl = { rejectUnauthorized: true };
  }

  return base;
}

export const db =
  globalForDb._flashnoteDb ?? new Pool(buildPoolConfig());

// Pool error handler — prevents unhandled promise rejections from crashing the process.
// Only attach on first creation to avoid duplicate listeners on HMR reloads.
if (isNewPool) {
  logger.info({ source: 'database', poolSize: 20 }, 'PostgreSQL connection pool created');

  db.on('error', (err) => {
    logger.error({ err, source: 'database', errorType: 'pool_error' }, 'PostgreSQL pool error');
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

    logger.warn({ source: 'database', signal }, 'Received signal: draining database pool');

    const forceExit = setTimeout(() => {
      logger.error({ source: 'database', errorType: 'drain_timeout' }, 'Pool drain timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    // Prevent the timeout from keeping the event loop alive if pool.end()
    // resolves before it fires.
    forceExit.unref();

    db.end()
      .then(() => {
        logger.warn({ source: 'database' }, 'Database pool drained successfully');
        process.exit(0);
      })
      .catch((err) => {
        logger.error({ err, source: 'database', errorType: 'drain_error' }, 'Error draining database pool');
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
