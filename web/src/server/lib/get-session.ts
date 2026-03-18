import 'server-only';

import { cache } from 'react';

import {
  SESSION_IDLE_TTL_MS,
  SESSION_ABSOLUTE_MAX_MS,
  SESSION_REFRESH_THRESHOLD,
} from '@/server/db/config';
import { findSessionByTokenHash, refreshSessionExpiry } from '@/server/dal/sessions';
import { logger } from '@/server/lib/logger';
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
    if (!token) {
      logger.debug({ source: 'session' }, 'No session token in cookie');
      return null;
    }

    const tokenHash = hashSessionToken(token);
    const session = await findSessionByTokenHash(tokenHash);
    if (!session) {
      logger.debug({ source: 'session' }, 'Session token not found in database');
      return null;
    }

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
        logger.error({ err: refreshError instanceof Error ? refreshError : new Error(String(refreshError)), source: 'session', errorType: 'refresh_failed' }, 'Session refresh failed');
      }
    }

    logger.debug(
      { source: 'session', userId: session.user_id, refreshed: refreshNeeded },
      'Session validated'
    );

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
    logger.error({ err: error instanceof Error ? error : new Error(String(error)), source: 'session', errorType: 'session_error' }, 'getSession error');
    return null;
  }
});
