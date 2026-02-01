import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbQuery, resetMocks } from '../../test/setup.js';
import { tryMarkWebhookProcessed, cleanupOldWebhookEvents } from './webhooks.js';

describe('Webhook Queries', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('tryMarkWebhookProcessed', () => {
    it('should return true for new event (rowCount = 1)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const result = await tryMarkWebhookProcessed('evt_123', 'checkout.session.completed');

      expect(result).toBe(true);
    });

    it('should return false for duplicate event (rowCount = 0)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await tryMarkWebhookProcessed('evt_duplicate', 'checkout.session.completed');

      expect(result).toBe(false);
    });

    it('should handle null rowCount (returns false)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: undefined });

      const result = await tryMarkWebhookProcessed('evt_123', 'unknown.event');

      expect(result).toBe(false);
    });

    it('should use INSERT ... ON CONFLICT DO NOTHING for idempotency', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await tryMarkWebhookProcessed('evt_123', 'invoice.paid');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO processed_webhook_events'),
        ['evt_123', 'invoice.paid']
      );
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (event_id) DO NOTHING'),
        expect.any(Array)
      );
    });

    it('should insert event_id and event_type', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await tryMarkWebhookProcessed('evt_abc', 'customer.subscription.updated');

      const [query, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(query).toContain('event_id');
      expect(query).toContain('event_type');
      expect(params).toContain('evt_abc');
      expect(params).toContain('customer.subscription.updated');
    });
  });

  describe('cleanupOldWebhookEvents', () => {
    it('should delete events older than default 7 days', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 5 });

      const result = await cleanupOldWebhookEvents();

      expect(result).toBe(5);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM processed_webhook_events'),
        [7]
      );
    });

    it('should accept custom retention period', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 10 });

      const result = await cleanupOldWebhookEvents(30);

      expect(result).toBe(10);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.any(String),
        [30]
      );
    });

    it('should return 0 when no events deleted', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await cleanupOldWebhookEvents();

      expect(result).toBe(0);
    });

    it('should handle null rowCount (returns 0)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: undefined });

      const result = await cleanupOldWebhookEvents();

      expect(result).toBe(0);
    });

    it('should use interval calculation for date comparison', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await cleanupOldWebhookEvents(14);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("processed_at < NOW() - INTERVAL '1 day' * $1"),
        [14]
      );
    });
  });
});
