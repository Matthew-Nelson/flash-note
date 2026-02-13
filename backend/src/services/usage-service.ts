import * as Sentry from '@sentry/node';
import { db } from '../db/index.js';
import type { UsageStatsRow } from '../types/database.js';
import type { MonthlyUsageStats } from '../types/index.js';

class UsageService {
  async incrementUsage(userId: string, inputTokens: number, outputTokens: number): Promise<void> {
    const month = this.getCurrentMonth();

    try {
      await db.query(
        `INSERT INTO usage (user_id, month, notes_generated, input_tokens, output_tokens)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (user_id, month)
         DO UPDATE SET
           notes_generated = usage.notes_generated + 1,
           input_tokens = usage.input_tokens + $3,
           output_tokens = usage.output_tokens + $4,
           updated_at = NOW()`,
        [userId, month, inputTokens, outputTokens]
      );
    } catch (error) {
      // Don't throw - usage tracking failures shouldn't break the app
      Sentry.captureException(error, {
        extra: {
          source: 'usage_service',
          errorType: 'increment_usage_failed',
        },
      });
      console.error('Usage tracking failed:', error);
    }
  }

  async getMonthlyUsage(userId: string): Promise<MonthlyUsageStats> {
    const month = this.getCurrentMonth();

    const result = await db.query<UsageStatsRow>(
      `SELECT notes_generated, input_tokens, output_tokens FROM usage
       WHERE user_id = $1 AND month = $2`,
      [userId, month]
    );

    if (result.rows.length === 0) {
      return { notesGenerated: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    }

    const inputTokens = result.rows[0]!.input_tokens;
    const outputTokens = result.rows[0]!.output_tokens;
    return {
      notesGenerated: result.rows[0]!.notes_generated,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };
  }

  private getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}

export const usageService = new UsageService();
