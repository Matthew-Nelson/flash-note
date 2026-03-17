import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getSession } from '@/server/lib/get-session';
import { getUsageForUser } from '@/server/dal/usage';
import type { SessionData } from '@/server/types';
import { SubscriptionBadge } from '@/components/ui';
import { TopBar } from '@/components/TopBar';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';
import { CheckoutSuccessAlert } from './CheckoutSuccessAlert';

/**
 * Format "YYYY-MM" into a human-readable month string.
 * Uses numeric Date constructor to avoid timezone parsing issues.
 */
function formatMonth(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  const date = new Date(Number(yearStr), Number(monthStr) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Calculate days remaining in a trial. Returns 0 if the trial has already ended.
 */
function getTrialDaysRemaining(trialEndsAt: Date): number {
  const now = new Date();
  const diffMs = trialEndsAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Banner shown above KPI cards for non-active subscription statuses.
 * Not rendered for 'active' status.
 */
function TrialBanner({ session }: { session: SessionData }) {
  const status = session.subscriptionStatus;

  if (status === 'active') return null;

  if (status === 'trialing') {
    const days = getTrialDaysRemaining(session.trialEndsAt);
    const message =
      days > 0
        ? `${days} day${days === 1 ? '' : 's'} remaining in your free trial. Upgrade to keep generating notes.`
        : 'Your trial has ended. Subscribe to continue.';
    return (
      <div
        className="rounded-fn-lg bg-fn-primary-light border border-fn-primary/20 px-5 py-3
                   flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        role="alert"
      >
        <p className="text-fn-sm text-fn-text-primary font-medium">{message}</p>
        <Link
          href="/pricing"
          className="btn-primary inline-flex items-center justify-center px-4 py-2 text-fn-sm whitespace-nowrap"
        >
          View Plans
        </Link>
      </div>
    );
  }

  if (status === 'past_due') {
    return (
      <div
        className="rounded-fn-lg bg-fn-warning-light border border-fn-warning/20 px-5 py-3
                   flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        role="alert"
      >
        <p className="text-fn-sm text-fn-text-primary font-medium">
          Your payment is past due. Please update your payment method.
        </p>
        <ManageSubscriptionButton label="Update payment" />
      </div>
    );
  }

  if (status === 'canceled') {
    return (
      <div
        className="rounded-fn-lg bg-fn-error-light border border-fn-error/20 px-5 py-3
                   flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        role="alert"
      >
        <p className="text-fn-sm text-fn-text-primary font-medium">
          Your subscription has been canceled.
        </p>
        <Link
          href="/pricing"
          className="btn-primary inline-flex items-center justify-center px-4 py-2 text-fn-sm whitespace-nowrap"
        >
          Subscribe Now
        </Link>
      </div>
    );
  }

  if (status === 'unpaid') {
    return (
      <div
        className="rounded-fn-lg bg-fn-error-light border border-fn-error/20 px-5 py-3
                   flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        role="alert"
      >
        <p className="text-fn-sm text-fn-text-primary font-medium">
          Your payment failed. Please update your payment method.
        </p>
        <ManageSubscriptionButton label="Update payment" />
      </div>
    );
  }

  // Default: expired / unknown status
  return (
    <div
      className="rounded-fn-lg bg-fn-error-light border border-fn-error/20 px-5 py-3
                 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      role="alert"
    >
      <p className="text-fn-sm text-fn-text-primary font-medium">
        Your trial has ended. Subscribe to continue.
      </p>
      <Link
        href="/pricing"
        className="btn-primary inline-flex items-center justify-center px-4 py-2 text-fn-sm whitespace-nowrap"
      >
        Subscribe Now
      </Link>
    </div>
  );
}

/**
 * Compact content for the Subscription KPI card.
 */
function SubscriptionKPIContent({ session }: { session: SessionData }) {
  const status = session.subscriptionStatus;

  if (status === 'trialing') {
    return <p className="text-fn-sm text-fn-text-secondary mt-1">Trial active</p>;
  }

  if (status === 'active') {
    return (
      <>
        <p className="text-fn-sm text-fn-text-secondary mt-1">Your subscription is active.</p>
        <div className="mt-3">
          <ManageSubscriptionButton />
        </div>
      </>
    );
  }

  if (status === 'past_due') {
    return (
      <>
        <p className="text-fn-sm text-fn-text-secondary mt-1">Payment past due</p>
        <div className="mt-3">
          <ManageSubscriptionButton label="Update payment" />
        </div>
      </>
    );
  }

  if (status === 'canceled') {
    return <p className="text-fn-sm text-fn-text-secondary mt-1">Subscription canceled</p>;
  }

  if (status === 'unpaid') {
    return (
      <>
        <p className="text-fn-sm text-fn-text-secondary mt-1">Payment failed</p>
        <div className="mt-3">
          <ManageSubscriptionButton label="Update payment" />
        </div>
      </>
    );
  }

  // Default: expired / unknown
  return <p className="text-fn-sm text-fn-text-secondary mt-1">Trial ended</p>;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login?reason=session_expired');

  const usage = await getUsageForUser(session.userId, session.organizationId);

  return (
    <>
      <TopBar title="Dashboard" />
      <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 space-y-6">
        {/* Checkout success alert — requires Suspense because it uses useSearchParams */}
        <Suspense fallback={null}>
          <CheckoutSuccessAlert />
        </Suspense>

        {/* Trial / subscription status banner (hidden for active subscribers) */}
        <TrialBanner session={session} />

        {/* KPI stats row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Notes This Month KPI */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-fn-base bg-fn-primary-light flex items-center justify-center">
                <svg
                  aria-hidden="true"
                  className="w-4 h-4 text-fn-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-fn-2xs font-semibold uppercase tracking-wider text-fn-text-secondary">
                Notes This Month
              </p>
            </div>
            <p className="text-3xl font-bold text-fn-text-primary">{usage.notesGenerated}</p>
            <p className="text-fn-sm text-fn-text-secondary mt-1">
              {formatMonth(usage.currentMonth)}
            </p>
            {usage.organization && (
              <p className="text-fn-sm text-fn-text-secondary mt-1">
                Organization: {usage.organization.name}
              </p>
            )}
          </div>

          {/* Subscription KPI */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-fn-base bg-fn-primary-light flex items-center justify-center">
                <svg
                  aria-hidden="true"
                  className="w-4 h-4 text-fn-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <p className="text-fn-2xs font-semibold uppercase tracking-wider text-fn-text-secondary">
                Subscription
              </p>
            </div>
            <SubscriptionBadge status={session.subscriptionStatus} />
            <SubscriptionKPIContent session={session} />
          </div>
        </div>

        {/* Shorthand CTA block */}
        <div className="card bg-fn-sidebar-bg p-6">
          <h2 className="text-fn-xl font-bold text-white tracking-fn-tight mb-2">
            Quick Shorthand
          </h2>
          <p className="text-fn-sm text-fn-sidebar-text mb-4">
            Enter your session notes here. Our AI transforms them into professional SOAP
            documentation in seconds.
          </p>
          {/* Decorative textarea preview — not interactive */}
          <div
            aria-hidden="true"
            className="w-full h-24 rounded-fn-md bg-white/10 border border-white/20 p-3 mb-4
                       text-fn-sm text-fn-sidebar-text/60 leading-relaxed"
          >
            pt c/o inc R knee pain x2 wks. ROM flex 95deg ext -5deg...
          </div>
          <Link
            href="/dashboard/notes/new"
            className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-3"
          >
            Generate Professional Note
          </Link>
        </div>

        {/* Quick action stub cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Add a Patient stub */}
          <div className="rounded-fn-lg bg-fn-bg-card border border-fn-border p-5 cursor-default">
            <div className="w-10 h-10 rounded-fn-base bg-fn-bg-secondary flex items-center justify-center mb-3">
              <svg
                aria-hidden="true"
                className="w-5 h-5 text-fn-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <h3 className="text-fn-base font-semibold text-fn-text-primary mb-1">Add a Patient</h3>
            <p className="text-fn-sm text-fn-text-secondary">Coming soon</p>
          </div>

          {/* Browse Templates stub */}
          <div className="rounded-fn-lg bg-fn-bg-card border border-fn-border p-5 cursor-default">
            <div className="w-10 h-10 rounded-fn-base bg-fn-bg-secondary flex items-center justify-center mb-3">
              <svg
                aria-hidden="true"
                className="w-5 h-5 text-fn-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </div>
            <h3 className="text-fn-base font-semibold text-fn-text-primary mb-1">
              Browse Templates
            </h3>
            <p className="text-fn-sm text-fn-text-secondary">Coming soon</p>
          </div>
        </div>
      </main>
    </>
  );
}
