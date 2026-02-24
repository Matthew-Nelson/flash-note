/**
 * Database row types — map directly to PostgreSQL table columns (snake_case).
 * Used with pg's generic type parameter: db.query<RowType>(...)
 *
 * Pure interfaces with no runtime behavior — safe in lib/ for shared access.
 *
 * IMPORTANT: Keep these in sync with database migrations.
 */

import type { SubscriptionStatus, OrgRole } from './index';

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
  organization_id: string | null;
  is_deleted: boolean;
  deleted_at: Date | null;
}

/**
 * sessions table row (opaque token-based — no refresh_token_hash)
 */
export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  ip_address: string | null;
  user_agent: string | null;
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
  input_tokens: number;
  output_tokens: number;
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
 * legal_acceptances table row
 */
export interface LegalAcceptanceRow {
  id: string;
  user_id: string;
  document_type: string;
  document_version: string;
  ip_address: string | null;
  user_agent: string | null;
  accepted_at: Date;
}

/**
 * invite_codes table row
 */
export interface InviteCodeRow {
  id: string;
  code: string;
  type: 'beta' | 'clinic';
  organization_id: string | null;
  created_by: string;
  used_by: string | null;
  used_at: Date | null;
  expires_at: Date;
  is_active: boolean;
  created_at: Date;
}

/**
 * organizations table row
 */
export interface OrganizationRow {
  id: string;
  name: string;
  max_seats: number;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  trial_ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * organization_members table row
 */
export interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  is_billable: boolean;
  joined_at: Date;
  removed_at: Date | null;
}

/**
 * Session JOIN users — returned by findSessionByTokenHash.
 * Only includes user fields needed for authorization (no lockout fields).
 */
export interface SessionWithUserRow {
  // Session fields
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  ip_address: string | null;
  user_agent: string | null;
  // User fields (authorization-relevant only)
  email: string;
  subscription_status: SubscriptionStatus;
  trial_ends_at: Date;
  email_verified: boolean;
  organization_id: string | null;
}

/**
 * Partial row types for SELECT queries that only fetch specific columns
 */
export interface UserLockoutRow {
  failed_login_attempts: number;
  locked_until: Date | null;
  last_failed_login_at: Date | null;
}

export interface TokenUserIdRow {
  user_id: string;
}

export interface UsageStatsRow {
  notes_generated: number;
  input_tokens: number;
  output_tokens: number;
}

export interface LockoutUpdateRow {
  failed_login_attempts: number;
  locked_until: Date | null;
}

export interface UserSubscriptionRow {
  subscription_status: SubscriptionStatus;
  trial_ends_at: Date | null;
  organization_id: string | null;
}

export interface OrgSubscriptionRow {
  subscription_status: SubscriptionStatus;
  trial_ends_at: Date | null;
}
