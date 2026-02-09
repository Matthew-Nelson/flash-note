'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth, ApiError } from '@/lib/auth-context';
import { loginSchema } from '@/lib/schemas';
import { Button, Input, Alert } from '@/components/ui';
import { AuthLayout, SessionAlert } from '@/components/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, sessionEndReason, clearSessionEndReason } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    const result = loginSchema.safeParse({ email, password });
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
      const response = await login(email, password);

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
          case 'invalid_credentials':
            setErrors(['Invalid email or password']);
            break;
          case 'account_locked':
            setErrors(['Account temporarily locked. Please try again later.']);
            break;
          case 'email_not_verified':
            setErrors(['Please verify your email before signing in.']);
            break;
          default:
            setErrors([err.message || 'Failed to sign in']);
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
      title="Sign in to your account"
      footer={
        <p className="text-center text-sm">
          <Link href="/signup" className="link">
            Don&apos;t have an account? Sign up
          </Link>
        </p>
      }
    >
      {sessionEndReason && (
        <SessionAlert reason={sessionEndReason} onDismiss={clearSessionEndReason} />
      )}

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

        <div>
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={invalidFields.has('password')}
          />
          <div className="mt-1 text-right">
            <Link href="/forgot-password" className="text-sm link">
              Forgot password?
            </Link>
          </div>
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
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
