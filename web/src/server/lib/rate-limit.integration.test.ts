import { describe, it, expect } from 'vitest';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Integration test — requires real Upstash Redis credentials.
 * Skipped when UPSTASH_REDIS_REST_URL is not set (local dev, CI without secrets).
 *
 * Rule 6: Tests must exercise real security mechanisms.
 * This test verifies that requests are actually blocked after the limit.
 */
describe.skipIf(!process.env.UPSTASH_REDIS_REST_URL)(
  'rate-limit integration',
  () => {
    it('should block requests after limit exceeded', async () => {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });

      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, '10 s'),
        prefix: 'flashnote:test:integration',
      });

      // Use a unique key to avoid cross-test pollution
      const key = `test-${Date.now()}-${Math.random()}`;

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const result = await limiter.limit(key);
        expect(result.success).toBe(true);
      }

      // 4th request should be blocked
      const blocked = await limiter.limit(key);
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
    });
  }
);
