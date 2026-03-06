import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-fn-bg-secondary flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-fn-text-primary mb-4">
          Page not found
        </h1>
        <p className="text-fn-text-secondary mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" className="link">
          Return to home
        </Link>
      </div>
    </main>
  );
}
