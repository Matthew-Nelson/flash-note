/* eslint-disable no-console -- CLI script with intentional stdout output */
/**
 * Test database seed script.
 *
 * Creates a test user for E2E testing. Run this after migrations
 * to set up the test database with known credentials.
 *
 * Usage: pnpm db:seed:test
 *
 * IMPORTANT: This script is for TEST environments only.
 * Never run this in production.
 */

// Force test environment BEFORE any imports
// (imports are hoisted, so we use dynamic import below)
process.env.NODE_ENV = 'test';

// Test user credentials - these must match what E2E tests expect
const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123',
};

async function seedTestData() {
  // Dynamic imports to ensure NODE_ENV is set first
  await import('../env-loader.js');
  const bcrypt = await import('bcryptjs');
  const pg = await import('pg');
  const { Pool } = pg.default;
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Safety check - only run against known test databases
  // Use positive matching (allowlist) rather than negative matching (blocklist)
  const isTestDatabase =
    databaseUrl.includes('flashnote_test') ||
    databaseUrl.includes('localhost') ||
    databaseUrl.includes('127.0.0.1');

  if (!isTestDatabase || process.env.NODE_ENV === 'production') {
    console.error('ERROR: This script only runs against local test databases');
    console.error('Database URL must contain "flashnote_test", "localhost", or "127.0.0.1"');
    process.exit(1);
  }

  const db = new Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  console.log('Seeding test database...');

  try {
    // Hash the test password
    const passwordHash = await bcrypt.default.hash(TEST_USER.password, 12);

    // Check if test user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [TEST_USER.email]
    );

    if (existingUser.rows.length > 0) {
      console.log(`  Test user already exists (${TEST_USER.email})`);

      // Update the user to ensure consistent state
      await db.query(
        `UPDATE users SET
          password_hash = $1,
          email_verified = TRUE,
          email_verified_at = NOW(),
          subscription_status = 'trialing',
          trial_ends_at = NOW() + INTERVAL '14 days',
          failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = NOW()
        WHERE email = $2`,
        [passwordHash, TEST_USER.email]
      );

      console.log('  Updated test user to known state');
    } else {
      // Create the test user
      await db.query(
        `INSERT INTO users (
          email,
          password_hash,
          email_verified,
          email_verified_at,
          subscription_status,
          trial_ends_at
        ) VALUES ($1, $2, TRUE, NOW(), 'trialing', NOW() + INTERVAL '14 days')`,
        [TEST_USER.email, passwordHash]
      );

      console.log(`  Created test user: ${TEST_USER.email}`);
    }

    console.log('\nTest data seeding complete!');
    console.log(`Test user ready: ${TEST_USER.email}`);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

void seedTestData();
