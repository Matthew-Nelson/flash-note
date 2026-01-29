import { db } from '../index.js';
import type { User } from '../../types/index.js';

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await db.query(
    `SELECT id, email, password_hash, stripe_customer_id, subscription_id,
            subscription_status, trial_ends_at, created_at, updated_at,
            failed_login_attempts, locked_until, last_failed_login_at
     FROM users WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
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
  };
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await db.query(
    `SELECT id, email, password_hash, stripe_customer_id, subscription_id,
            subscription_status, trial_ends_at, created_at, updated_at,
            failed_login_attempts, locked_until, last_failed_login_at
     FROM users WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
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
  };
}

export async function createUser(
  email: string,
  passwordHash: string
): Promise<User> {
  const result = await db.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, password_hash, stripe_customer_id, subscription_id,
               subscription_status, trial_ends_at, created_at, updated_at,
               failed_login_attempts, locked_until, last_failed_login_at`,
    [email, passwordHash]
  );

  const row = result.rows[0];
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
  };
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
