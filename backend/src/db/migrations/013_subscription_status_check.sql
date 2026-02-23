-- H-11: Add CHECK constraint on users.subscription_status
-- Matches the existing pattern on organizations table.
-- Validates existing rows on add — migration fails if any row has an invalid value.

ALTER TABLE users
  ADD CONSTRAINT chk_users_subscription_status
  CHECK (subscription_status IN ('trialing', 'active', 'canceled', 'past_due', 'unpaid'));
