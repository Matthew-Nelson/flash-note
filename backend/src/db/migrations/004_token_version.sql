-- Token Versioning for Immediate Session Invalidation
-- Migration: 004_token_version.sql
--
-- SECURITY: Token versioning allows immediate invalidation of all access tokens
-- when a user changes their password. Without this, stateless JWTs would remain
-- valid until expiry (up to 1 hour), creating a security window after password reset.

-- Add token_version column to users table
-- Default to 1 for new users, existing users start at 1
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1 NOT NULL;

-- Index for efficient token version lookups during auth validation
CREATE INDEX IF NOT EXISTS idx_users_token_version ON users(id, token_version);
