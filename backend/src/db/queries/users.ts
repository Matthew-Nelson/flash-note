import { db } from '../index.js';
import type { User } from '../../types/index.js';
import type { UserRow, UserTokenVersionRow } from '../../types/database.js';

/**
 * Helper to transform database row (snake_case) to User type (camelCase)
 */
function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    stripeCustomerId: row.stripe_customer_id,
    subscriptionId: row.subscription_id,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    failedLoginAttempts: row.failed_login_attempts ?? 0,
    lockedUntil: row.locked_until,
    lastFailedLoginAt: row.last_failed_login_at,
    emailVerified: row.email_verified ?? false,
    emailVerifiedAt: row.email_verified_at,
    tokenVersion: row.token_version ?? 1,
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await db.query<UserRow>(
    `SELECT id, email, password_hash, stripe_customer_id, subscription_id,
            subscription_status, trial_ends_at, created_at, updated_at,
            failed_login_attempts, locked_until, last_failed_login_at,
            email_verified, email_verified_at, token_version
     FROM users WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]!);
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await db.query<UserRow>(
    `SELECT id, email, password_hash, stripe_customer_id, subscription_id,
            subscription_status, trial_ends_at, created_at, updated_at,
            failed_login_attempts, locked_until, last_failed_login_at,
            email_verified, email_verified_at, token_version
     FROM users WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]!);
}

export async function createUser(
  email: string,
  passwordHash: string
): Promise<User> {
  const result = await db.query<UserRow>(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, password_hash, stripe_customer_id, subscription_id,
               subscription_status, trial_ends_at, created_at, updated_at,
               failed_login_attempts, locked_until, last_failed_login_at,
               email_verified, email_verified_at, token_version`,
    [email, passwordHash]
  );

  return rowToUser(result.rows[0]!);
}

export async function updateUserSubscription(
  userId: string,
  stripeCustomerId: string,
  subscriptionId: string,
  status: string
): Promise<void> {
  await db.query(
    `UPDATE users SET
       stripe_customer_id = $1,
       subscription_id = $2,
       subscription_status = $3,
       updated_at = NOW()
     WHERE id = $4`,
    [stripeCustomerId, subscriptionId, status, userId]
  );
}

export async function updateSubscriptionStatus(
  userId: string,
  status: string
): Promise<void> {
  await db.query(
    `UPDATE users SET subscription_status = $1, updated_at = NOW()
     WHERE id = $2`,
    [status, userId]
  );
}

export async function markEmailVerified(userId: string): Promise<void> {
  await db.query(
    `UPDATE users
     SET email_verified = TRUE,
         email_verified_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
}

export async function updatePassword(
  userId: string,
  passwordHash: string
): Promise<void> {
  await db.query(
    `UPDATE users
     SET password_hash = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [passwordHash, userId]
  );
}

/**
 * Get token version for a user - used for efficient token validation
 * Returns null if user not found
 */
export async function getTokenVersion(userId: string): Promise<number | null> {
  const result = await db.query<UserTokenVersionRow>(
    'SELECT token_version FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) return null;
  return result.rows[0]!.token_version ?? 1;
}

/**
 * Increment token version - used to invalidate all existing tokens
 * SECURITY: Call this on password reset to immediately invalidate all sessions
 */
export async function incrementTokenVersion(userId: string): Promise<number> {
  const result = await db.query<UserTokenVersionRow>(
    `UPDATE users
     SET token_version = token_version + 1,
         updated_at = NOW()
     WHERE id = $1
     RETURNING token_version`,
    [userId]
  );

  return result.rows[0]!.token_version;
}
