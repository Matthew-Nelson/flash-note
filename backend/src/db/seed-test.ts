/* eslint-disable no-console -- CLI script with intentional stdout output */
/**
 * Test database seed script.
 *
 * Creates test users, organizations, invite codes, and tokens for E2E testing.
 * Run this after migrations to set up the test database with known state.
 *
 * Usage: pnpm db:seed:test
 *
 * IMPORTANT: This script is for TEST environments only.
 * Never run this in production.
 *
 * All test credentials are exported from seed-test-users.ts for use by
 * E2E test fixtures. Keep both files in sync.
 */

// Force test environment BEFORE any imports
// (imports are hoisted, so we use dynamic import below)
process.env.NODE_ENV = 'test';

import {
  TEST_USERS, TEST_ORG, TEST_INVITE_CODES, TEST_RESET_TOKEN,
  type TestUser,
} from './seed-test-users.js';

async function seedTestData() {
  // Dynamic imports to ensure NODE_ENV is set first
  await import('../env-loader.js');
  const bcrypt = await import('bcryptjs');
  const crypto = await import('crypto');
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

  // Use a single client for the entire seed to ensure transactional consistency
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // ─── Shared password hash (all test users use the same password) ───
    const passwordHash = await bcrypt.default.hash(TEST_USERS.PRIMARY.password, 12);

    // ─── Helper: upsert a user and return the user ID ───
    async function upsertUser(user: TestUser): Promise<string> {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [user.email]);

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE users SET
            password_hash = $1,
            email_verified = $2,
            email_verified_at = CASE WHEN $2 THEN COALESCE(email_verified_at, NOW()) ELSE NULL END,
            subscription_status = $3,
            trial_ends_at = $4,
            failed_login_attempts = $5,
            locked_until = $6,
            organization_id = NULL,
            token_version = 1,
            updated_at = NOW()
          WHERE email = $7
          RETURNING id`,
          [
            passwordHash,
            user.emailVerified,
            user.subscriptionStatus,
            user.trialEndsAt,
            user.failedLoginAttempts ?? 0,
            user.lockedUntil ?? null,
            user.email,
          ]
        );
        console.log(`  Updated user: ${user.email}`);
        return existing.rows[0].id;
      } else {
        const result = await client.query(
          `INSERT INTO users (
            email, password_hash, email_verified, email_verified_at,
            subscription_status, trial_ends_at,
            failed_login_attempts, locked_until
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id`,
          [
            user.email,
            passwordHash,
            user.emailVerified,
            user.emailVerified ? new Date() : null,
            user.subscriptionStatus,
            user.trialEndsAt,
            user.failedLoginAttempts ?? 0,
            user.lockedUntil ?? null,
          ]
        );
        console.log(`  Created user: ${user.email}`);
        return result.rows[0].id;
      }
    }

    // ─── 1. Seed all users ───
    console.log('\n--- Users ---');
    const userIds: Record<string, string> = {};

    for (const [key, user] of Object.entries(TEST_USERS)) {
      userIds[key] = await upsertUser(user);
    }

    // ─── 2. Seed organization ───
    console.log('\n--- Organization ---');

    // Clean up existing org data for idempotency
    // Delete memberships and invite codes first (FK constraints)
    const existingOrg = await client.query(
      'SELECT id FROM organizations WHERE name = $1',
      [TEST_ORG.name]
    );

    let orgId: string;

    if (existingOrg.rows.length > 0) {
      orgId = existingOrg.rows[0].id;

      // Clean existing memberships and codes for this org
      await client.query('DELETE FROM organization_members WHERE organization_id = $1', [orgId]);
      await client.query('DELETE FROM invite_codes WHERE organization_id = $1', [orgId]);

      await client.query(
        `UPDATE organizations SET
          max_seats = $1,
          subscription_status = $2,
          trial_ends_at = $3,
          updated_at = NOW()
        WHERE id = $4`,
        [TEST_ORG.maxSeats, TEST_ORG.subscriptionStatus, TEST_ORG.trialEndsAt, orgId]
      );
      console.log(`  Updated organization: ${TEST_ORG.name}`);
    } else {
      const result = await client.query(
        `INSERT INTO organizations (name, max_seats, subscription_status, trial_ends_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id`,
        [TEST_ORG.name, TEST_ORG.maxSeats, TEST_ORG.subscriptionStatus, TEST_ORG.trialEndsAt]
      );
      orgId = result.rows[0].id;
      console.log(`  Created organization: ${TEST_ORG.name}`);
    }

    // ─── 3. Seed org memberships ───
    console.log('\n--- Organization Members ---');

    // Owner (non-billable)
    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role, is_billable)
      VALUES ($1, $2, 'owner', FALSE)`,
      [orgId, userIds.ORG_OWNER]
    );
    await client.query('UPDATE users SET organization_id = $1 WHERE id = $2', [orgId, userIds.ORG_OWNER]);
    console.log(`  Added owner: ${TEST_USERS.ORG_OWNER.email}`);

    // Member (billable)
    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role, is_billable)
      VALUES ($1, $2, 'member', TRUE)`,
      [orgId, userIds.ORG_MEMBER]
    );
    await client.query('UPDATE users SET organization_id = $1 WHERE id = $2', [orgId, userIds.ORG_MEMBER]);
    console.log(`  Added member: ${TEST_USERS.ORG_MEMBER.email}`);

    // ─── 4. Seed invite codes ───
    console.log('\n--- Invite Codes ---');

    // Also clean any non-org invite codes we manage
    await client.query(
      'DELETE FROM invite_codes WHERE code IN ($1, $2)',
      [TEST_INVITE_CODES.VALID.code, TEST_INVITE_CODES.USED.code]
    );

    // Active clinic invite code
    await client.query(
      `INSERT INTO invite_codes (code, type, organization_id, expires_at, is_active)
      VALUES ($1, $2, $3, $4, TRUE)`,
      [
        TEST_INVITE_CODES.VALID.code,
        TEST_INVITE_CODES.VALID.type,
        orgId,
        TEST_INVITE_CODES.VALID.expiresAt,
      ]
    );
    console.log(`  Created invite code: ${TEST_INVITE_CODES.VALID.code}`);

    // Already-used clinic invite code
    await client.query(
      `INSERT INTO invite_codes (code, type, organization_id, used_by, used_at, expires_at, is_active)
      VALUES ($1, $2, $3, $4, NOW(), $5, FALSE)`,
      [
        TEST_INVITE_CODES.USED.code,
        TEST_INVITE_CODES.USED.type,
        orgId,
        userIds.ORG_MEMBER,
        TEST_INVITE_CODES.USED.expiresAt,
      ]
    );
    console.log(`  Created used invite code: ${TEST_INVITE_CODES.USED.code}`);

    // ─── 5. Seed password reset token ───
    console.log('\n--- Password Reset Token ---');

    // Clean existing tokens for the primary user
    await client.query(
      `DELETE FROM email_tokens WHERE user_id = $1 AND token_type = 'password_reset'`,
      [userIds.PRIMARY]
    );

    const tokenHash = crypto.default
      .createHash('sha256')
      .update(TEST_RESET_TOKEN.plainToken)
      .digest('hex');

    await client.query(
      `INSERT INTO email_tokens (user_id, token_hash, token_type, expires_at)
      VALUES ($1, $2, 'password_reset', $3)`,
      [userIds.PRIMARY, tokenHash, TEST_RESET_TOKEN.expiresAt]
    );
    console.log(`  Created password reset token for: ${TEST_USERS.PRIMARY.email}`);

    // ─── 6. Clean up sessions for consistent state ───
    console.log('\n--- Cleanup ---');
    await client.query('DELETE FROM sessions');
    console.log('  Cleared all sessions');

    await client.query('COMMIT');

    console.log('\n=== Test data seeding complete! ===\n');
    console.log('Users:');
    for (const [key, user] of Object.entries(TEST_USERS)) {
      console.log(`  ${key}: ${user.email} (${user.subscriptionStatus}, verified=${user.emailVerified})`);
    }
    console.log(`\nOrganization: ${TEST_ORG.name} (${TEST_ORG.subscriptionStatus})`);
    console.log(`Invite codes: ${TEST_INVITE_CODES.VALID.code} (active), ${TEST_INVITE_CODES.USED.code} (used)`);
    console.log(`Password reset token seeded for: ${TEST_USERS.PRIMARY.email}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await db.end();
  }
}

void seedTestData();
