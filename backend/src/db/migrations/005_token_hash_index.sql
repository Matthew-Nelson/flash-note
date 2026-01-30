-- Migration: 005_token_hash_index
-- Description: Add index on email_tokens.token_hash for efficient token lookups
-- Related Issue: Code Review H2 - Missing index causes full table scans on token validation

-- Index for token validation queries which filter by token_hash
-- Query pattern: WHERE token_hash = $1 AND token_type = $2 AND used_at IS NULL AND expires_at > NOW()
CREATE INDEX IF NOT EXISTS idx_email_tokens_token_hash ON email_tokens(token_hash);
