'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { registerAction } from '@/actions/auth';
import { registerSchema } from '@/lib/schemas';
import { Button, Input, Alert } from '@/components/ui';
import { AuthLayout } from '@/components/auth';

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setInvalidFields(new Set());

    // Client-side validation
    const validation = registerSchema.safeParse({ email, password, confirmPassword, acceptedLegalTerms, inviteCode: inviteCode || undefined });
    if (!validation.success) {
      const messages: string[] = [];
      const invalid = new Set<string>();
      validation.error.errors.forEach((err) => {
        messages.push(err.message);
        if (err.path[0]) invalid.add(String(err.path[0]));
      });
      setErrors(messages);
      setInvalidFields(invalid);
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set('email', email);
      formData.set('password', password);
      formData.set('confirmPassword', confirmPassword);
      formData.set('acceptedLegalTerms', String(acceptedLegalTerms));
      if (inviteCode) formData.set('inviteCode', inviteCode);
      const result = await registerAction(formData);

      if (!result.success) {
        switch (result.error) {
          case 'registration_failed':
            setErrors(['Registration could not be completed. Please try again or sign in.']);
            break;
          case 'registration_closed':
            setErrors(['Registration is not available at this time.']);
            break;
          case 'invite_code_required':
            setErrors(['An invite code is required to register.']);
            setInvalidFields(new Set(['inviteCode']));
            break;
          case 'invalid_invite_code':
            setErrors(['This invite code is invalid or has expired.']);
            setInvalidFields(new Set(['inviteCode']));
            break;
          case 'no_seats_available':
            setErrors(['This clinic has no available seats. Contact your administrator.']);
            break;
          case 'rate_limit_exceeded':
            setErrors(['Too many attempts. Please try again later.']);
            break;
          default:
            setErrors(['Something went wrong. Please try again.']);
        }
        return;
      }

      // Registration always requires email verification for new users
      router.push('/check-email');
    } catch {
      setErrors(['An unexpected error occurred. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start your 14-day free trial"
      footer={
        <p className="text-center text-sm">
          <Link href="/login" className="link">
            Already have an account? Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={invalidFields.has('email')}
        />

        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={invalidFields.has('password')}
          hint="Min 8 characters, 1 uppercase, 1 lowercase, 1 number"
        />

        <Input
          label="Confirm Password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          invalid={invalidFields.has('confirmPassword')}
        />

        <Input
          label="Invite Code"
          name="inviteCode"
          type="text"
          autoComplete="off"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          invalid={invalidFields.has('inviteCode')}
          hint="Format: XXXX-XXXX"
        />

        <div>
          <label className="flex items-start gap-2 cursor-pointer py-2 min-h-[44px]">
            <input
              type="checkbox"
              checked={acceptedLegalTerms}
              onChange={(e) => setAcceptedLegalTerms(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-fn-border text-fn-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-fn-accent focus-visible:outline-offset-2"
            />
            <span className="text-sm text-fn-text-secondary">
              I agree to the{' '}
              <Link href="/baa" target="_blank" className="link">
                Business Associate Agreement
              </Link>
              ,{' '}
              <Link href="/terms" target="_blank" className="link">
                Terms of Service
              </Link>
              , and{' '}
              <Link href="/privacy" target="_blank" className="link">
                Privacy Policy
              </Link>
            </span>
          </label>
        </div>

        {errors.length > 0 && (
          <Alert variant="error">
            {errors.length === 1 ? (
              errors[0]
            ) : (
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        <Button
          type="submit"
          loading={isSubmitting}
          className="w-full"
        >
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
