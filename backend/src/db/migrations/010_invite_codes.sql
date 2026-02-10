-- Migration 010: Invite codes for registration gating
-- Part of Wave 1 PR 1B (App Gating Strategy)
--
-- Creates the invite_codes table for beta and clinic invite management.
-- Supports both individual beta invites (type='beta') and clinic seat
-- invitations (type='clinic').
--
-- NOTE: organization_id is nullable and has NO FK constraint in this migration.
-- PR 1C will create the organizations table and add the FK constraint:
--   ALTER TABLE invite_codes
--     ADD CONSTRAINT fk_invite_codes_organization
--     FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('beta', 'clinic')),
  organization_id UUID,
  created_by UUID REFERENCES users(id),
  used_by UUID REFERENCES users(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: no explicit index on `code` — the UNIQUE constraint already creates one.

-- Partial index for querying pending clinic codes by organization
-- Only includes unused, active codes
CREATE INDEX idx_invite_codes_org_pending ON invite_codes(organization_id)
  WHERE used_by IS NULL AND is_active = TRUE;
