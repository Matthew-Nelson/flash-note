-- Migration: 007_webhook_idempotency
-- Purpose: Database-backed idempotency for Stripe webhook processing (MEDIUM-013)
-- This prevents duplicate processing if server restarts or multiple instances run

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cleanup queries (delete events older than X days)
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
  ON processed_webhook_events(processed_at);

-- Comment for documentation
COMMENT ON TABLE processed_webhook_events IS
  'Tracks processed Stripe webhook events to prevent duplicate handling. Events older than 7 days can be safely deleted.';
