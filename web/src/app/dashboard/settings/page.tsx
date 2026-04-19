import { redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { findTemplateWithUserStyle } from '@/server/dal';
import { Card, CardContent } from '@/components/ui';
import { PasswordResetSection } from '@/components/auth';
import { TopBar } from '@/components/TopBar';
import { DeleteAccountSection } from './DeleteAccountSection';
import { NoteStylePreferencesSection } from './NoteStylePreferencesSection';

/**
 * SOAP template UUID (seeded in migration 002). Exported for tests.
 */
export const SOAP_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login?reason=session_expired');

  // Plan 04-03 Task 4c: load the SOAP template with user style overlay applied
  // so the Note style preferences section renders the clinician's effective
  // verbosity/styling per section.
  const soapTemplate = await findTemplateWithUserStyle(
    SOAP_TEMPLATE_ID,
    session.userId,
  );

  return (
    <>
      <TopBar title="Account Settings" backHref="/dashboard" />
      <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6">
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
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
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

          {/* Note style preferences (Plan 04-03) */}
          {soapTemplate && (
            <NoteStylePreferencesSection sections={soapTemplate.sections} />
          )}

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
        </div>
      </main>
    </>
  );
}
