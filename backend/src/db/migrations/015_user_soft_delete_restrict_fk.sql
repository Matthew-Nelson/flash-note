-- H-18: Prevent CASCADE deletion of HIPAA-required usage records.
-- Only usage changes to RESTRICT — sessions and email_tokens stay CASCADE (ephemeral auth state).

-- 1. Change usage FK from CASCADE to RESTRICT
ALTER TABLE usage DROP CONSTRAINT usage_user_id_fkey;
ALTER TABLE usage
  ADD CONSTRAINT usage_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

-- 2. Add soft-delete columns to users
ALTER TABLE users ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- 3. Replace email UNIQUE constraint with partial unique index
--    Only active (non-deleted) users must have unique emails.
--    This allows re-registration of emails from soft-deleted accounts.
DROP INDEX IF EXISTS idx_users_email;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX idx_users_email_active ON users(email) WHERE NOT is_deleted;

-- 4. Index for compliance queries on deleted users
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE is_deleted = TRUE;
