import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { getUsageForUser } from '@/server/dal/usage';
import type { SessionData } from '@/server/types';
import { Card, CardContent, SubscriptionBadge } from '@/components/ui';

/**
 * Format "YYYY-MM" into a human-readable month string.
 * Uses numeric Date constructor to avoid timezone parsing issues.
 */
function formatMonth(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  const date = new Date(Number(yearStr), Number(monthStr) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function SubscriptionContent({ session }: { session: SessionData }) {
  const status = session.subscriptionStatus;

  if (status === 'trialing') {
    return (
      <>
        <p className="text-fn-text-secondary mb-4">
          Your trial ends on{' '}
          {session.trialEndsAt.toLocaleDateString()}
        </p>
        <Link href="/pricing" className="btn-primary px-4 py-2 text-base inline-flex items-center justify-center">
          Upgrade Now
        </Link>
      </>
    );
  }

  if (status === 'active') {
    return (
      <>
        <p className="text-fn-text-secondary mb-4">
          Your subscription is active. Thank you for using FlashNote!
        </p>
        <a href="mailto:support@flashnote.co" className="link text-sm">
          Manage subscription
        </a>
      </>
    );
  }

  if (status === 'past_due') {
    return (
      <>
        <p className="text-fn-text-secondary mb-4">
          Your payment is past due. Please update your payment method.
        </p>
        <a href="mailto:support@flashnote.co" className="link text-sm">
          Update payment method
        </a>
      </>
    );
  }

  if (status === 'canceled') {
    return (
      <>
        <p className="text-fn-text-secondary mb-4">
          Your subscription has been canceled. Subscribe again to continue using FlashNote.
        </p>
        <Link href="/pricing" className="btn-primary px-4 py-2 text-base inline-flex items-center justify-center">
          Subscribe Now
        </Link>
      </>
    );
  }

  if (status === 'unpaid') {
    return (
      <>
        <p className="text-fn-text-secondary mb-4">
          Your payment failed. Please update your payment method to restore access.
        </p>
        <a href="mailto:support@flashnote.co" className="link text-sm">
          Update payment method
        </a>
      </>
    );
  }

  // Default: expired / unknown status
  return (
    <>
      <p className="text-fn-text-secondary mb-4">
        Your trial has ended. Subscribe to continue using FlashNote.
      </p>
      <Link href="/pricing" className="btn-primary px-4 py-2 text-base inline-flex items-center justify-center">
        Subscribe Now
      </Link>
    </>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const usage = await getUsageForUser(session.userId, session.organizationId);

  return (
    <main id="main-content" tabIndex={-1} className="container mx-auto px-6 py-8">
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
            <p className="text-fn-text-secondary">
              SOAP notes generated in {formatMonth(usage.currentMonth)}
            </p>
            {usage.organization && (
              <p className="text-fn-text-secondary text-sm mt-2">
                Organization: {usage.organization.name}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Subscription Card */}
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold text-fn-text-primary mb-4">
              Subscription
            </h2>
            <div className="mb-4">
              <SubscriptionBadge status={session.subscriptionStatus} />
            </div>
            <SubscriptionContent session={session} />
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
            <li>Sign in to FlashNote</li>
            <li>Navigate to the note generation page</li>
            <li>Enter your quick notes and patient context</li>
            <li>Generate your SOAP note</li>
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
          <a href="mailto:support@flashnote.co" className="link">
            Contact Support
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
