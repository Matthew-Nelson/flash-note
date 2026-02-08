'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Button, Alert } from '@/components/ui';

// Stripe price IDs from environment
const STRIPE_PRICE_MONTHLY = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || '';
const STRIPE_PRICE_ANNUAL = process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL || '';

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-fn-success flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCanceledAlert, setShowCanceledAlert] = useState(false);

  // Check for canceled checkout
  useEffect(() => {
    if (searchParams.get('canceled') === 'true') {
      setShowCanceledAlert(true);
      // Clear the query param from URL without navigation
      window.history.replaceState({}, '', '/pricing');
    }
  }, [searchParams]);

  const handleCheckout = async (plan: 'monthly' | 'annual') => {
    setError(null);

    // If not authenticated, redirect to signup with plan param
    if (!isAuthenticated) {
      router.push(`/signup?plan=${plan}`);
      return;
    }

    // Check if user is already subscribed
    if (user?.subscriptionStatus === 'active') {
      setError('You already have an active subscription. Manage your subscription from the dashboard.');
      return;
    }

    // Check if user needs to verify email first
    if (user && !user.emailVerified) {
      setError('Please verify your email before subscribing. Check your inbox for a verification link.');
      return;
    }

    // Get the appropriate price ID
    const priceId = plan === 'monthly' ? STRIPE_PRICE_MONTHLY : STRIPE_PRICE_ANNUAL;

    if (!priceId) {
      setError('Pricing is not configured. Please contact support.');
      return;
    }

    setLoadingPlan(plan);

    try {
      const { checkoutUrl } = await api.createCheckoutSession(priceId);
      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
    } catch (err) {
      // Capture to Sentry - revenue-impacting checkout failures
      Sentry.captureException(err, {
        extra: {
          source: 'pricing_page',
          errorType: 'checkout_failed',
          plan,
        },
      });
      if (err instanceof ApiError) {
        if (err.code === 'email_not_verified') {
          setError('Please verify your email before subscribing. Check your inbox for a verification link.');
        } else {
          setError(err.message || 'Failed to start checkout. Please try again.');
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-fn-bg-primary">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gradient">FlashNote</span>
            <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-stone-400 text-stone-400">BETA</span>
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
                <Link
                  href="/signup"
                  className="btn-primary px-4 py-2"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Alerts */}
      <div className="container mx-auto px-6">
        {showCanceledAlert && (
          <div className="mt-4">
            <Alert variant="warning" onDismiss={() => setShowCanceledAlert(false)}>
              Checkout was canceled. No charges were made.
            </Alert>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}
      </div>

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

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Monthly Plan */}
          <div className="card p-8">
            <h2 className="text-xl font-semibold text-fn-text-primary mb-2">Monthly</h2>
            <p className="text-fn-text-secondary mb-6">Pay month-to-month, cancel anytime</p>
            <div className="mb-6">
              <span className="text-5xl font-bold text-fn-text-primary">$29</span>
              <span className="text-fn-text-muted">/month</span>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3 text-fn-text-secondary">
                <CheckIcon />
                Unlimited SOAP notes
              </li>
              <li className="flex items-center gap-3 text-fn-text-secondary">
                <CheckIcon />
                All note types (daily, eval, progress, discharge)
              </li>
              <li className="flex items-center gap-3 text-fn-text-secondary">
                <CheckIcon />
                Chrome extension
              </li>
              <li className="flex items-center gap-3 text-fn-text-secondary">
                <CheckIcon />
                HIPAA-compliant
              </li>
              <li className="flex items-center gap-3 text-fn-text-secondary">
                <CheckIcon />
                Email support
              </li>
            </ul>
            <Button
              variant="secondary"
              onClick={() => handleCheckout('monthly')}
              disabled={loadingPlan !== null || authLoading}
              loading={loadingPlan === 'monthly'}
              className="w-full"
            >
              {loadingPlan === 'monthly'
                ? 'Redirecting to checkout...'
                : isAuthenticated
                  ? 'Subscribe Now'
                  : 'Start Free Trial'}
            </Button>
          </div>

          {/* Annual Plan */}
          <div className="relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
              <span className="badge badge-active px-4 py-1 text-sm font-semibold">
                Save 17%
              </span>
            </div>
            <div className="card p-8 border-2 border-fn-accent-secondary">
              <h2 className="text-xl font-semibold text-fn-text-primary mb-2">Annual</h2>
              <p className="text-fn-text-secondary mb-6">Best value for committed users</p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gradient">$24</span>
                <span className="text-fn-text-muted">/month</span>
                <p className="text-fn-text-muted text-sm mt-1">Billed annually ($290/year)</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-fn-text-secondary">
                  <CheckIcon />
                  Everything in Monthly
                </li>
                <li className="flex items-center gap-3 text-fn-text-secondary">
                  <CheckIcon />
                  2 months free
                </li>
                <li className="flex items-center gap-3 text-fn-text-secondary">
                  <CheckIcon />
                  Priority support
                </li>
                <li className="flex items-center gap-3 text-fn-text-secondary">
                  <CheckIcon />
                  Early access to new features
                </li>
              </ul>
              <Button
                variant="primary"
                onClick={() => handleCheckout('annual')}
                disabled={loadingPlan !== null || authLoading}
                loading={loadingPlan === 'annual'}
                className="w-full"
              >
                {loadingPlan === 'annual'
                  ? 'Redirecting to checkout...'
                  : isAuthenticated
                    ? 'Subscribe Now'
                    : 'Start Free Trial'}
              </Button>
            </div>
          </div>
        </div>

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
                Yes! Every new account gets a 14-day free trial with full access
                to all features. No credit card required to start.
              </p>
            </div>
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-fn-text-primary mb-2">
                Is FlashNote HIPAA compliant?
              </h3>
              <p className="text-fn-text-secondary">
                Yes. We use encrypted connections, don&apos;t store patient notes, and
                maintain audit logs. We can provide a BAA for your clinic.
              </p>
            </div>
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-fn-text-primary mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-fn-text-secondary">
                Absolutely. Cancel your subscription at any time with no
                questions asked. You&apos;ll keep access until the end of your billing
                period.
              </p>
            </div>
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-fn-text-primary mb-2">
                Does it work with my EMR?
              </h3>
              <p className="text-fn-text-secondary">
                FlashNote works with any EMR. Simply copy the generated note and
                paste it into your documentation system.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-fn-bg-primary flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    }>
      <PricingContent />
    </Suspense>
  );
}
