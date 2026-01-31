import { db } from '../index.js';

/**
 * Atomically check and record a webhook event for idempotency.
 * Returns true if this is a new event (should be processed).
 * Returns false if the event was already processed (skip).
 *
 * Uses INSERT ... ON CONFLICT to avoid race conditions.
 */
export async function tryMarkWebhookProcessed(
  eventId: string,
  eventType: string
): Promise<boolean> {
  const result = await db.query(
    `INSERT INTO processed_webhook_events (event_id, event_type)
     VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventType]
  );

  // rowCount = 1 means we inserted (new event)
  // rowCount = 0 means conflict (already processed)
  return (result.rowCount ?? 0) > 0;
}

/**
 * Clean up old webhook events.
 * Call periodically to prevent table bloat.
 * Stripe guarantees event delivery for up to 72 hours,
 * so 7 days is a safe retention period.
 */
export async function cleanupOldWebhookEvents(daysToKeep = 7): Promise<number> {
  const result = await db.query(
    `DELETE FROM processed_webhook_events
     WHERE processed_at < NOW() - INTERVAL '1 day' * $1`,
    [daysToKeep]
  );

  return result.rowCount ?? 0;
}
