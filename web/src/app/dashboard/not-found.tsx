import Link from 'next/link';

export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-bold text-fn-text-primary mb-4">
          Page not found
        </h1>
        <p className="text-fn-text-secondary mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/dashboard" className="link">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
