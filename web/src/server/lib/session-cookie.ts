import 'server-only';

import crypto from 'node:crypto';

import { cookies } from 'next/headers';

import { isProduction, SESSION_COOKIE_MAX_AGE_SECONDS } from '@/server/db/config';

const SESSION_COOKIE_NAME = 'session_id';

/**
 * Set the session cookie with an opaque token.
 * Called after login/registration — only works in Server Actions and Route Handlers.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Read the raw session token from the cookie.
 * Returns null if the cookie doesn't exist.
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Clear the session cookie — called on logout.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Hash a session token with SHA-256 for database storage/lookup.
 * Deterministic — same input always produces the same hash.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
