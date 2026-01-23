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
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Account</h2>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-900">{user.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Status</span>
            <span className={`font-medium ${
              user.subscriptionStatus === 'active'
                ? 'text-green-600'
                : isTrialing
                  ? 'text-blue-600'
                  : 'text-red-600'
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
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Subscription</h2>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-800 mb-3">
              {trialEndsAt
                ? `Your trial ends on ${trialEndsAt.toLocaleDateString()}. Subscribe to continue using FlashNote.`
                : 'Subscribe to continue using FlashNote.'}
            </p>
            <a
              href="https://flashnote.com/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full text-center py-2 px-4 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700"
            >
              View Plans
            </a>
          </div>
        </div>
      )}

      {user.subscriptionStatus === 'active' && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Subscription</h2>
          <div className="bg-gray-50 rounded-lg p-4">
            <a
              href="https://flashnote.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Manage subscription
            </a>
          </div>
        </div>
      )}

      {/* Support */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Support</h2>
        <div className="space-y-2">
          <a
            href="https://flashnote.com/help"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-gray-600 hover:text-gray-900"
          >
            Help Center
          </a>
          <a
            href="mailto:support@flashnote.com"
            className="block text-sm text-gray-600 hover:text-gray-900"
          >
            Contact Support
          </a>
        </div>
      </div>

      {/* Logout */}
      <div className="pt-4 border-t">
        <button
          onClick={onLogout}
          className="w-full py-2 px-4 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md"
        >
          Sign Out
        </button>
      </div>

      {/* Version */}
      <div className="text-center text-xs text-gray-400">
        FlashNote v0.1.0
      </div>
    </div>
  );
}
