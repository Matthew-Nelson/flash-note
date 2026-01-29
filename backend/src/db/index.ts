import pg from 'pg';
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
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down database pool...');
  await db.end();
  process.exit(0);
});
