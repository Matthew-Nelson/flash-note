import 'server-only';

import pg from 'pg';

import { config } from './config';

const { Pool } = pg;

/**
 * Singleton PostgreSQL connection pool.
 *
 * Cloud Run runs the app as a long-lived container — pg.Pool works normally.
 * No serverless driver or connection pooler needed.
 */
export const db = new Pool({
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
// Structured logger (Pino) replaces console.error in a later phase.
db.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('PostgreSQL pool error:', err);
});

/**
 * Get a dedicated PoolClient for multi-step transactions.
 * Caller is responsible for BEGIN/COMMIT/ROLLBACK and client.release().
 */
export async function getPoolClient(): Promise<pg.PoolClient> {
  return db.connect();
}
