-- Migration 012: Add missing CHECK constraints
-- Aligns users and email_tokens with the constraint patterns already used by
-- organizations, invite_codes, and legal_acceptances tables.

-- users.subscription_status — matches the CHECK on organizations.subscription_status
-- and the TypeScript SubscriptionStatus union in types/index.ts
ALTER TABLE users ADD CONSTRAINT chk_users_subscription_status
  CHECK (subscription_status IN ('trialing', 'active', 'canceled', 'past_due', 'unpaid'));

-- email_tokens.token_type — matches the TypeScript EmailTokenRow union in types/database.ts
ALTER TABLE email_tokens ADD CONSTRAINT chk_email_tokens_token_type
  CHECK (token_type IN ('email_verification', 'password_reset'));
