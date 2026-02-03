import pg from 'pg';
import * as Sentry from '@sentry/node';
import { config } from '../config.js';

const { Pool } = pg;

export const db = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 30000,
});

// Test connection on startup
db.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

db.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
  // Capture database errors to Sentry - these are critical infrastructure issues
  Sentry.captureException(err, {
    tags: { category: 'database', type: 'pool_error' },
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down database pool...');
  void db.end().then(() => {
    process.exit(0);
  });
});
