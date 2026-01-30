-- Migration: Add device binding columns to sessions table
-- Security: HIGH-006 (Refresh tokens not bound to device/IP)
-- Performance: MEDIUM-002 (O(n) bcrypt loop) + MEDIUM-011 (No session limit)
--
-- This migration enables:
-- 1. Device binding - Store IP address and user agent per session for audit trail
-- 2. O(1) token lookup - Index on user_id + created_at for efficient session management
-- 3. Session cleanup - Support for enforcing max sessions per user

-- Add device binding columns (HIGH-006)
-- SECURITY: These are stored for audit trail, not for blocking (lenient approach)
-- PT staff frequently change networks/devices, so we log mismatches rather than blocking
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Index for session count/cleanup queries (MEDIUM-011)
-- Used by enforceSessionLimit() to find oldest sessions for deletion
-- Also improves performance of session count queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON sessions(user_id, created_at);
