/**
 * Database row types - these map directly to PostgreSQL table columns (snake_case)
 * Used with pg's generic type parameter: db.query<RowType>(...)
 *
 * IMPORTANT: Keep these in sync with database migrations
 */

import type { SubscriptionStatus } from './index.js';

/**
 * users table row
 */
export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  trial_ends_at: Date;
  created_at: Date;
  updated_at: Date;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_failed_login_at: Date | null;
  email_verified: boolean;
  email_verified_at: Date | null;
  token_version: number;
}

/**
 * sessions table row
 */
export interface SessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: Date;
  created_at: Date;
  ip_address: string | null;  // HIGH-006: Device binding
  user_agent: string | null;  // HIGH-006: Device binding
}

/**
 * audit_logs table row
 */
export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  status: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

/**
 * usage table row
 */
export interface UsageRow {
  id: string;
  user_id: string;
  month: string;
  notes_generated: number;
  tokens_used: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * email_tokens table row
 */
export interface EmailTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  token_type: 'email_verification' | 'password_reset';
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

/**
 * Partial row types for SELECT queries that only fetch specific columns
 */
export interface UserLockoutRow {
  failed_login_attempts: number;
  locked_until: Date | null;
  last_failed_login_at: Date | null;
}

export interface UserTokenVersionRow {
  token_version: number;
}

export interface TokenUserIdRow {
  user_id: string;
}

export interface UsageStatsRow {
  notes_generated: number;
  tokens_used: number;
}

/**
 * Return type for lockout update query (RETURNING clause)
 */
export interface LockoutUpdateRow {
  failed_login_attempts: number;
  locked_until: Date | null;
}

/**
 * Subscription status query result
 */
export interface UserSubscriptionRow {
  subscription_status: string;
  trial_ends_at: Date;
}

/**
 * Session with refresh token hash for validation
 */
export interface SessionRefreshTokenRow {
  refresh_token_hash: string;
}

/**
 * Session with id and refresh token hash for revocation
 */
export interface SessionWithIdRow {
  id: string;
  refresh_token_hash: string;
}

/**
 * Session data needed for O(1) token validation (MEDIUM-002)
 * Includes device binding fields for audit logging (HIGH-006)
 */
export interface SessionValidationRow {
  id: string;
  refresh_token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
}
