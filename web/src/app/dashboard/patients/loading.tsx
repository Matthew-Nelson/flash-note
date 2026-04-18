import { TopBar } from '@/components/TopBar';

/**
 * Streaming fallback for /dashboard/patients. Renders a static header and a
 * 5-row table skeleton with shimmer animation per 04-UI-SPEC §Loading state.
 */
export default function PatientsLoading(): React.ReactElement {
  return (
    <>
      <TopBar title="Patients" />
      <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-fn-2xl font-semibold tracking-fn-tight text-fn-text-primary">
            Patients
          </h1>
          <div
            className="h-11 w-32 rounded-fn-base bg-fn-slate-100 animate-fn-shimmer"
            aria-hidden="true"
          />
        </div>
        <div
          className="mb-4 h-11 max-w-md rounded-fn-base bg-fn-slate-100 animate-fn-shimmer"
          aria-hidden="true"
        />
        <div
          className="overflow-hidden rounded-fn-base border border-fn-border bg-white"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="sr-only">Loading patients…</div>
          <div className="h-10 bg-fn-slate-50 border-b border-fn-border" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-5 gap-3 px-3 py-3 border-b border-fn-border"
            >
              <div className="h-4 rounded bg-fn-slate-100 animate-fn-shimmer" />
              <div className="h-4 rounded bg-fn-slate-100 animate-fn-shimmer" />
              <div className="h-4 rounded bg-fn-slate-100 animate-fn-shimmer" />
              <div className="h-4 rounded bg-fn-slate-100 animate-fn-shimmer" />
              <div className="h-4 rounded bg-fn-slate-100 animate-fn-shimmer justify-self-end w-8" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
