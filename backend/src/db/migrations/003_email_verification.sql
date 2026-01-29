-- FlashNote Email Verification Schema
-- Migration: 003_email_verification.sql
-- Purpose: Add email verification and password reset support (HIGH-007, HIGH-001)

-- Add email verification columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Create email_tokens table for verification and password reset tokens
CREATE TABLE email_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  token_type VARCHAR(50) NOT NULL, -- 'email_verification' or 'password_reset'
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email_tokens
-- Index for looking up tokens by user and type (e.g., invalidating existing tokens)
CREATE INDEX idx_email_tokens_user_type ON email_tokens(user_id, token_type);

-- Index for cleanup of expired unused tokens
CREATE INDEX idx_email_tokens_expires ON email_tokens(expires_at) WHERE used_at IS NULL;

-- Index for finding unverified users (useful for reminder emails, admin queries)
CREATE INDEX idx_users_email_verified ON users(email_verified) WHERE email_verified = FALSE;

-- Comments for documentation
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address.';
COMMENT ON COLUMN users.email_verified_at IS 'Timestamp when email was verified. NULL if not verified.';
COMMENT ON TABLE email_tokens IS 'Stores hashed tokens for email verification and password reset.';
COMMENT ON COLUMN email_tokens.token_hash IS 'SHA-256 hash of the token. Original token sent to user.';
COMMENT ON COLUMN email_tokens.token_type IS 'Type of token: email_verification or password_reset.';
COMMENT ON COLUMN email_tokens.used_at IS 'Timestamp when token was used. NULL if unused. Kept for audit trail.';
