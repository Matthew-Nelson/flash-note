'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { Patient } from '@/lib/types';

interface PatientTypeaheadProps {
  selectedPatient: Patient | null;
  onSelect: (patient: Patient | null) => void;
  /**
   * Injected search function. Must respect `signal` for cancellation. Returning
   * a list longer than 10 is allowed — the UI clamps.
   */
  fetchPatients: (query: string, signal: AbortSignal) => Promise<Patient[]>;
  placeholder?: string;
  /** Show a visible helper hint beneath the input. Defaults to UI-SPEC copy. */
  helperText?: string;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;
const MAX_RESULTS = 10;

/**
 * WAI-ARIA 1.2 combobox for patient selection.
 *
 * Contract (locked in 04-UI-SPEC §Patient typeahead):
 *  - 250ms debounce on input change, AbortController per keystroke
 *  - Min 2 chars before firing search
 *  - Max 10 visible options; server may return more but UI clamps
 *  - Keyboard: ArrowDown/ArrowUp/Enter/Escape/Home/End
 *  - Selection collapses listbox, replaces input value with "{first} {last}",
 *    and renders a Clear (X) button on the right
 *  - Visually hidden aria-live region announces "{N} patients found"
 *  - M-7: listbox options, Clear button, and arrow button all expose 44px
 *    hit areas
 */
export function PatientTypeahead({
  selectedPatient,
  onSelect,
  fetchPatients,
  placeholder = 'Search patients by name',
  helperText = 'Start typing to search. Use ↑↓ to navigate and Enter to select.',
}: PatientTypeaheadProps): React.ReactElement {
  const inputId = useId();
  const listboxId = useId();
  const helperId = useId();
  const liveRegionId = useId();

  const [rawQuery, setRawQuery] = useState<string>('');
  const [results, setResults] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  // When a patient is selected, show their full name in the input regardless
  // of rawQuery. rawQuery only drives the visible input when NOT selected.
  const query = selectedPatient
    ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
    : rawQuery;

  const setQuery = setRawQuery;

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const visibleResults = results.slice(0, MAX_RESULTS);

  // Clean up any in-flight debounce / fetch on unmount.
  useEffect(() => {
    return (): void => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const runSearch = useCallback(
    (q: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      fetchPatients(q, controller.signal)
        .then((patients) => {
          if (controller.signal.aborted) return;
          setResults(patients);
          setOpen(true);
          setActiveIdx(patients.length > 0 ? 0 : -1);
          const n = Math.min(patients.length, MAX_RESULTS);
          if (n === 0) setAnnouncement(`No patients match "${q}"`);
          else setAnnouncement(`${n} patient${n === 1 ? '' : 's'} found`);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            // Silent — UI shows empty list; no err.message leak per Rule 2.
            setResults([]);
            setOpen(true);
            setAnnouncement('No patients found');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    },
    [fetchPatients],
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const value = e.target.value;
    setQuery(value);
    // If user edits while a patient is selected, un-select.
    if (selectedPatient) onSelect(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (value.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setAnnouncement('');
      return;
    }

    debounceRef.current = setTimeout(() => {
      runSearch(value.trim());
    }, DEBOUNCE_MS);
  }

  function handleSelect(patient: Patient): void {
    onSelect(patient);
    setQuery(`${patient.firstName} ${patient.lastName}`);
    setOpen(false);
    setActiveIdx(-1);
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  function handleClear(): void {
    onSelect(null);
    setQuery('');
    setResults([]);
    setOpen(false);
    setActiveIdx(-1);
    setAnnouncement('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && visibleResults.length > 0) {
        setOpen(true);
        setActiveIdx(0);
        return;
      }
      if (visibleResults.length === 0) return;
      setActiveIdx((idx) => (idx + 1) % visibleResults.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open && visibleResults.length > 0) {
        setOpen(true);
        setActiveIdx(visibleResults.length - 1);
        return;
      }
      if (visibleResults.length === 0) return;
      setActiveIdx((idx) =>
        idx <= 0 ? visibleResults.length - 1 : idx - 1,
      );
      return;
    }
    if (e.key === 'Enter') {
      if (open && activeIdx >= 0 && activeIdx < visibleResults.length) {
        e.preventDefault();
        handleSelect(visibleResults[activeIdx]);
      }
      return;
    }
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActiveIdx(-1);
      }
      return;
    }
    if (e.key === 'Home') {
      if (open && visibleResults.length > 0) {
        e.preventDefault();
        setActiveIdx(0);
      }
      return;
    }
    if (e.key === 'End') {
      if (open && visibleResults.length > 0) {
        e.preventDefault();
        setActiveIdx(visibleResults.length - 1);
      }
      return;
    }
  }

  const activeOptionId =
    open && activeIdx >= 0 && activeIdx < visibleResults.length
      ? `${listboxId}-opt-${activeIdx}`
      : undefined;

  return (
    <div className="relative w-full">
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-activedescendant={activeOptionId}
            aria-describedby={helperId}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (visibleResults.length > 0) setOpen(true);
            }}
            placeholder={placeholder}
            className="input-field w-full px-3 py-2.5 pr-10 text-fn-base min-h-[44px]"
          />
          {selectedPatient && (
            <button
              type="button"
              aria-label="Clear selected patient"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-fn-text-secondary hover:text-fn-text-primary cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Show patient suggestions"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => {
            if (visibleResults.length === 0) return;
            setOpen((v) => !v);
          }}
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-fn-base border border-fn-border text-fn-text-secondary hover:bg-fn-slate-50 cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      <p id={helperId} className="mt-1.5 text-fn-xs text-fn-text-secondary">
        {helperText}
      </p>

      {/* Unconditional aria-live region (Rule 13) */}
      <span id={liveRegionId} aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? 'Searching...' : announcement}
      </span>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Patient suggestions"
          className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto rounded-fn-base bg-white border border-fn-border shadow-lg"
        >
          {visibleResults.length === 0 && !loading && (
            <li
              role="option"
              aria-selected="false"
              aria-disabled="true"
              className="px-3 py-2 text-fn-base text-fn-text-secondary min-h-[44px] flex items-center"
            >
              No patients match &quot;{query}&quot;
            </li>
          )}
          {visibleResults.map((patient, idx) => (
            <li
              key={patient.id}
              id={`${listboxId}-opt-${idx}`}
              role="option"
              aria-selected={idx === activeIdx}
              onMouseDown={(e) => {
                // Prevent input blur before click handler runs.
                e.preventDefault();
                handleSelect(patient);
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={`px-3 py-2 text-fn-base cursor-pointer min-h-[44px] flex items-center ${
                idx === activeIdx ? 'bg-fn-slate-50' : ''
              }`}
            >
              {patient.firstName} {patient.lastName}
            </li>
          ))}
          {results.length > MAX_RESULTS && (
            <li
              role="option"
              aria-selected="false"
              aria-disabled="true"
              className="px-3 py-2 text-fn-xs text-fn-text-secondary min-h-[44px] flex items-center border-t border-fn-border"
            >
              Showing first {MAX_RESULTS} — refine your search to see more.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
