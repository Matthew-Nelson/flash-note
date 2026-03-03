import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { Card, CardContent } from '@/components/ui';
import { PasswordResetSection } from '@/components/auth';
import { DeleteAccountSection } from './DeleteAccountSection';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login?reason=session_expired');

  return (
    <>
      {/* Breadcrumb */}
      <div className="container mx-auto px-6 py-4">
        <nav className="text-sm text-fn-text-secondary">
          <Link href="/dashboard" className="link">Dashboard</Link>
          <span className="mx-2">/</span>
          <span className="text-fn-text-primary">Settings</span>
        </nav>
      </div>

      {/* Main Content */}
      <main id="main-content" tabIndex={-1} className="container mx-auto px-6 pb-8">
        <h1 className="text-2xl font-bold text-fn-text-primary mb-8">Account Settings</h1>

        <div className="max-w-2xl space-y-6">
          {/* Account Information */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-fn-text-primary mb-4">
                Account Information
              </h2>
              <div className="space-y-4">
                <div>
                  <span className="block text-sm text-fn-text-secondary mb-1">Email</span>
                  <p className="text-fn-text-primary">{session.email}</p>
                </div>
                <div>
                  <span className="block text-sm text-fn-text-secondary mb-1">Email Status</span>
                  <p className="text-fn-text-primary">
                    {session.emailVerified ? (
                      <span className="inline-flex items-center gap-1 text-fn-success">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </span>
                    ) : (
                      <span className="text-fn-warning">Not verified</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="block text-sm text-fn-text-secondary mb-1">Subscription</span>
                  <p className="text-fn-text-primary capitalize">{session.subscriptionStatus}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-fn-text-primary mb-4">
                Change Password
              </h2>
              <p className="text-fn-text-secondary mb-4">
                To change your password, we&apos;ll send a password reset link to your email address.
              </p>
              <PasswordResetSection email={session.email} />
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-fn-error mb-4">
                Danger Zone
              </h2>
              <DeleteAccountSection />
            </CardContent>
          </Card>

          {/* Back to Dashboard */}
          <div className="pt-4">
            <Link href="/dashboard" className="link text-sm">
              &larr; Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
