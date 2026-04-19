/**
 * /dashboard/notes loading skeleton (Plan 04-03 / 04-UI-SPEC §Loading state).
 *
 * Header row + 5 ghost rows with shimmer animation. Shows while the
 * server-rendered page awaits the DAL query.
 */
export default function NotesLoading() {
  const ghostRows = Array.from({ length: 5 });

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-7 w-32 rounded-fn-sm bg-fn-bg-secondary animate-fn-shimmer" />
        <div className="h-9 w-28 rounded-fn-base bg-fn-bg-secondary animate-fn-shimmer" />
      </div>

      <div className="rounded-fn-base border border-fn-border overflow-hidden">
        <div className="bg-fn-bg-secondary h-10" aria-hidden="true" />
        <ul className="divide-y divide-fn-border">
          {ghostRows.map((_, idx) => (
            <li key={idx} className="px-4 py-4 grid grid-cols-5 gap-4 items-center">
              <div className="h-4 rounded-fn-sm bg-fn-bg-secondary animate-fn-shimmer" />
              <div className="h-4 rounded-fn-sm bg-fn-bg-secondary animate-fn-shimmer" />
              <div className="h-4 rounded-fn-sm bg-fn-bg-secondary animate-fn-shimmer" />
              <div className="h-4 rounded-fn-sm bg-fn-bg-secondary animate-fn-shimmer" />
              <div className="h-4 rounded-fn-sm bg-fn-bg-secondary animate-fn-shimmer" />
            </li>
          ))}
        </ul>
      </div>
      <p className="sr-only" aria-live="polite">
        Loading notes.
      </p>
    </main>
  );
}
