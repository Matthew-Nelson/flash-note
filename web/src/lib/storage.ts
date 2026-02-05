/**
 * Session Storage Wrapper
 *
 * Handles authentication state persistence in sessionStorage.
 * Uses sessionStorage (not localStorage) for security - auth clears on tab close.
 *
 * SECURITY: PHI is never stored - only auth tokens and user metadata.
 */

import * as Sentry from '@sentry/nextjs';
import type { StoredAuth } from './types';

const AUTH_KEY = 'flashnote:auth';

/**
 * Get stored authentication data
 */
export function getAuth(): StoredAuth | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = sessionStorage.getItem(AUTH_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as StoredAuth;

    // Basic validation
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user) {
      return null;
    }

    return parsed;
  } catch {
    // Corrupted storage - clear it
    clearAuth();
    return null;
  }
}

/**
 * Store authentication data
 */
export function setAuth(auth: StoredAuth): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } catch (error) {
    // Capture to Sentry - helps diagnose "users getting logged out" complaints
    Sentry.captureException(error, {
      extra: {
        source: 'session_storage',
      },
    });
    // Storage full or quota exceeded - log but don't crash
    console.error('Failed to store auth:', error);
  }
}

/**
 * Clear authentication data
 */
export function clearAuth(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem(AUTH_KEY);
  } catch {
    // Ignore errors on clear
  }
}

/**
 * Storage utility object for compatibility with extension patterns
 */
export const storage = {
  getAuth,
  setAuth,
  clearAuth,
};
