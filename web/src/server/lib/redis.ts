import 'server-only';

import { Redis } from '@upstash/redis';

import { config, isProduction } from '@/server/db/config';

/**
 * Singleton Upstash Redis client.
 *
 * Returns null when credentials aren't configured (dev/test without Redis).
 * Exits the process in production without credentials — rate limiting is mandatory.
 */
function createRedisClient(): Redis | null {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = config;

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    if (isProduction) {
      // eslint-disable-next-line no-console
      console.error('FATAL: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production');
      process.exit(1);
    }
    return null;
  }

  return new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
  });
}

export const redis = createRedisClient();
