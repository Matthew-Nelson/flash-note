import Link from 'next/link';
import { Suspense } from 'react';
import { getSession } from '@/server/lib/get-session';
import type { SessionData } from '@/server/types';
import { CheckoutButtons } from './CheckoutButtons';

// Stripe price IDs — NEXT_PUBLIC_ vars are inlined at build time by Next.js.
// These are passed as props to CheckoutButtons so it knows which price to submit.
const STRIPE_PRICE_MONTHLY = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? '';
const STRIPE_PRICE_ANNUAL = process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL ?? '';

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-fn-success flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PricingContent({
  session,
  priceMonthly,
  priceAnnual,
}: {
  session: SessionData | null;
  priceMonthly: string;
  priceAnnual: string;
}) {
  const isAuthenticated = session !== null;

  return (
    <div className="min-h-screen bg-fn-bg-primary">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-fn-primary">FlashNote</span>
            <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-fn-border text-fn-text-secondary">
              BETA
            </span>
          </Link>
          <div className="flex items-center space-x-6">
            {isAuthenticated ? (
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

      <main id="main-content" tabIndex={-1}>
        {/* Pricing Section */}
        <section className="container mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-fn-text-primary mb-4">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-fn-text-secondary">
              Start with a 14-day free trial. No credit card required.
            </p>
          </div>

          {/*
            CheckoutButtons handles:
            - ?canceled=true alert
            - error display
            - plan selection and checkout
            Wrapped in Suspense because it uses useSearchParams.
          */}
          <Suspense
            fallback={
              <div className="min-h-[600px] flex items-center justify-center">
                <div className="loading-spinner" />
              </div>
            }
          >
            <CheckoutButtons
              isAuthenticated={isAuthenticated}
              priceMonthly={priceMonthly}
              priceAnnual={priceAnnual}
            />
          </Suspense>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto mt-20">
            <h2 className="text-2xl font-bold text-center text-fn-text-primary mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-fn-text-primary mb-2">
                  Is there a free trial?
                </h3>
                <p className="text-fn-text-secondary">
                  Yes! Every new account gets a 14-day free trial with full access to all
                  features. No credit card required to start.
                </p>
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-fn-text-primary mb-2">
                  Is FlashNote HIPAA compliant?
                </h3>
                <p className="text-fn-text-secondary">
                  Yes. We use encrypted connections, don&apos;t store patient notes, and maintain
                  audit logs. We can provide a BAA for your clinic.
                </p>
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-fn-text-primary mb-2">
                  Can I cancel anytime?
                </h3>
                <p className="text-fn-text-secondary">
                  Absolutely. Cancel your subscription at any time with no questions asked.
                  You&apos;ll keep access until the end of your billing period.
                </p>
              </div>
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-fn-text-primary mb-2">
                  Does it work with my EMR?
                </h3>
                <p className="text-fn-text-secondary">
                  FlashNote works with any EMR. Simply copy the generated note and paste it
                  into your documentation system.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default async function PricingPage() {
  const session = await getSession();

  return (
    <PricingContent
      session={session}
      priceMonthly={STRIPE_PRICE_MONTHLY}
      priceAnnual={STRIPE_PRICE_ANNUAL}
    />
  );
}

// Re-export for testing
export { CheckIcon };
