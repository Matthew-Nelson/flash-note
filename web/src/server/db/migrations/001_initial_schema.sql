-- FlashNote Squashed Schema
-- Migration: 001_initial_schema.sql
--
-- Squashes 15 incremental backend migrations into one clean definition.
-- No production data exists — this is the canonical starting schema.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,

  -- Subscription info
  stripe_customer_id VARCHAR(255),
  subscription_id VARCHAR(255),
  subscription_status VARCHAR(50) DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'canceled', 'past_due', 'unpaid')),
  trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',

  -- Account lockout (progressive)
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_failed_login_at TIMESTAMPTZ,

  -- Email verification
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,

  -- Organization membership (denormalized for fast subscription checks)
  organization_id UUID,

  -- Soft-delete (H-18: HIPAA data retention)
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique: only active (non-deleted) users must have unique emails
-- Allows re-registration of emails from soft-deleted accounts
-- Uses LOWER() to prevent case-variant duplicates (e.g., User@Example.com vs user@example.com)
CREATE UNIQUE INDEX idx_users_email_active ON users(LOWER(email)) WHERE NOT is_deleted;

-- Note: No redundant idx_users_email — the partial unique index above handles lookups (L-14 fix)
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX idx_users_email_verified ON users(email_verified) WHERE email_verified = FALSE;
CREATE INDEX idx_users_organization ON users(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE is_deleted = TRUE;

-- ============================================================================
-- SESSIONS (opaque token-based)
-- ============================================================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Device binding for audit trail
  ip_address INET,
  user_agent TEXT
);

CREATE UNIQUE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_user_created ON sessions(user_id, created_at);

-- ============================================================================
-- AUDIT LOGS (HIPAA-required, immutable)
-- ============================================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'SUCCESS',
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user_created ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- Immutability triggers (45 CFR 164.312(c)(1))
CREATE OR REPLACE FUNCTION prevent_audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs rows cannot be modified';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_update();

CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs rows cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_delete();

CREATE OR REPLACE FUNCTION prevent_audit_log_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs table cannot be truncated';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_truncate();

-- ============================================================================
-- USAGE TRACKING
-- ============================================================================
CREATE TABLE usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  month VARCHAR(7) NOT NULL,  -- Format: '2025-01'
  notes_generated INT NOT NULL DEFAULT 0,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, month)
);

CREATE INDEX idx_usage_user_month ON usage(user_id, month);

-- ============================================================================
-- EMAIL TOKENS (verification + password reset)
-- ============================================================================
CREATE TABLE email_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  token_type VARCHAR(50) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- L-13 fix: UNIQUE constraint on token_hash
CREATE UNIQUE INDEX idx_email_tokens_token_hash ON email_tokens(token_hash);
CREATE INDEX idx_email_tokens_user_type ON email_tokens(user_id, token_type);
CREATE INDEX idx_email_tokens_expires ON email_tokens(expires_at) WHERE used_at IS NULL;

-- ============================================================================
-- LEGAL ACCEPTANCES (HIPAA consent tracking)
-- ============================================================================
CREATE TABLE legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  document_type VARCHAR(50) NOT NULL,
  document_version VARCHAR(20) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_document_type CHECK (
    document_type IN ('baa', 'terms_of_service', 'privacy_policy')
  )
);

CREATE INDEX idx_legal_acceptances_user ON legal_acceptances(user_id, document_type);
CREATE INDEX idx_legal_acceptances_version ON legal_acceptances(document_type, document_version);

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_seats INT NOT NULL CHECK (max_seats > 0),
  stripe_customer_id TEXT,
  subscription_id TEXT,
  subscription_status TEXT DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'canceled', 'past_due', 'unpaid')),
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from users.organization_id now that organizations table exists
ALTER TABLE users
  ADD CONSTRAINT fk_users_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- ============================================================================
-- ORGANIZATION MEMBERS
-- ============================================================================
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  is_billable BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);

-- Partial unique: prevent duplicate active memberships within an org
CREATE UNIQUE INDEX idx_org_members_active_unique
  ON organization_members(organization_id, user_id)
  WHERE removed_at IS NULL;

-- Partial unique: enforce single active membership across all orgs
CREATE UNIQUE INDEX idx_org_members_single_active
  ON organization_members(user_id)
  WHERE removed_at IS NULL;

CREATE INDEX idx_org_members_user ON organization_members(user_id) WHERE removed_at IS NULL;
CREATE INDEX idx_org_members_org ON organization_members(organization_id) WHERE removed_at IS NULL;

-- ============================================================================
-- INVITE CODES
-- ============================================================================
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('beta', 'clinic')),
  organization_id UUID REFERENCES organizations(id),
  created_by UUID NOT NULL REFERENCES users(id),
  used_by UUID REFERENCES users(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index for querying pending clinic codes by organization
CREATE INDEX idx_invite_codes_org_pending ON invite_codes(organization_id)
  WHERE used_by IS NULL AND is_active = TRUE;

-- ============================================================================
-- WEBHOOK EVENTS (Stripe idempotency)
-- ============================================================================
CREATE TABLE processed_webhook_events (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_processed_at ON processed_webhook_events(processed_at);
