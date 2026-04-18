'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui';

interface SearchPatientsProps {
  initialQuery: string;
}

const DEBOUNCE_MS = 250;

/**
 * Debounced search input that drives the server-side list on
 * /dashboard/patients via the `?q=` query param. The server is the sole owner
 * of the results list — this component only mirrors input → URL.
 *
 * Focus-stability invariant: the controlled `query` state is the sole source
 * of truth while the user is actively typing. We do NOT sync from
 * `initialQuery` on every change — doing so would overwrite mid-type keystrokes
 * when the Server Component re-renders after our own `router.replace`, which
 * in React 19 concurrent mode can cause the input to lose focus. We only sync
 * from URL → state when the URL changes from an EXTERNAL source (navigation,
 * back button, etc.) by comparing against the last value we pushed ourselves.
 */
export function SearchPatients({ initialQuery }: SearchPatientsProps): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Two tracker states implement React's officially-sanctioned "adjust state
  // based on a prop change" pattern without useEffect or refs (both of which
  // trigger React 19 lint rules). See:
  //   https://react.dev/reference/react/useState#storing-information-from-previous-renders
  //
  // - `prevInitialQuery` — the most recent `initialQuery` we reconciled with.
  //   Used to detect that the prop has genuinely changed since last render.
  // - `lastPushed` — the last value this component pushed to the URL via
  //   `router.replace`. When the parent Server Component re-renders after
  //   our own URL push, `initialQuery` will equal `lastPushed` and we DO NOT
  //   re-sync — that preserves focus and any keystrokes typed between the
  //   debounce fire and the server re-render. External URL changes
  //   (navigation, back button, etc.) DO cause a sync because the echoed
  //   value won't match `lastPushed`.
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);
  const [lastPushed, setLastPushed] = useState(initialQuery);

  if (initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialQuery);
    if (initialQuery !== lastPushed) {
      setLastPushed(initialQuery);
      setQuery(initialQuery);
    }
  }

  useEffect(() => {
    return (): void => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const pushParams = useCallback(
    (next: string): void => {
      const trimmed = next.trim();
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
      // Whenever search changes, reset pagination.
      params.delete('page');
      const qs = params.toString();
      // Record that WE pushed this value so the "external change" sync-on-
      // render branch above won't fight us when the parent re-renders.
      setLastPushed(trimmed);
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const value = e.target.value;
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams(value);
    }, DEBOUNCE_MS);
  }

  return (
    <div className="mb-4 max-w-md">
      <Input
        label="Search patients"
        name="q"
        type="search"
        value={query}
        onChange={handleChange}
        placeholder="Search patients by name"
        aria-label="Search patients by name"
      />
    </div>
  );
}
