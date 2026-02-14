import { useState, useEffect } from 'react';
import { storage } from '../../shared/storage';

interface User {
  id: string;
  email: string;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
}

interface SettingsProps {
  user: User;
  onLogout: () => void;
}

export default function Settings({ user, onLogout }: SettingsProps) {
  // Use lazy initializer to capture time once at mount (pure during re-renders)
  const [mountTime] = useState(() => Date.now());

  // Floating badge setting
  const [showFloatingBadge, setShowFloatingBadge] = useState(true);

  useEffect(() => {
    // Load the current setting
    storage
      .getPreferences()
      .then((prefs) => {
        setShowFloatingBadge(prefs.showFloatingBadge);
      })
      .catch((error) => {
        console.error('Failed to load preferences:', error);
        // Default is already true from initial state
      });
  }, []);

  const handleToggleFloatingBadge = async () => {
    const newValue = !showFloatingBadge;
    setShowFloatingBadge(newValue);
    try {
      await storage.setPreferences({ showFloatingBadge: newValue });
    } catch (error) {
      console.error('Failed to save preference:', error);
      setShowFloatingBadge(!newValue); // Revert UI on failure
    }
  };

  const isTrialing = user.subscriptionStatus === 'trialing';
  const isCancelling = user.subscriptionStatus === 'active' && user.cancelAtPeriodEnd === true;
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - mountTime) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="p-4 space-y-6">
      {/* Account Info */}
      <div className="animate-fade-in-up">
        <h2 className="text-sm font-semibold mb-3">Account</h2>
        <div className="card p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="opacity-60">Email</span>
            <span>{user.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-60">Status</span>
            <span className={`font-medium ${
              isCancelling
                ? 'status-expired'
                : user.subscriptionStatus === 'active'
                  ? 'status-active'
                  : isTrialing
                    ? 'status-trial'
                    : 'status-expired'
            }`}>
              {isCancelling
                ? `Cancels ${user.currentPeriodEnd ? new Date(user.currentPeriodEnd).toLocaleDateString() : 'at period end'}`
                : user.subscriptionStatus === 'active'
                  ? 'Active'
                  : isTrialing
                    ? `Trial (${daysLeft} days left)`
                    : user.subscriptionStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="animate-fade-in-up stagger-2">
        <h2 className="text-sm font-semibold mb-3">Preferences</h2>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Show floating badge</p>
              <p className="text-xs opacity-60 mt-0.5">
                Display FlashNote button on EMR pages
              </p>
            </div>
            <button
              onClick={handleToggleFloatingBadge}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                showFloatingBadge
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  : 'bg-stone-300'
              }`}
              role="switch"
              aria-checked={showFloatingBadge}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  showFloatingBadge ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Subscription */}
      {isTrialing && (
        <div className="animate-fade-in-up stagger-3">
          <h2 className="text-sm font-semibold mb-3">Subscription</h2>
          <div className="trial-banner rounded-lg p-4">
            <p className="text-sm mb-3">
              {trialEndsAt
                ? `Your trial ends on ${trialEndsAt.toLocaleDateString()}. Subscribe to continue using FlashNote.`
                : 'Subscribe to continue using FlashNote.'}
            </p>
            <a
              href="https://flashnote.co/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-block w-full text-center py-2 px-4 text-sm font-medium rounded-lg"
            >
              View Plans
            </a>
          </div>
        </div>
      )}

      {user.subscriptionStatus === 'active' && (
        <div className="animate-fade-in-up stagger-3">
          <h2 className="text-sm font-semibold mb-3">Subscription</h2>
          <div className="card p-4">
            {isCancelling && (
              <p className="text-sm opacity-60 mb-3">
                Your subscription is active until{' '}
                {user.currentPeriodEnd
                  ? new Date(user.currentPeriodEnd).toLocaleDateString()
                  : 'the end of your billing period'}
                . You won&apos;t be charged again.
              </p>
            )}
            <a
              href="https://flashnote.co/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm"
            >
              {isCancelling ? 'Resubscribe' : 'Manage subscription'}
            </a>
          </div>
        </div>
      )}

      {/* Support */}
      <div className="animate-fade-in-up stagger-4">
        <h2 className="text-sm font-semibold mb-3">Support</h2>
        <div className="space-y-2">
          <a
            href="https://flashnote.co/help"
            target="_blank"
            rel="noopener noreferrer"
            className="link block text-sm"
          >
            Help Center
          </a>
          <a
            href="mailto:support@flashnote.co"
            className="link block text-sm"
          >
            Contact Support
          </a>
        </div>
      </div>

      {/* Logout */}
      <div className="pt-4 border-t animate-fade-in-up stagger-5">
        <button
          onClick={onLogout}
          className="w-full py-2 px-4 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Version */}
      <div className="text-center text-xs opacity-40 animate-fade-in">
        FlashNote v0.1.0
      </div>
    </div>
  );
}
