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

// ============================================================================
// Phase 4 (04-01) — PHI Storage row types
// ============================================================================

/**
 * note_templates table row — user/org-owned templates (user_id/org_id NOT NULL
 * for custom) or built-in (user_id/org_id NULL, is_builtin = true).
 */
export interface NoteTemplateRow {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  name: string;
  is_builtin: boolean;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * note_template_sections table row — ordered sections belonging to a template.
 * verbosity/styling are DB defaults; user overrides live in user_style_preferences.
 */
export interface NoteTemplateSectionRow {
  id: string;
  template_id: string;
  title: string;
  sort_order: number;
  verbosity: 'concise' | 'detailed';
  styling: 'paragraph' | 'bullets';
  prompt_instructions: string;
  include_in_copy_all: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * patients table row — PHI. user_id is ALWAYS set (Rule 5 scope),
 * organization_id is optional (scope for clinic users).
 */
export interface PatientRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: Date | null;
  pronoun: string | null;
  phone: string | null;
  email: string | null;
  context: string | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * clinical_notes table row — PHI. `content` is JSONB (stored as raw from pg);
 * DAL rowToClinicalNote Zod-parses it into NoteSection[] per Rule 3.
 */
export interface ClinicalNoteRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  patient_id: string | null;
  template_id: string;
  note_type: 'daily_note' | 'initial_eval' | 'progress_note' | 'discharge';
  content: unknown; // JSONB — Zod-parse to NoteSection[] in DAL
  quick_notes: string;
  patient_context: string | null;
  modality: 'in_person' | 'telehealth' | null;
  duration_minutes: number | null;
  generation_time_ms: number | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * clinical_notes LEFT JOIN patients — patient name denormalized into the row
 * for list/detail views. patient_first_name/patient_last_name are NULL when
 * the note has no linked patient or when the patient row was archived.
 */
export interface ClinicalNoteWithPatientRow extends ClinicalNoteRow {
  patient_first_name: string | null;
  patient_last_name: string | null;
}

/**
 * note_versions table row — append-only per-section version rows.
 * Immutability triggers prevent UPDATE/DELETE at the DB level.
 */
export interface NoteVersionRow {
  id: string;
  note_id: string;
  section_id: string;
  version: number;
  content: string;
  source: 'generated' | 'manual' | 'magic_edit';
  created_by: string;
  created_at: Date;
}

/**
 * note_versions JOIN note_template_sections — section title denormalized
 * for version history UI rendering.
 */
export interface NoteVersionWithSectionRow extends NoteVersionRow {
  section_title: string;
}

/**
 * user_style_preferences table row — per-user overlay for section verbosity/styling.
 * Composite primary key (user_id, section_id).
 */
export interface UserStylePreferenceRow {
  user_id: string;
  section_id: string;
  verbosity: 'concise' | 'detailed';
  styling: 'paragraph' | 'bullets';
  updated_at: Date;
}
