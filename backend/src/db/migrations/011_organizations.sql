-- Migration 011: Organization infrastructure
-- Part of Wave 1 PR 1C (App Gating Strategy)
--
-- Creates organizations and organization_members tables for clinic management.
-- Adds denormalized organization_id to users for fast subscription checks.
-- Adds deferred FK on invite_codes.organization_id (table created in 010).
--
-- NOTE: FK constraints have no ON DELETE clause — this is intentional.
-- Org deletion is blocked if any users or members reference it.
-- Healthcare data retention: orgs are never hard-deleted (see APP_GATING_STRATEGY.md §Security #6).

-- organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_seats INT NOT NULL CHECK (max_seats > 0),
  stripe_customer_id TEXT,
  subscription_id TEXT,
  subscription_status TEXT DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'canceled', 'past_due', 'unpaid')),
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- organization_members table
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  is_billable BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);

-- Partial unique index: prevent duplicate ACTIVE memberships within an org
-- while allowing re-addition after removal (new row with removed_at = NULL)
CREATE UNIQUE INDEX idx_org_members_active_unique
  ON organization_members(organization_id, user_id)
  WHERE removed_at IS NULL;

-- Partial unique index: enforce single active membership across all orgs
-- Prevents race condition where concurrent joins put a user in two orgs
CREATE UNIQUE INDEX idx_org_members_single_active
  ON organization_members(user_id)
  WHERE removed_at IS NULL;

-- Lookup indexes
CREATE INDEX idx_org_members_user ON organization_members(user_id)
  WHERE removed_at IS NULL;
CREATE INDEX idx_org_members_org ON organization_members(organization_id)
  WHERE removed_at IS NULL;

-- Add organization_id to users (denormalized convenience column)
ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Index for future "list all users in org X" queries
CREATE INDEX idx_users_organization ON users(organization_id)
  WHERE organization_id IS NOT NULL;

-- Add FK on invite_codes (deferred from PR 1B migration 010)
ALTER TABLE invite_codes
  ADD CONSTRAINT fk_invite_codes_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(id);
