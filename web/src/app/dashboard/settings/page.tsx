'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth, ApiError } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, Button, Alert } from '@/components/ui';

function SettingsContent() {
  const { user, logout } = useAuth();

  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleRequestPasswordReset = async () => {
    if (!user?.email) return;

    setPasswordResetError(null);
    setPasswordResetLoading(true);

    try {
      await api.requestPasswordReset(user.email);
      setPasswordResetSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordResetError(err.message || 'Failed to send password reset email.');
      } else {
        setPasswordResetError('An unexpected error occurred.');
      }
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
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
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </nav>

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
                  <p className="text-fn-text-primary">{user?.email}</p>
                </div>
                <div>
                  <span className="block text-sm text-fn-text-secondary mb-1">Email Status</span>
                  <p className="text-fn-text-primary">
                    {user?.emailVerified ? (
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
                  <p className="text-fn-text-primary capitalize">{user?.subscriptionStatus || 'Unknown'}</p>
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

              {passwordResetSent ? (
                <Alert variant="success">
                  Password reset email sent! Check your inbox for the reset link.
                </Alert>
              ) : (
                <>
                  {passwordResetError && (
                    <Alert variant="error" className="mb-4" onDismiss={() => setPasswordResetError(null)}>
                      {passwordResetError}
                    </Alert>
                  )}
                  <Button
                    variant="secondary"
                    onClick={handleRequestPasswordReset}
                    loading={passwordResetLoading}
                    disabled={passwordResetLoading}
                  >
                    Send Password Reset Email
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-fn-error mb-4">
                Danger Zone
              </h2>

              {!showDeleteConfirm ? (
                <>
                  <p className="text-fn-text-secondary mb-4">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="border-fn-error text-fn-error hover:bg-fn-error-light"
                  >
                    Delete Account
                  </Button>
                </>
              ) : (
                <div className="bg-fn-error-light border border-fn-error rounded-fn-md p-4">
                  <p className="text-fn-error-dark font-semibold mb-2">
                    Are you sure you want to delete your account?
                  </p>
                  <p className="text-fn-text-secondary text-sm mb-4">
                    This action cannot be undone. All your data will be permanently deleted.
                    To delete your account, please contact us at{' '}
                    <a href="mailto:support@flashnote.co" className="link">
                      support@flashnote.co
                    </a>
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <a
                      href="mailto:support@flashnote.co?subject=Account%20Deletion%20Request"
                      className="btn-primary px-3 py-1.5 text-sm inline-flex items-center"
                    >
                      Contact Support
                    </a>
                  </div>
                </div>
              )}
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
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
