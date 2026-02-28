import Link from 'next/link';
import { Button } from '@/components/ui';
import { AuthLayout } from '@/components/auth';

export default function CheckEmailPage() {
  return (
    <AuthLayout
      title="Check your email"
      footer={
        <p className="text-center text-sm">
          <Link href="/login" className="link">
            Back to sign in
          </Link>
        </p>
      }
    >
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-fn-success-light">
          <svg className="h-6 w-6 text-fn-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="mt-4 text-fn-text-secondary">
          We&apos;ve sent a verification link to your email address. Click the link to verify your account.
        </p>
        <p className="mt-2 text-sm text-fn-text-muted">
          The link will expire in 24 hours.
        </p>
        <div className="mt-6">
          <Link href="/resend-verification">
            <Button variant="secondary" className="w-full">Didn&apos;t receive the email? Resend</Button>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
