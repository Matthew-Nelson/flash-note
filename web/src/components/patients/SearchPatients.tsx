'use client';

import { useEffect, useRef, useState } from 'react';
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
 */
export function SearchPatients({ initialQuery }: SearchPatientsProps): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state if the URL changes outside this input (e.g. clear search).
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    return (): void => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function pushParams(next: string): void {
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim()) params.set('q', next.trim());
    else params.delete('q');
    // Whenever search changes, reset pagination.
    params.delete('page');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

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
