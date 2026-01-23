import { db } from '../db/index.js';

class UsageService {
  async incrementUsage(userId: string, tokensUsed: number): Promise<void> {
    const month = this.getCurrentMonth();

    try {
      await db.query(
        `INSERT INTO usage (user_id, month, notes_generated, tokens_used)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (user_id, month)
         DO UPDATE SET
           notes_generated = usage.notes_generated + 1,
           tokens_used = usage.tokens_used + $3,
           updated_at = NOW()`,
        [userId, month, tokensUsed]
      );
    } catch (error) {
      // Don't throw - usage tracking failures shouldn't break the app
      console.error('Usage tracking failed:', error);
    }
  }

  async getMonthlyUsage(userId: string): Promise<{ notesGenerated: number; tokensUsed: number }> {
    const month = this.getCurrentMonth();

    const result = await db.query(
      `SELECT notes_generated, tokens_used FROM usage
       WHERE user_id = $1 AND month = $2`,
      [userId, month]
    );

    if (result.rows.length === 0) {
      return { notesGenerated: 0, tokensUsed: 0 };
    }

    return {
      notesGenerated: result.rows[0].notes_generated,
      tokensUsed: result.rows[0].tokens_used,
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
