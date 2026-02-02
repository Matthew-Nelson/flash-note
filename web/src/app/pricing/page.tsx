'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api } from '@/lib/api';

// Stripe price IDs from environment
const STRIPE_PRICE_MONTHLY = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || '';
const STRIPE_PRICE_ANNUAL = process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL || '';

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

  // Check icon component
  const CheckIcon = ({ className }: { className: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary-600">
            FlashNote
          </Link>
          <div className="flex items-center space-x-6">
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Alerts */}
      {showCanceledAlert && (
        <div className="container mx-auto px-6 mt-4">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>Checkout was canceled. No charges were made.</span>
            <button
              onClick={() => setShowCanceledAlert(false)}
              className="text-yellow-800 hover:text-yellow-900"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="container mx-auto px-6 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-800 hover:text-red-900"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Pricing Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600">
            Start with a 14-day free trial. No credit card required.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Monthly Plan */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Monthly</h2>
            <p className="text-gray-600 mb-6">Pay month-to-month, cancel anytime</p>
            <div className="mb-6">
              <span className="text-5xl font-bold text-gray-900">$29</span>
              <span className="text-gray-500">/month</span>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-center">
                <CheckIcon className="w-5 h-5 text-green-500 mr-3" />
                Unlimited SOAP notes
              </li>
              <li className="flex items-center">
                <CheckIcon className="w-5 h-5 text-green-500 mr-3" />
                All note types (daily, eval, progress, discharge)
              </li>
              <li className="flex items-center">
                <CheckIcon className="w-5 h-5 text-green-500 mr-3" />
                Chrome extension
              </li>
              <li className="flex items-center">
                <CheckIcon className="w-5 h-5 text-green-500 mr-3" />
                HIPAA-compliant
              </li>
              <li className="flex items-center">
                <CheckIcon className="w-5 h-5 text-green-500 mr-3" />
                Email support
              </li>
            </ul>
            <button
              onClick={() => handleCheckout('monthly')}
              disabled={loadingPlan !== null || authLoading}
              className="block w-full py-3 text-center text-primary-600 border-2 border-primary-600 rounded-lg font-semibold hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingPlan === 'monthly' ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Redirecting to checkout...
                </span>
              ) : isAuthenticated ? (
                'Subscribe Now'
              ) : (
                'Start Free Trial'
              )}
            </button>
          </div>

          {/* Annual Plan */}
          <div className="bg-primary-600 text-white rounded-2xl p-8 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white text-sm font-semibold px-4 py-1 rounded-full">
              Save 17%
            </div>
            <h2 className="text-xl font-semibold mb-2">Annual</h2>
            <p className="text-primary-100 mb-6">Best value for committed users</p>
            <div className="mb-6">
              <span className="text-5xl font-bold">$24</span>
              <span className="text-primary-200">/month</span>
              <p className="text-primary-200 text-sm mt-1">Billed annually ($290/year)</p>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-center">
                <CheckIcon className="w-5 h-5 text-green-400 mr-3" />
                Everything in Monthly
              </li>
              <li className="flex items-center">
                <CheckIcon className="w-5 h-5 text-green-400 mr-3" />
                2 months free
              </li>
              <li className="flex items-center">
                <CheckIcon className="w-5 h-5 text-green-400 mr-3" />
                Priority support
              </li>
              <li className="flex items-center">
                <CheckIcon className="w-5 h-5 text-green-400 mr-3" />
                Early access to new features
              </li>
            </ul>
            <button
              onClick={() => handleCheckout('annual')}
              disabled={loadingPlan !== null || authLoading}
              className="block w-full py-3 text-center bg-white text-primary-600 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingPlan === 'annual' ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Redirecting to checkout...
                </span>
              ) : isAuthenticated ? (
                'Subscribe Now'
              ) : (
                'Start Free Trial'
              )}
            </button>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mt-20">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Is there a free trial?
              </h3>
              <p className="text-gray-600">
                Yes! Every new account gets a 14-day free trial with full access
                to all features. No credit card required to start.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Is FlashNote HIPAA compliant?
              </h3>
              <p className="text-gray-600">
                Yes. We use encrypted connections, don&apos;t store patient notes, and
                maintain audit logs. We can provide a BAA for your clinic.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-gray-600">
                Absolutely. Cancel your subscription at any time with no
                questions asked. You&apos;ll keep access until the end of your billing
                period.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Does it work with my EMR?
              </h3>
              <p className="text-gray-600">
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
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>}>
      <PricingContent />
    </Suspense>
  );
}
