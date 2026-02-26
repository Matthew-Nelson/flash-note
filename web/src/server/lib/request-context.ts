import 'server-only';

import { headers } from 'next/headers';

import { sanitizeIpAddress } from './request-utils';
import type { SessionContext } from '@/server/types';

/**
 * Extract request context (IP, User-Agent) from Next.js request headers.
 * Used by Server Actions to pass context to services for audit logging and rate limiting.
 *
 * IP extraction: Cloud Run sets x-forwarded-for; falls back to x-real-ip.
 */
export async function getRequestContext(): Promise<SessionContext> {
  const headerStore = await headers();

  // x-forwarded-for may contain multiple IPs: "client, proxy1, proxy2"
  // The leftmost (first) IP is the original client
  const forwarded = headerStore.get('x-forwarded-for');
  const rawIp = forwarded?.split(',')[0]?.trim() ?? headerStore.get('x-real-ip') ?? undefined;
  const ipAddress = sanitizeIpAddress(rawIp) ?? undefined;

  const userAgent = headerStore.get('user-agent') ?? undefined;

  return { ipAddress, userAgent };
}
