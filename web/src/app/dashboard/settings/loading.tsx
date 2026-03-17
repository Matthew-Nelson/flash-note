export default function Loading() {
  return (
    <>
      {/* TopBar placeholder */}
      <div className="sticky top-0 z-20 flex items-center px-4 sm:px-6 py-4 border-b border-fn-border bg-fn-bg-card">
        <div className="h-7 w-40 rounded bg-fn-bg-secondary animate-pulse" />
      </div>

      <div className="flex-1 p-4 sm:p-6 animate-pulse" role="status" aria-label="Loading settings">
        <span className="sr-only">Loading settings</span>
        <div className="max-w-2xl space-y-6">
          {/* Account Information card */}
          <div className="card p-6">
            <div className="h-6 w-48 rounded bg-fn-bg-secondary mb-4" />
            <div className="space-y-4">
              <div>
                <div className="h-4 w-12 rounded bg-fn-bg-secondary mb-1" />
                <div className="h-5 w-56 rounded bg-fn-bg-secondary" />
              </div>
              <div>
                <div className="h-4 w-24 rounded bg-fn-bg-secondary mb-1" />
                <div className="h-5 w-20 rounded bg-fn-bg-secondary" />
              </div>
              <div>
                <div className="h-4 w-24 rounded bg-fn-bg-secondary mb-1" />
                <div className="h-5 w-16 rounded bg-fn-bg-secondary" />
              </div>
            </div>
          </div>

          {/* Change Password card */}
          <div className="card p-6">
            <div className="h-6 w-40 rounded bg-fn-bg-secondary mb-4" />
            <div className="h-4 w-72 rounded bg-fn-bg-secondary mb-4" />
            <div className="h-10 w-44 rounded bg-fn-bg-secondary" />
          </div>

          {/* Danger Zone card */}
          <div className="card p-6">
            <div className="h-6 w-28 rounded bg-fn-bg-secondary mb-4" />
            <div className="h-4 w-64 rounded bg-fn-bg-secondary mb-4" />
            <div className="h-10 w-36 rounded bg-fn-bg-secondary" />
          </div>
        </div>
      </div>
    </>
  );
}
