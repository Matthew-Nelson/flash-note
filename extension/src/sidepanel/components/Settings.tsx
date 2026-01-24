interface User {
  id: string;
  email: string;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
}

interface SettingsProps {
  user: User;
  onLogout: () => void;
}

export default function Settings({ user, onLogout }: SettingsProps) {
  const isTrialing = user.subscriptionStatus === 'trialing';
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
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
              user.subscriptionStatus === 'active'
                ? 'status-active'
                : isTrialing
                  ? 'status-trial'
                  : 'status-expired'
            }`}>
              {user.subscriptionStatus === 'active'
                ? 'Active'
                : isTrialing
                  ? `Trial (${daysLeft} days left)`
                  : user.subscriptionStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Subscription */}
      {isTrialing && (
        <div className="animate-fade-in-up stagger-2">
          <h2 className="text-sm font-semibold mb-3">Subscription</h2>
          <div className="trial-banner rounded-lg p-4">
            <p className="text-sm mb-3">
              {trialEndsAt
                ? `Your trial ends on ${trialEndsAt.toLocaleDateString()}. Subscribe to continue using FlashNote.`
                : 'Subscribe to continue using FlashNote.'}
            </p>
            <a
              href="https://flashnote.com/pricing"
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
        <div className="animate-fade-in-up stagger-2">
          <h2 className="text-sm font-semibold mb-3">Subscription</h2>
          <div className="card p-4">
            <a
              href="https://flashnote.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm"
            >
              Manage subscription
            </a>
          </div>
        </div>
      )}

      {/* Support */}
      <div className="animate-fade-in-up stagger-3">
        <h2 className="text-sm font-semibold mb-3">Support</h2>
        <div className="space-y-2">
          <a
            href="https://flashnote.com/help"
            target="_blank"
            rel="noopener noreferrer"
            className="link block text-sm"
          >
            Help Center
          </a>
          <a
            href="mailto:support@flashnote.com"
            className="link block text-sm"
          >
            Contact Support
          </a>
        </div>
      </div>

      {/* Logout */}
      <div className="pt-4 border-t animate-fade-in-up stagger-4">
        <button
          onClick={onLogout}
          className="w-full py-2 px-4 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Version */}
      <div className="text-center text-xs opacity-40 animate-fade-in stagger-5">
        FlashNote v0.1.0
      </div>
    </div>
  );
}
