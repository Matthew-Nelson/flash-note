import Link from 'next/link';
import { BetaBadge } from './BetaBadge';

interface MarketingNavProps {
  showDashboardLink?: boolean;
}

export function MarketingNav({ showDashboardLink = false }: MarketingNavProps) {
  return (
    <nav aria-label="Main" className="container mx-auto px-6 py-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-fn-primary">FlashNote</span>
          <BetaBadge />
        </Link>
        <div className="flex items-center space-x-6">
          <Link
            href="/pricing"
            className="text-fn-text-secondary hover:text-fn-text-primary transition-colors"
          >
            Pricing
          </Link>
          {showDashboardLink ? (
            <Link
              href="/dashboard"
              className="text-fn-text-secondary hover:text-fn-text-primary transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-fn-text-secondary hover:text-fn-text-primary transition-colors"
              >
                Sign In
              </Link>
              <Link href="/signup" className="btn-primary px-4 py-2">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
