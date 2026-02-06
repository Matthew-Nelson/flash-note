/**
 * Database Migration Script
 *
 * Applies SQL migrations from src/db/migrations/ in order.
 * Tracks applied migrations in a `migrations` table to avoid re-running.
 *
 * Usage:
 *   pnpm db:migrate        # Run against development database (.env)
 *   pnpm db:migrate:test   # Run against test database (.env.test)
 *
 * The target database is determined by NODE_ENV:
 *   - NODE_ENV=test  -> loads .env.test
 *   - Otherwise      -> loads .env
 */

// Load environment variables first (standalone script)
import '../env-loader.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  console.log('Running database migrations...');

  try {
    // Create migrations tracking table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get list of applied migrations
    const appliedResult = await db.query<{ name: string }>('SELECT name FROM migrations');
    const appliedMigrations = new Set(appliedResult.rows.map(r => r.name));

    // Get migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedMigrations.has(file)) {
        console.log(`  Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`  Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await db.query('BEGIN');
      try {
        await db.query(sql);
        await db.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await db.query('COMMIT');
        console.log(`  Applied ${file}`);
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    }

    console.log('Migrations complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

void migrate();
