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
  // Tracks the last value we pushed to the URL. If `initialQuery` matches,
  // the URL change originated from this component and we do not re-sync state
  // (preserving focus + any keystrokes typed between debounce fire and
  // server re-render).
  const lastPushedRef = useRef<string>(initialQuery);

  useEffect(() => {
    // Only pull URL → state when the URL changed from an EXTERNAL source.
    if (initialQuery !== lastPushedRef.current) {
      setQuery(initialQuery);
      lastPushedRef.current = initialQuery;
    }
  }, [initialQuery]);

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
      lastPushedRef.current = trimmed;
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
