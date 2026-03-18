import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { logger } from '@/server/lib/logger';
import { createRequestLogger } from '@/server/lib/request-logger';
import { telemetryRateLimit, checkRateLimit } from '@/server/lib/rate-limit';
import { config } from '@/server/db/config';

/**
 * Telemetry ingestion endpoint.
 *
 * Accepts client-side error reports from sendBeacon/fetch and logs them
 * server-side through Pino. Unauthenticated -- captures errors from
 * login, signup, and other pre-auth pages.
 *
 * Security:
 * - Rate-limited by IP (20 req/min via Upstash)
 * - Validated with Zod (rejects malformed payloads)
 * - Always returns 200 { ok: true } -- never leaks validation errors
 *   or rate limit status to clients
 */

const telemetrySchema = z.object({
  type: z.enum(['unhandled_error', 'unhandled_rejection', 'error_boundary']),
  message: z.string().max(1000),
  stack: z.string().max(5000).optional(),
  digest: z.string().max(100).optional(),
  url: z.string().max(500).optional(),
  componentStack: z.string().max(2000).optional(),
});

const OK_RESPONSE = { ok: true };

/**
 * Extract client IP from x-forwarded-for, using TRUSTED_PROXY_COUNT
 * to skip trusted proxy hops from the right.
 *
 * Consistent with request-context.ts IP extraction pattern.
 */
function extractIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded) return 'unknown';

  const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
  const trustedProxyCount = config.TRUSTED_PROXY_COUNT;
  const targetIndex = Math.max(0, parts.length - 1 - trustedProxyCount);
  return parts[targetIndex] || 'unknown';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limit by IP (unauthenticated endpoint)
    const ip = extractIp(request);
    const { success } = await checkRateLimit(telemetryRateLimit, ip);
    if (!success) {
      logger.debug({ source: 'telemetry', reason: 'rate_limited' }, 'Telemetry event dropped');
      return NextResponse.json(OK_RESPONSE); // Silent rate limit
    }

    // Parse body -- handle both application/json and text/plain (sendBeacon edge case)
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      // sendBeacon with text/plain content type may not parse as json()
      try {
        const text = await request.text();
        body = JSON.parse(text);
      } catch {
        return NextResponse.json(OK_RESPONSE); // Silent parse failure
      }
    }

    // Validate with Zod -- reject silently on failure
    const parsed = telemetrySchema.safeParse(body);
    if (!parsed.success) {
      logger.debug({ source: 'telemetry', reason: 'validation_failed' }, 'Telemetry event dropped');
      return NextResponse.json(OK_RESPONSE); // Silent validation failure
    }

    const event = parsed.data;

    // Log through Pino with request-scoped trace correlation
    const reqLogger = createRequestLogger(request);
    reqLogger.error(
      {
        source: 'client',
        errorType: event.type,
        stack_trace: event.stack, // Key name matches GCP Error Reporting expectation
        url: event.url,
        digest: event.digest,
        componentStack: event.componentStack,
      },
      `[Client] ${event.message}`
    );

    return NextResponse.json(OK_RESPONSE);
  } catch {
    // Defensive: catch any unexpected errors -- telemetry endpoint must never 500
    return NextResponse.json(OK_RESPONSE);
  }
}
