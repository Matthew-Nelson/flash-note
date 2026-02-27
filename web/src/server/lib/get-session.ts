import 'server-only';

import { cache } from 'react';

import {
  SESSION_IDLE_TTL_MS,
  SESSION_ABSOLUTE_MAX_MS,
  SESSION_REFRESH_THRESHOLD,
} from '@/server/db/config';
import { findSessionByTokenHash, refreshSessionExpiry } from '@/server/dal/sessions';
import { getSessionToken, hashSessionToken } from './session-cookie';
import type { SessionData } from '@/server/types';

/**
 * Validate the current request's session.
 *
 * Flow:
 * 1. Read raw token from cookie
 * 2. SHA-256 hash it
 * 3. Look up session+user in DB (includes expiry check)
 * 4. Sliding window refresh if needed
 * 5. Return SessionData or null
 *
 * Fail-closed: DB errors return null (user redirected to login).
 * This is the function every Server Component and Server Action calls.
 *
 * Wrapped with React.cache() to deduplicate within a single request
 * (e.g. layout + page both calling getSession() results in one DB query).
 */
export const getSession = cache(async function getSession(): Promise<SessionData | null> {
  try {
    const token = await getSessionToken();
    if (!token) return null;

    const tokenHash = hashSessionToken(token);
    const session = await findSessionByTokenHash(tokenHash);
    if (!session) return null;

    // Sliding window refresh
    const now = Date.now();
    const idleExpiry = new Date(now + SESSION_IDLE_TTL_MS);
    const absoluteMax = new Date(session.created_at.getTime() + SESSION_ABSOLUTE_MAX_MS);
    const newExpiry = idleExpiry < absoluteMax ? idleExpiry : absoluteMax;

    const timeRemaining = session.expires_at.getTime() - now;
    const refreshNeeded =
      timeRemaining < SESSION_IDLE_TTL_MS * SESSION_REFRESH_THRESHOLD &&
      newExpiry.getTime() > session.expires_at.getTime();

    if (refreshNeeded) {
      try {
        await refreshSessionExpiry(session.id, newExpiry);
      } catch (refreshError) {
        // Non-critical: session remains valid, just won't be extended this request
        // TODO: Replace with Pino structured logger when available:
        //   logger.error({ err: refreshError, source: 'lib_get_session', errorType: 'session_refresh_failed',
        //     sessionId: session.id }, 'Session refresh failed');
        // eslint-disable-next-line no-console
        console.error('Session refresh failed:', refreshError);
      }
    }

    return {
      sessionId: session.id,
      userId: session.user_id,
      email: session.email,
      subscriptionStatus: session.subscription_status,
      trialEndsAt: session.trial_ends_at,
      emailVerified: session.email_verified,
      organizationId: session.organization_id,
    };
  } catch (error) {
    // Fail-closed: DB errors → null → user redirected to login
    // TODO: Replace with Pino structured logger when available:
    //   logger.error({ err: error, source: 'lib_get_session', errorType: 'session_validation_failed' },
    //     'Session validation failed');
    // eslint-disable-next-line no-console
    console.error('getSession error:', error);
    return null;
  }
});
