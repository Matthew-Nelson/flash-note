'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function DashboardPage() {
  // Use lazy initializer to capture time once at mount (pure during re-renders)
  const [trialEndDate] = useState(() =>
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  );

  // TODO: Get actual user data
  const user = {
    email: 'user@example.com',
    subscriptionStatus: 'trialing',
    trialEndsAt: trialEndDate,
  };

  const usage = {
    notesGenerated: 42,
    month: 'January 2025',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-primary-600">
              FlashNote
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <button className="text-sm text-gray-600 hover:text-gray-900">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Usage Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Usage This Month
            </h2>
            <div className="text-4xl font-bold text-primary-600 mb-2">
              {usage.notesGenerated}
            </div>
            <p className="text-gray-600">SOAP notes generated in {usage.month}</p>
          </div>

          {/* Subscription Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Subscription
            </h2>
            {user.subscriptionStatus === 'trialing' ? (
              <>
                <div className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full mb-4">
                  Free Trial
                </div>
                <p className="text-gray-600 mb-4">
                  Your trial ends on{' '}
                  {new Date(user.trialEndsAt).toLocaleDateString()}
                </p>
                <Link
                  href="/pricing"
                  className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Upgrade Now
                </Link>
              </>
            ) : user.subscriptionStatus === 'active' ? (
              <>
                <div className="inline-block bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full mb-4">
                  Active
                </div>
                <p className="text-gray-600 mb-4">
                  Your subscription is active. Thank you for using FlashNote!
                </p>
                <button className="text-primary-600 hover:text-primary-700">
                  Manage subscription
                </button>
              </>
            ) : (
              <>
                <div className="inline-block bg-red-100 text-red-800 text-sm font-medium px-3 py-1 rounded-full mb-4">
                  Expired
                </div>
                <p className="text-gray-600 mb-4">
                  Your trial has ended. Subscribe to continue using FlashNote.
                </p>
                <Link
                  href="/pricing"
                  className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Subscribe Now
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Getting Started */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Getting Started
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-gray-600">
            <li>
              Install the FlashNote Chrome extension from the{' '}
              <a
                href="#"
                className="text-primary-600 hover:underline"
              >
                Chrome Web Store
              </a>
            </li>
            <li>Click the FlashNote icon in your browser toolbar</li>
            <li>Sign in with your account credentials</li>
            <li>Start generating SOAP notes!</li>
          </ol>
        </div>

        {/* Support */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Need Help?
          </h2>
          <p className="text-gray-600 mb-4">
            Our support team is here to help you get the most out of FlashNote.
          </p>
          <a
            href="mailto:support@flashnote.com"
            className="text-primary-600 hover:underline"
          >
            Contact Support
          </a>
        </div>
      </main>
    </div>
  );
}
