import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';

import { redis } from './redis';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Create a rate limiter instance. Returns null when Redis is unavailable (dev/test).
 */
function createLimiter(
  tokens: number,
  window: Parameters<typeof Ratelimit.slidingWindow>[1],
  prefix: string
): Ratelimit | null {
  if (!redis) return null;

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix: `flashnote:${prefix}`,
  });
}

// --- Auth rate limiters ---

/** 5 requests per 15 min, keyed by IP:email */
export const loginRateLimit = createLimiter(5, '15 m', 'login');

/** 3 requests per 1 hour, keyed by IP */
export const registerRateLimit = createLimiter(3, '1 h', 'register');

/** 3 requests per 1 hour, keyed by IP */
export const verificationResendRateLimit = createLimiter(3, '1 h', 'verification_resend');

/** 10 requests per 15 min, keyed by IP */
export const verificationCompleteRateLimit = createLimiter(10, '15 m', 'verification_complete');

/** 3 requests per 1 hour, keyed by IP */
export const passwordResetRequestRateLimit = createLimiter(3, '1 h', 'password_reset_request');

/** 5 requests per 15 min, keyed by IP */
export const passwordResetCompleteRateLimit = createLimiter(5, '15 m', 'password_reset_complete');

/** 10 requests per 1 min, keyed by IP */
export const inviteCodeValidateRateLimit = createLimiter(10, '1 m', 'invite_code_validate');

/** 5 requests per 15 min, keyed by IP */
export const orgJoinRateLimit = createLimiter(5, '15 m', 'org_join');

// --- Non-auth rate limiters ---

/** 30 requests per 1 min, keyed by IP:userId */
export const generateRateLimit = createLimiter(30, '1 m', 'generate');

// --- Global rate limiter ---

/** 100 requests per 1 min, keyed by IP */
export const apiRateLimit = createLimiter(100, '1 m', 'api');

/**
 * Check a rate limit. Returns a no-op success when the limiter is null (dev/test without Redis).
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitResult> {
  if (!limiter) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Build a compound rate limit key.
 * Used for IP:email (login) or IP:userId (generate) keys.
 */
export function rateLimitKey(ip: string, identifier?: string): string {
  if (!identifier) return ip;
  return `${ip}:${identifier}`;
}
