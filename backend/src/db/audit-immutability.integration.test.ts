/**
 * Integration tests for audit log immutability triggers.
 *
 * These tests exercise the real database triggers from migration 012.
 * They require a live test database with migrations applied.
 *
 * Run: pnpm test:integration
 * Prerequisite: pnpm test:setup
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

const { Pool } = pg;

// Resolve DATABASE_URL for test database
function getTestDatabaseUrl(): string | undefined {
  // Prefer explicit test DB URL; fall back to DATABASE_URL if it looks like a test DB
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  const isTest =
    url.includes('flashnote_test') ||
    url.includes('localhost') ||
    url.includes('127.0.0.1');

  return isTest ? url : undefined;
}

const databaseUrl = getTestDatabaseUrl();
const canRunIntegrationTests = Boolean(databaseUrl);

describe.skipIf(!canRunIntegrationTests)('Audit log immutability triggers', () => {
  let db: InstanceType<typeof Pool>;
  let testRowId: string;

  beforeAll(async () => {
    db = new Pool({ connectionString: databaseUrl, max: 1 });

    // Insert a test row for UPDATE/DELETE tests
    const result = await db.query<{ id: string }>(
      `INSERT INTO audit_logs (action, status, metadata)
       VALUES ('IMMUTABILITY_TEST', 'SUCCESS', '{"integration_test": true}')
       RETURNING id`
    );

    const row = result.rows[0];
    if (!row?.id) throw new Error('Failed to insert test audit log row');
    testRowId = row.id;
  });

  afterAll(async () => {
    if (db) await db.end();
  });

  it('blocks UPDATE on audit_logs', async () => {
    await expect(
      db.query('UPDATE audit_logs SET status = $1 WHERE id = $2', ['FAILURE', testRowId])
    ).rejects.toThrow('cannot be modified');
  });

  it('blocks DELETE on audit_logs', async () => {
    await expect(
      db.query('DELETE FROM audit_logs WHERE id = $1', [testRowId])
    ).rejects.toThrow('cannot be deleted');
  });

  it('blocks TRUNCATE on audit_logs', async () => {
    // Wrap in transaction with unconditional ROLLBACK to prevent data loss
    // if the trigger is unexpectedly absent
    await db.query('BEGIN');
    try {
      await expect(
        db.query('TRUNCATE audit_logs')
      ).rejects.toThrow('cannot be truncated');
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('still allows INSERT on audit_logs', async () => {
    const result = await db.query<{ id: string }>(
      `INSERT INTO audit_logs (action, status, metadata)
       VALUES ('IMMUTABILITY_TEST', 'SUCCESS', '{"insert_test": true}')
       RETURNING id`
    );
    expect(result.rows[0]?.id).toBeTruthy();
  });
});
