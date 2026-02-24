/* eslint-disable no-console -- CLI script with intentional stdout output */
/**
 * Database Migration Script
 *
 * Applies SQL migrations from src/server/db/migrations/ in order.
 * Tracks applied migrations in a `migrations` table to avoid re-running.
 *
 * Usage:
 *   pnpm db:migrate
 *
 * Fixes vs backend:
 *   M-19: Uses dedicated PoolClient with BEGIN/COMMIT/ROLLBACK per migration
 *         (backend used pool-level db.query('BEGIN') — no transaction isolation)
 *   M-20: Acquires pg_advisory_lock(1) to prevent concurrent deployment races
 *
 * Note: This script creates its own database connection to avoid
 * importing config.ts, which would require ALL env vars to be set.
 * Migrations only need DATABASE_URL.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  console.log('Running database migrations...');

  const client = await pool.connect();
  try {
    // M-20: Acquire advisory lock to prevent concurrent migration runs
    await client.query('SELECT pg_advisory_lock(1)');

    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get list of applied migrations
    const appliedResult = await client.query<{ name: string }>('SELECT name FROM migrations');
    const appliedMigrations = new Set(appliedResult.rows.map((r) => r.name));

    // Get migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedMigrations.has(file)) {
        console.log(`  Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`  Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      // M-19: Use dedicated client with proper transaction isolation
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  Applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('Migrations complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Advisory lock is released when the session ends (client.release)
    client.release();
    await pool.end();
  }
}

void migrate();
