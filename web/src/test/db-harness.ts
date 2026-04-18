/**
 * Real-database integration harness for Phase 4 PHI integration tests.
 *
 * Boots a clean Postgres pool against DATABASE_URL_TEST and applies migrations
 * 001 + 002 in order. Tests using this harness must be skipped when
 * DATABASE_URL_TEST is not set (use `describe.skipIf(!process.env.DATABASE_URL_TEST)`).
 *
 * Why a real DB (not mocks): the phi-migration.test.ts suite exercises
 * PostgreSQL triggers, check constraints, and foreign keys — these cannot be
 * meaningfully mocked. Unit tests of DAL modules continue to mock pg.query.
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

export interface TestDbHandle {
  pool: pg.Pool;
  cleanup: () => Promise<void>;
}

/**
 * Apply migrations 001 + 002 against the DATABASE_URL_TEST database and return
 * a Pool + cleanup function. Throws if DATABASE_URL_TEST is not set.
 *
 * The caller is responsible for calling cleanup() in an afterAll hook.
 *
 * Tables are dropped (CASCADE) before migrations are applied, so each test run
 * starts from a clean slate. This is safe for a dedicated test DB only — never
 * run against a database that may contain real data.
 */
export async function setupTestDb(): Promise<TestDbHandle> {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      'DATABASE_URL_TEST not set — integration tests using db-harness must be skipped.'
    );
  }

  const pool = new Pool({ connectionString: url, max: 4 });

  // Drop + recreate public schema for a clean slate. Safe ONLY against a
  // dedicated test DB (hence the env-var gate above).
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');

  const migrationsDir = path.join(process.cwd(), 'src/server/db/migrations');
  const files = ['001_initial_schema.sql', '002_phi_storage.sql'];
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    await pool.query(sql);
  }

  return {
    pool,
    cleanup: async (): Promise<void> => {
      await pool.end();
    },
  };
}
