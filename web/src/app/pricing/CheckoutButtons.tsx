'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Alert } from '@/components/ui';
import { createCheckoutAction } from '@/actions/billing';
import { isAllowedRedirectUrl } from '@/lib/utils/redirect-validation';

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

interface CheckoutButtonsProps {
  isAuthenticated: boolean;
  priceMonthly: string;
  priceAnnual: string;
}

/**
 * Client component for pricing page checkout interaction.
 *
 * Handles:
 * - ?canceled=true URL param (strips from URL, shows alert)
 * - Plan selection and checkout via createCheckoutAction
 * - Error display (Rule 2: error codes mapped to user messages)
 * - Redirect to Stripe checkout URL (validated via isAllowedRedirectUrl)
 */
export function CheckoutButtons({
  isAuthenticated,
  priceMonthly,
  priceAnnual,
}: CheckoutButtonsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCanceledAlert, setShowCanceledAlert] = useState(false);

  // Check for canceled checkout — reads URL param and clears it
  useEffect(() => {
    if (searchParams.get('canceled') === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing state from URL params + side effect (replaceState)
      setShowCanceledAlert(true);
      // Clear the query param from URL without navigation
      window.history.replaceState({}, '', '/pricing');
    }
  }, [searchParams]);

  const handleCheckout = async (plan: 'monthly' | 'annual') => {
    setError(null);

    // If not authenticated, redirect to signup
    if (!isAuthenticated) {
      router.push(`/signup?plan=${plan}`);
      return;
    }

    // Get the appropriate price ID
    const priceId = plan === 'monthly' ? priceMonthly : priceAnnual;
    if (!priceId) {
      setError('Pricing is not configured. Please contact support.');
      return;
    }

    setLoadingPlan(plan);

    const formData = new FormData();
    formData.set('priceId', priceId);

    const result = await createCheckoutAction(formData);

    if (!result.success) {
      // Rule 2: Map error codes to curated user messages
      switch (result.error) {
        case 'email_not_verified':
          setError(
            'Please verify your email before subscribing. Check your inbox for a verification link.'
          );
          break;
        case 'subscription_exists':
          setError(
            'You already have an active subscription. Manage your subscription from the dashboard.'
          );
          break;
        case 'invalid_price_id':
          setError('Pricing is not configured. Please contact support.');
          break;
        default:
          setError('Failed to start checkout. Please try again.');
      }
      setLoadingPlan(null);
      return;
    }

    const { checkoutUrl } = result.data;

    if (!isAllowedRedirectUrl(checkoutUrl)) {
      setError('Failed to start checkout. Please try again.');
      setLoadingPlan(null);
      return;
    }

    window.location.href = checkoutUrl;
    // Note: loading state is not reset after redirect — page navigates away.
  };

  const buttonLabel = (plan: 'monthly' | 'annual') => {
    if (loadingPlan === plan) return 'Redirecting to checkout...';
    return isAuthenticated ? 'Subscribe Now' : 'Start Free Trial';
  };

  return (
    <>
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

      {/* Pricing cards */}
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Monthly Plan */}
        <div className="card p-8 shadow-fn-base">
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
            disabled={loadingPlan !== null}
            loading={loadingPlan === 'monthly'}
            className="w-full"
          >
            {buttonLabel('monthly')}
          </Button>
        </div>

        {/* Annual Plan */}
        <div className="relative">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
            <span className="badge bg-fn-primary-light text-fn-primary px-4 py-1 text-sm font-semibold">Save 17%</span>
          </div>
          <div className="card p-8 border-2 border-fn-primary shadow-fn-base">
            <h2 className="text-xl font-semibold text-fn-text-primary mb-2">Annual</h2>
            <p className="text-fn-text-secondary mb-6">Best value for committed users</p>
            <div className="mb-6">
              <span className="text-5xl font-bold text-fn-primary">$24</span>
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
              disabled={loadingPlan !== null}
              loading={loadingPlan === 'annual'}
              className="w-full"
            >
              {buttonLabel('annual')}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
