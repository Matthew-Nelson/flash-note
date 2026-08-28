'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui';

interface SearchNotesProps {
  initialQuery: string;
}

const DEBOUNCE_MS = 250;

/**
 * Debounced search input that drives the server-side notes list on
 * /dashboard/notes via the `?q=` query param. The server owns the results —
 * this component only mirrors input → URL.
 *
 * Focus-stability invariants are identical to `SearchPatients` (see that file
 * for the full rationale):
 *  1. `router.replace(..., { scroll: false })` so Next.js does not move focus
 *     to the `<main>` landmark on every keystroke.
 *  2. The replace runs inside `startTransition`, and the page scopes its data
 *     fetch to a component-level `<Suspense>`, so the route-level
 *     `loading.tsx` skeleton never unmounts this input.
 *  3. Controlled state is the source of truth while typing; we only re-sync
 *     from the URL when it changes from an EXTERNAL source (back button,
 *     navigation), detected by comparing against the last value we pushed.
 */
export function SearchNotes({ initialQuery }: SearchNotesProps): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);
  const [lastPushed, setLastPushed] = useState(initialQuery);
  const [, startTransition] = useTransition();

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
      setLastPushed(trimmed);
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams, startTransition],
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
        label="Search notes"
        name="q"
        type="search"
        value={query}
        onChange={handleChange}
        placeholder="Search your notes"
        aria-label="Search notes by content"
      />
    </div>
  );
}
