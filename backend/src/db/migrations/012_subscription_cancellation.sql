-- Track pending subscription cancellations
-- When a user cancels via Stripe portal, the subscription remains active
-- until the billing period ends. These columns capture that intermediate state.

ALTER TABLE users
  ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN current_period_end TIMESTAMPTZ;
