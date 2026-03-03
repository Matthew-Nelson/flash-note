'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { loginAction } from '@/actions/auth';
import { loginSchema } from '@/lib/schemas';
import { Button, Input, Alert } from '@/components/ui';
import { AuthLayout, SessionAlert } from '@/components/auth';

function LoginContent() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setInvalidFields(new Set());

    // Client-side validation
    const validation = loginSchema.safeParse({ email, password });
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

    console.log('Login form submitted');
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set('email', email);
      formData.set('password', password);
      const result = await loginAction(formData);

      if (!result.success) {
        switch (result.error) {
          case 'invalid_credentials':
            setErrors(['Invalid email or password.']);
            break;
          case 'rate_limit_exceeded':
            setErrors(['Too many login attempts. Please try again later.']);
            break;
          default:
            setErrors(['Something went wrong. Please try again.']);
        }
        return;
      }

      // Check if email verification is required
      if (result.data && result.data.emailVerificationRequired) {
        router.push('/check-email');
        return;
      }

      router.push('/dashboard');
    } catch {
      setErrors(['An unexpected error occurred. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      <SessionAlert />

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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
