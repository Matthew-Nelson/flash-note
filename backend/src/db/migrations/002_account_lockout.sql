-- FlashNote Account Lockout Schema
-- Migration: 002_account_lockout.sql
-- Purpose: Add columns to support progressive account lockout mechanism (HIGH-005)

-- Add lockout tracking columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ;

-- Create index for efficient lockout queries
-- This helps when checking lockout status during login
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN users.failed_login_attempts IS 'Count of consecutive failed login attempts. Reset on successful login.';
COMMENT ON COLUMN users.locked_until IS 'Account locked until this timestamp. NULL means not locked.';
COMMENT ON COLUMN users.last_failed_login_at IS 'Timestamp of last failed login attempt. Used for lockout escalation tracking.';
