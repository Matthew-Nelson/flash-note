'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type React from 'react';

/**
 * Clears PHI-bearing state when the user navigates away from a page or
 * logs out.
 *
 * React's useEffect cleanup is asynchronous and not guaranteed to run before
 * browser navigation (especially browser Back/Forward). Subscribing to
 * pathname changes gives us a synchronous cleanup trigger on every route
 * change.
 *
 * Also listens for the global `flashnote:logout` event (dispatched by
 * LogoutButton) so PHI is cleared on sign-out — CLAUDE.md Rule 4.
 *
 * The caller passes a `MutableRefObject<() => void>` so they can update
 * the cleanup function without re-subscribing this effect:
 *
 * Usage:
 *   const cleanupRef = useRef(() => {
 *     setGeneratedNote(null);
 *     setEditBuffer({});
 *     setPatientContext('');
 *     abortControllerRef.current?.abort();
 *   });
 *   usePhiCleanup(cleanupRef);
 */
export function usePhiCleanup(
  cleanup: React.MutableRefObject<() => void>
): void {
  const pathname = usePathname();
  const lastPathname = useRef(pathname);

  useEffect(() => {
    if (lastPathname.current !== pathname) {
      cleanup.current();
      lastPathname.current = pathname;
    }
  }, [pathname, cleanup]);

  useEffect(() => {
    const handler = (): void => cleanup.current();
    window.addEventListener('flashnote:logout', handler);
    return () => {
      window.removeEventListener('flashnote:logout', handler);
    };
  }, [cleanup]);
}
