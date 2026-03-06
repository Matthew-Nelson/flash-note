import { timingSafeEqual } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldWebhookEvents } from '@/server/dal/webhooks';
import { config } from '@/server/db/config';

/**
 * Webhook event cleanup Route Handler.
 * Called by Cloud Scheduler to periodically clean up old webhook event records.
 *
 * Auth: Bearer token (CLEANUP_SECRET) — Phase 1.7 will upgrade to OIDC tokens.
 *
 * Returns: { deleted: number } on success.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = config.CLEANUP_SECRET;

  const expectedValue = `Bearer ${expectedSecret}`;
  if (
    !expectedSecret ||
    !authHeader ||
    authHeader.length !== expectedValue.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedValue))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const deleted = await cleanupOldWebhookEvents(7);
    // eslint-disable-next-line no-console -- TODO: Replace with Pino logger in Phase 1.7
    console.log(`Cleaned up ${deleted} old webhook events`);
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error('Webhook event cleanup failed:', {
      source: 'route_cleanup',
      errorType: error instanceof Error ? error.constructor.name : 'unknown',
    });
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
