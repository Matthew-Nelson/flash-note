import 'server-only';

import type pg from 'pg';
import { z } from 'zod';

import { db } from '@/server/db';
import type { User, SubscriptionStatus } from '@/server/types';
import type { UserRow } from '@/lib/types/database';

// Zod schema to validate subscription_status from DB (same pattern as orgRoleSchema in organization-members.ts)
const subscriptionStatusSchema = z.enum(['trialing', 'active', 'canceled', 'past_due', 'unpaid']);

// Shared column list — update here when adding new user fields
const USER_COLUMNS = `
  id, email, password_hash, stripe_customer_id, subscription_id,
  subscription_status, trial_ends_at, created_at, updated_at,
  failed_login_attempts, locked_until, last_failed_login_at,
  email_verified, email_verified_at, organization_id,
  is_deleted, deleted_at
`;

/**
 * Transform database row (snake_case) to User type (camelCase)
 */
function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    stripeCustomerId: row.stripe_customer_id,
    subscriptionId: row.subscription_id,
    subscriptionStatus: subscriptionStatusSchema.parse(row.subscription_status),
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    failedLoginAttempts: row.failed_login_attempts ?? 0,
    lockedUntil: row.locked_until,
    lastFailedLoginAt: row.last_failed_login_at,
    emailVerified: row.email_verified ?? false,
    emailVerifiedAt: row.email_verified_at,
    organizationId: row.organization_id ?? null,
    isDeleted: row.is_deleted ?? false,
    deletedAt: row.deleted_at ?? null,
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await db.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE LOWER(email) = $1 AND NOT is_deleted`,
    [email.toLowerCase().trim()]
  );

  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await db.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND NOT is_deleted`,
    [id]
  );

  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

// H-12 fix: Check rows.length before accessing result.rows[0]
export async function createUser(
  email: string,
  passwordHash: string
): Promise<User> {
  const normalizedEmail = email.toLowerCase().trim();
  const result = await db.query<UserRow>(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING ${USER_COLUMNS}`,
    [normalizedEmail, passwordHash]
  );

  if (result.rows.length === 0) {
    throw new Error('createUser: INSERT RETURNING returned no rows');
  }
  return rowToUser(result.rows[0]);
}

// H-12 fix: Check rows.length before accessing result.rows[0]
export async function createUserWithClient(
  client: pg.PoolClient,
  email: string,
  passwordHash: string
): Promise<User> {
  const normalizedEmail = email.toLowerCase().trim();
  const result = await client.query<UserRow>(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING ${USER_COLUMNS}`,
    [normalizedEmail, passwordHash]
  );

  if (result.rows.length === 0) {
    throw new Error('createUserWithClient: INSERT RETURNING returned no rows');
  }
  return rowToUser(result.rows[0]);
}

export async function updateUserSubscription(
  userId: string,
  stripeCustomerId: string,
  subscriptionId: string,
  status: SubscriptionStatus
): Promise<void> {
  await db.query(
    `UPDATE users SET
       stripe_customer_id = $1,
       subscription_id = $2,
       subscription_status = $3,
       updated_at = NOW()
     WHERE id = $4 AND NOT is_deleted`,
    [stripeCustomerId, subscriptionId, status, userId]
  );
}

export async function updateSubscriptionStatus(
  userId: string,
  status: SubscriptionStatus
): Promise<void> {
  await db.query(
    `UPDATE users SET subscription_status = $1, updated_at = NOW()
     WHERE id = $2 AND NOT is_deleted`,
    [status, userId]
  );
}

export async function markEmailVerified(
  userId: string,
  client?: pg.PoolClient
): Promise<void> {
  await (client ?? db).query(
    `UPDATE users
     SET email_verified = TRUE,
         email_verified_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND NOT is_deleted`,
    [userId]
  );
}

/**
 * Update password hash. Returns number of affected rows (0 = user not found or soft-deleted).
 * Accepts optional PoolClient for transaction composition
 * (Rule 1: password reset = update password + invalidate sessions + reset lockout).
 */
export async function updatePassword(
  userId: string,
  passwordHash: string,
  client?: pg.PoolClient
): Promise<number> {
  const result = await (client ?? db).query(
    `UPDATE users
     SET password_hash = $1,
         updated_at = NOW()
     WHERE id = $2 AND NOT is_deleted`,
    [passwordHash, userId]
  );
  return result.rowCount ?? 0;
}

/**
 * Reset lockout state for a user — used after successful password reset.
 * Accepts optional PoolClient for transaction composition (Rule 1).
 */
export async function resetLockout(
  userId: string,
  client?: pg.PoolClient
): Promise<void> {
  await (client ?? db).query(
    `UPDATE users
     SET failed_login_attempts = 0,
         locked_until = NULL,
         last_failed_login_at = NULL,
         updated_at = NOW()
     WHERE id = $1 AND NOT is_deleted`,
    [userId]
  );
}

/**
 * Set user's organization_id (denormalized for fast subscription checks).
 * Must be called within a transaction (uses PoolClient).
 */
export async function updateUserOrganization(
  client: pg.PoolClient,
  userId: string,
  organizationId: string
): Promise<void> {
  await client.query(
    `UPDATE users SET organization_id = $1, updated_at = NOW() WHERE id = $2 AND NOT is_deleted`,
    [organizationId, userId]
  );
}

/**
 * Clear user's organization_id (e.g., on org leave/removal).
 * Must be called within a transaction (uses PoolClient).
 */
export async function clearUserOrganization(
  client: pg.PoolClient,
  userId: string
): Promise<void> {
  await client.query(
    `UPDATE users SET organization_id = NULL, updated_at = NOW() WHERE id = $1 AND NOT is_deleted`,
    [userId]
  );
}

// --- Lockout DAL functions ---

export interface LockoutFields {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastFailedLoginAt: Date | null;
}

export interface LockoutUpdateResult {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

/**
 * Get lockout-related fields for a user.
 * Returns null if user not found or soft-deleted.
 */
export async function getLockoutFields(userId: string): Promise<LockoutFields | null> {
  const result = await db.query<{
    failed_login_attempts: number;
    locked_until: Date | null;
    last_failed_login_at: Date | null;
  }>(
    `SELECT failed_login_attempts, locked_until, last_failed_login_at
     FROM users WHERE id = $1 AND NOT is_deleted`,
    [userId]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: row.locked_until,
    lastFailedLoginAt: row.last_failed_login_at,
  };
}

/**
 * Atomically increment failed login attempts and set lockout timestamp.
 * Uses CASE WHEN to set lockout duration based on threshold in a single UPDATE,
 * preventing race conditions where concurrent requests could bypass lockout.
 *
 * Returns null if user not found.
 */
export async function recordFailedLoginAttempt(
  userId: string
): Promise<LockoutUpdateResult | null> {
  const result = await db.query<{
    failed_login_attempts: number;
    locked_until: Date | null;
  }>(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1,
         last_failed_login_at = NOW(),
         updated_at = NOW(),
         locked_until = CASE
           WHEN failed_login_attempts + 1 >= 20 THEN NULL
           WHEN failed_login_attempts + 1 >= 15 THEN NOW() + INTERVAL '1440 minutes'
           WHEN failed_login_attempts + 1 >= 10 THEN NOW() + INTERVAL '60 minutes'
           WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
           ELSE locked_until
         END
     WHERE id = $1 AND NOT is_deleted
     RETURNING failed_login_attempts, locked_until`,
    [userId]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: row.locked_until,
  };
}
