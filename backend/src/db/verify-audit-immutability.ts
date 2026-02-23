/* eslint-disable no-console -- CLI script with intentional stdout output */
/**
 * Audit log immutability verification script.
 *
 * Verifies that database triggers correctly prevent UPDATE, DELETE,
 * and TRUNCATE operations on the audit_logs table.
 *
 * Usage: pnpm db:verify:audit
 *
 * IMPORTANT: This script is for TEST/LOCAL environments only.
 * It inserts a test row into audit_logs to verify trigger behavior.
 */

// Force test environment BEFORE any imports
process.env.NODE_ENV = 'test';

async function verifyAuditImmutability() {
  // Dynamic imports to ensure NODE_ENV is set first
  await import('../env-loader.js');
  const pg = await import('pg');
  const { Pool } = pg.default;
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Safety check - only run against known test/local databases
  const isTestDatabase =
    databaseUrl.includes('flashnote_test') ||
    databaseUrl.includes('localhost') ||
    databaseUrl.includes('127.0.0.1');

  if (!isTestDatabase) {
    console.error('ERROR: This script only runs against local test databases');
    console.error('Database URL must contain "flashnote_test", "localhost", or "127.0.0.1"');
    process.exit(1);
  }

  const db = new Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  console.log('Verifying audit log immutability triggers...\n');

  let testRowId: string | null = null;
  let passed = 0;
  let failed = 0;

  try {
    // Step 1: Insert a test audit log row
    const insertResult = await db.query<{ id: string }>(
      `INSERT INTO audit_logs (action, status, metadata)
       VALUES ('IMMUTABILITY_TEST', 'SUCCESS', '{"test": true}')
       RETURNING id`
    );

    const row = insertResult.rows[0];
    if (!row?.id) {
      console.error('FAIL: Could not insert test audit log row');
      process.exit(1);
    }

    // Note: This row persists because the DELETE trigger prevents cleanup.
    // Harmless in test databases — each run adds one small row.
    testRowId = row.id;
    console.log(`  Inserted test row: ${testRowId}`);

    // Step 2: Verify UPDATE is blocked
    try {
      await db.query(
        `UPDATE audit_logs SET status = 'FAILURE' WHERE id = $1`,
        [testRowId]
      );
      console.error('  FAIL: UPDATE was not blocked by trigger');
      failed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('cannot be modified')) {
        console.log('  PASS: UPDATE blocked — "audit_logs rows cannot be modified"');
        passed++;
      } else {
        console.error(`  FAIL: UPDATE threw unexpected error: ${message}`);
        failed++;
      }
    }

    // Step 3: Verify DELETE is blocked
    try {
      await db.query(
        `DELETE FROM audit_logs WHERE id = $1`,
        [testRowId]
      );
      console.error('  FAIL: DELETE was not blocked by trigger');
      failed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('cannot be deleted')) {
        console.log('  PASS: DELETE blocked — "audit_logs rows cannot be deleted"');
        passed++;
      } else {
        console.error(`  FAIL: DELETE threw unexpected error: ${message}`);
        failed++;
      }
    }

    // Step 4: Verify TRUNCATE is blocked
    // Wrap in a transaction with unconditional ROLLBACK — if the trigger is missing,
    // a bare TRUNCATE would destroy all audit log data.
    try {
      await db.query('BEGIN');
      try {
        await db.query('TRUNCATE audit_logs');
        // If we get here, the trigger didn't fire — TRUNCATE succeeded
        await db.query('ROLLBACK');
        console.error('  FAIL: TRUNCATE was not blocked by trigger');
        failed++;
      } catch (error) {
        // Trigger fired and raised an exception — roll back regardless
        await db.query('ROLLBACK');
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('cannot be truncated')) {
          console.log('  PASS: TRUNCATE blocked — "audit_logs table cannot be truncated"');
          passed++;
        } else {
          console.error(`  FAIL: TRUNCATE threw unexpected error: ${message}`);
          failed++;
        }
      }
    } catch (txError) {
      // Transaction setup/teardown failed
      console.error(`  FAIL: TRUNCATE test transaction error: ${txError instanceof Error ? txError.message : String(txError)}`);
      failed++;
    }

    // Summary
    console.log(`\nResults: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
      console.error('\nAudit log immutability verification FAILED');
      process.exit(1);
    }

    console.log('\nAudit log immutability verification PASSED');
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

void verifyAuditImmutability();
