import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mockDbQuery, resetMocks } from '../test/setup.js';

// Import after mocking
import { usageService } from './usage-service.js';

describe('UsageService', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('incrementUsage', () => {
    it('should insert or update usage record with UPSERT', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await usageService.incrementUsage('user-123', 500);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO usage'),
        expect.arrayContaining(['user-123', expect.stringMatching(/^\d{4}-\d{2}$/), 500])
      );
    });

    it('should use ON CONFLICT for upsert behavior', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await usageService.incrementUsage('user-123', 100);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });

    it('should increment notes_generated and tokens_used on conflict', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await usageService.incrementUsage('user-123', 200);

      const query = mockDbQuery.mock.calls[0]?.[0] as string;
      expect(query).toContain('notes_generated = usage.notes_generated + 1');
      expect(query).toContain('tokens_used = usage.tokens_used + $3');
    });

    it('should not throw on database error (swallow and log)', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      // Should not throw
      await expect(
        usageService.incrementUsage('user-123', 100)
      ).resolves.toBeUndefined();

      // Should log the error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Usage tracking failed:',
        expect.any(Error)
      );
    });

    it('should format month as YYYY-MM', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await usageService.incrementUsage('user-123', 100);

      const params = mockDbQuery.mock.calls[0]?.[1] as unknown[];
      const month = params[1] as string;
      expect(month).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('getMonthlyUsage', () => {
    it('should return usage stats when record exists', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ notes_generated: 25, tokens_used: 5000 }],
      });

      const result = await usageService.getMonthlyUsage('user-123');

      expect(result).toEqual({
        notesGenerated: 25,
        tokensUsed: 5000,
      });
    });

    it('should return zeros when no record exists', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await usageService.getMonthlyUsage('user-123');

      expect(result).toEqual({
        notesGenerated: 0,
        tokensUsed: 0,
      });
    });

    it('should query for current month', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await usageService.getMonthlyUsage('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1 AND month = $2'),
        expect.arrayContaining(['user-123', expect.stringMatching(/^\d{4}-\d{2}$/)])
      );
    });

    it('should select notes_generated and tokens_used', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await usageService.getMonthlyUsage('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT notes_generated, tokens_used'),
        expect.any(Array)
      );
    });
  });
});
