import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { LogoutButton } from '@/components/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/login?reason=session_expired');
  }

  // Server-side enforcement: unverified email users cannot access dashboard (Rule 8)
  if (!session.emailVerified) {
    redirect('/resend-verification');
  }

  return (
    <div className="min-h-screen bg-fn-bg-secondary">
      <nav className="bg-fn-bg-primary border-b border-fn-border-color">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-fn-primary">FlashNote</span>
              <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-fn-border text-fn-text-secondary">BETA</span>
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-fn-text-secondary">{session.email}</span>
              <Link
                href="/dashboard/settings"
                className="text-fn-text-secondary hover:text-fn-text-primary transition-colors"
                title="Settings"
                aria-label="Go to settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
