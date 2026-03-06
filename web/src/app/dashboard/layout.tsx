import { redirect } from 'next/navigation';

import { getSession } from '@/server/lib/get-session';
import { DashboardShell } from '@/components/DashboardShell';

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
    <DashboardShell user={{ email: session.email }}>
      {children}
    </DashboardShell>
  );
}
