'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, SubscriptionBadge, Button } from '@/components/ui';

function DashboardContent() {
  const searchParams = useSearchParams();
  const { user, logout, refreshUser } = useAuth();

  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock usage data - in real app this would come from an API
  const usage = {
    notesGenerated: 42,
    month: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  };

  // Poll for subscription status update after checkout
  const pollForSubscription = useCallback(async () => {
    setIsPolling(true);
    let attempts = 0;
    const maxAttempts = 10; // Poll for up to ~30 seconds
    const interval = 3000; // 3 seconds between polls

    const poll = async (): Promise<boolean> => {
      attempts++;

      // Refresh user data from server (single call per poll)
      const refreshedData = await api.refreshUser();
      if (refreshedData?.user.subscriptionStatus === 'active') {
        // Update the auth context with fresh data
        await refreshUser();
        return true;
      }

      // Continue polling if not at max attempts
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
        return poll();
      }

      return false;
    };

    try {
      const success = await poll();
      if (success) {
        setShowSuccessAlert(true);
      }
    } catch {
      // Polling failed, but that's okay - user can refresh manually
    } finally {
      setIsPolling(false);
    }
  }, [refreshUser]);

  // Handle checkout success
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      // Clear the query params from URL without navigation
      window.history.replaceState({}, '', '/dashboard');

      // If user already has active subscription, show success immediately
      if (user?.subscriptionStatus === 'active') {
        setShowSuccessAlert(true);
      } else {
        // Otherwise poll for webhook to process
        pollForSubscription();
      }
    }
  }, [searchParams, user?.subscriptionStatus, pollForSubscription]);

  const handleLogout = async () => {
    await logout();
  };

  const handleManageSubscription = async () => {
    setError(null);
    setPortalLoading(true);

    try {
      const { portalUrl } = await api.createPortalSession();
      window.location.href = portalUrl;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to open billing portal. Please try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      setPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-fn-bg-secondary">
      {/* Navigation */}
      <nav className="bg-fn-bg-primary border-b border-fn-border-color">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gradient">FlashNote</span>
              <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-stone-400 text-stone-400">BETA</span>
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-fn-text-secondary">{user?.email}</span>
              <Link
                href="/dashboard/settings"
                className="text-fn-text-secondary hover:text-fn-text-primary transition-colors"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Alerts */}
      <div className="container mx-auto px-6">
        {showSuccessAlert && (
          <div className="mt-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Payment successful! Your subscription is now active.</span>
            </div>
            <button
              onClick={() => setShowSuccessAlert(false)}
              className="text-green-800 hover:text-green-900"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {isPolling && (
          <div className="mt-6 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Activating your subscription...</span>
          </div>
        )}

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
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
        )}
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-fn-text-primary mb-8">Dashboard</h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Usage Card */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-fn-text-primary mb-4">
                Usage This Month
              </h2>
              <div className="text-4xl font-bold text-gradient mb-2">
                {usage.notesGenerated}
              </div>
              <p className="text-fn-text-secondary">SOAP notes generated in {usage.month}</p>
            </CardContent>
          </Card>

          {/* Subscription Card */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-fn-text-primary mb-4">
                Subscription
              </h2>
              <div className="mb-4">
                <SubscriptionBadge status={user?.subscriptionStatus || 'trialing'} />
              </div>
              {user?.subscriptionStatus === 'trialing' && user?.trialEndsAt ? (
                <>
                  <p className="text-fn-text-secondary mb-4">
                    Your trial ends on{' '}
                    {new Date(user.trialEndsAt).toLocaleDateString()}
                  </p>
                  <Link href="/pricing">
                    <Button>Upgrade Now</Button>
                  </Link>
                </>
              ) : user?.subscriptionStatus === 'active' ? (
                <>
                  <p className="text-fn-text-secondary mb-4">
                    Your subscription is active. Thank you for using FlashNote!
                  </p>
                  <button
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    className="link text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {portalLoading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Opening billing portal...
                      </span>
                    ) : (
                      'Manage subscription'
                    )}
                  </button>
                </>
              ) : user?.subscriptionStatus === 'past_due' ? (
                <>
                  <p className="text-fn-text-secondary mb-4">
                    Your payment is past due. Please update your payment method.
                  </p>
                  <button
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    className="link text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {portalLoading ? 'Opening billing portal...' : 'Update payment method'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-fn-text-secondary mb-4">
                    Your trial has ended. Subscribe to continue using FlashNote.
                  </p>
                  <Link href="/pricing">
                    <Button>Subscribe Now</Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Getting Started */}
        <Card className="mt-8">
          <CardContent>
            <h2 className="text-lg font-semibold text-fn-text-primary mb-4">
              Getting Started
            </h2>
            <ol className="list-decimal list-inside space-y-3 text-fn-text-secondary">
              <li>
                Install the FlashNote Chrome extension from the{' '}
                <a href="#" className="link">
                  Chrome Web Store
                </a>
              </li>
              <li>Click the FlashNote icon in your browser toolbar</li>
              <li>Sign in with your account credentials</li>
              <li>Start generating SOAP notes!</li>
            </ol>
          </CardContent>
        </Card>

        {/* Support */}
        <Card className="mt-8">
          <CardContent>
            <h2 className="text-lg font-semibold text-fn-text-primary mb-4">
              Need Help?
            </h2>
            <p className="text-fn-text-secondary mb-4">
              Our support team is here to help you get the most out of FlashNote.
            </p>
            <a href="mailto:support@flashnote.com" className="link">
              Contact Support
            </a>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="min-h-screen bg-fn-bg-secondary flex items-center justify-center">
      <div className="text-fn-text-secondary">Loading...</div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<DashboardLoading />}>
        <DashboardContent />
      </Suspense>
    </ProtectedRoute>
  );
}
