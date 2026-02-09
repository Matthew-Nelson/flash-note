'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth, ApiError } from '@/lib/auth-context';
import { registerSchema } from '@/lib/schemas';
import { Button, Input, Alert } from '@/components/ui';
import { AuthLayout } from '@/components/auth';

export default function SignupPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setInvalidFields(new Set());

    // Validate input
    const result = registerSchema.safeParse({ email, password, confirmPassword, acceptedLegalTerms });
    if (!result.success) {
      const messages: string[] = [];
      const invalid = new Set<string>();
      result.error.errors.forEach((err) => {
        messages.push(err.message);
        if (err.path[0]) invalid.add(String(err.path[0]));
      });
      setErrors(messages);
      setInvalidFields(invalid);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await register(email, password, acceptedLegalTerms);

      // Check if email verification is required
      if (response.emailVerificationRequired) {
        router.push('/verify-email');
        return;
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        // Handle specific error codes
        switch (err.code) {
          case 'email_exists':
            setErrors(['An account with this email already exists']);
            setInvalidFields(new Set(['email']));
            break;
          case 'weak_password':
            setErrors(['Password does not meet requirements']);
            setInvalidFields(new Set(['password']));
            break;
          default:
            setErrors([err.message || 'Failed to create account']);
        }
      } else {
        setErrors(['An unexpected error occurred. Please try again.']);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

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

        <div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedLegalTerms}
              onChange={(e) => setAcceptedLegalTerms(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-fn-border text-fn-accent focus:ring-fn-accent"
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
