-- Split tokens_used into input_tokens + output_tokens for granular cost tracking
-- Input and output tokens have different costs (e.g., Gemini Flash: ~$0.15/1M input vs ~$0.60/1M output)

-- Add granular token tracking columns
ALTER TABLE usage ADD COLUMN input_tokens INT NOT NULL DEFAULT 0;
ALTER TABLE usage ADD COLUMN output_tokens INT NOT NULL DEFAULT 0;

-- Migrate existing data: assign all tokens_used to output_tokens (conservative cost estimate)
UPDATE usage SET output_tokens = tokens_used WHERE tokens_used > 0;

-- Drop the legacy column
-- WARNING: This DROP is safe pre-beta (no live traffic). For production rolling deploys,
-- this MUST be split into a separate migration: (1) add columns + backfill + deploy new code,
-- then (2) drop old column once all instances are on new code. Old instances will fail on
-- INSERT/SELECT if tokens_used is dropped while they still reference it.
ALTER TABLE usage DROP COLUMN tokens_used;
