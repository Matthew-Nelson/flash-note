import 'server-only';

import { headers } from 'next/headers';

import { config } from '@/server/db/config';
import { sanitizeIpAddress } from './request-utils';
import type { SessionContext } from '@/server/types';

/**
 * Extract request context (IP, User-Agent) from Next.js request headers.
 * Used by Server Actions to pass context to services for audit logging and rate limiting.
 *
 * IP extraction: Uses TRUSTED_PROXY_COUNT to select the correct IP from
 * x-forwarded-for, defending against client-supplied header spoofing.
 *
 * Cloud Run appends the real client IP to x-forwarded-for but does NOT strip
 * client-supplied values. Taking the leftmost IP is exploitable. Instead, we
 * take the IP at position (parts.length - 1 - TRUSTED_PROXY_COUNT), which is
 * the first IP that wasn't appended by a trusted proxy.
 *
 * If the computed index is out of bounds (fewer hops than expected, e.g., local
 * dev without a proxy chain), we fall back to the rightmost IP.
 */
export async function getRequestContext(): Promise<SessionContext> {
  const headerStore = await headers();

  const forwarded = headerStore.get('x-forwarded-for');
  let rawIp: string | undefined;

  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    const trustedProxyCount = config.TRUSTED_PROXY_COUNT;
    // Target: the IP just before the trusted proxy hops.
    // Falls back to rightmost (safest available) if index goes negative.
    const targetIndex = Math.max(0, parts.length - 1 - trustedProxyCount);
    rawIp = parts[targetIndex];
  } else {
    rawIp = headerStore.get('x-real-ip') ?? undefined;
  }

  const ipAddress = sanitizeIpAddress(rawIp) ?? undefined;
  const userAgent = headerStore.get('user-agent') ?? undefined;

  return { ipAddress, userAgent };
}
