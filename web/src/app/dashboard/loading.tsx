export default function Loading() {
  return (
    <div className="p-6 space-y-6 animate-pulse" role="status" aria-label="Loading dashboard">
      <span className="sr-only">Loading dashboard</span>
      {/* Banner skeleton */}
      <div className="h-14 rounded-fn-lg bg-fn-bg-secondary" />
      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-28 rounded-fn-lg bg-fn-bg-secondary" />
        <div className="h-28 rounded-fn-lg bg-fn-bg-secondary" />
      </div>
      {/* Shorthand CTA skeleton */}
      <div className="h-48 rounded-fn-lg bg-fn-bg-secondary" />
      {/* Quick actions skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-36 rounded-fn-lg bg-fn-bg-secondary" />
        <div className="h-36 rounded-fn-lg bg-fn-bg-secondary" />
      </div>
    </div>
  );
}
