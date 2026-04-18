'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Input } from '@/components/ui';
import { createPatientAction } from '@/actions/patients';
import { createPatientSchema } from '@/lib/schemas/patients';
import { mapPatientError } from './error-messages';

/**
 * Client-side form for /dashboard/patients/new.
 *
 * - Client-side Zod validation for fast feedback (same schema as Server Action,
 *   so server remains the source of truth — Rule 3).
 * - Submits via Server Action, redirects to the new patient's detail page on
 *   success. On error, shows curated copy via mapPatientError (Rule 2).
 * - Never stores PHI beyond the in-memory form state; values are cleared on
 *   submit-success because the route changes.
 */
export function PatientCreateForm(): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [pronoun, setPronoun] = useState<'' | 'he/him' | 'she/her' | 'they/them' | 'other'>('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [context, setContext] = useState('');

  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    setErrorCode(null);
    setFieldErrors(null);

    // Client-side pre-validation — quick feedback. Server re-validates.
    const pre = createPatientSchema.safeParse({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: dateOfBirth.trim() || undefined,
      pronoun: pronoun || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      context: context.trim() || undefined,
    });
    if (!pre.success) {
      const flat = pre.error.flatten();
      setErrorCode('validation_error');
      setFieldErrors(flat.fieldErrors as Record<string, string[]>);
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set('firstName', firstName.trim());
      fd.set('lastName', lastName.trim());
      if (dateOfBirth.trim()) fd.set('dateOfBirth', dateOfBirth.trim());
      if (pronoun) fd.set('pronoun', pronoun);
      if (phone.trim()) fd.set('phone', phone.trim());
      if (email.trim()) fd.set('email', email.trim());
      if (context.trim()) fd.set('context', context.trim());
      const result = await createPatientAction(fd);
      if (result.success) {
        router.push(`/dashboard/patients/${result.data.id}`);
        return;
      }
      setErrorCode(result.error);
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-fn-content">
      {/* Unconditional aria-live region (Rule 13) */}
      <div aria-live="assertive" aria-atomic="true">
        {errorCode && (
          <Alert variant="error" className="mb-5">
            {mapPatientError(errorCode)}
          </Alert>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="First name *"
          name="firstName"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          aria-required="true"
          maxLength={100}
          error={fieldErrors?.firstName?.[0]}
          disabled={isPending}
        />
        <Input
          label="Last name *"
          name="lastName"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          aria-required="true"
          maxLength={100}
          error={fieldErrors?.lastName?.[0]}
          disabled={isPending}
        />
        <Input
          label="Date of birth"
          name="dateOfBirth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          error={fieldErrors?.dateOfBirth?.[0]}
          disabled={isPending}
        />
        <div>
          <label
            htmlFor="pronoun"
            className="label block text-fn-base font-semibold mb-1.5"
          >
            Pronoun
          </label>
          <select
            id="pronoun"
            name="pronoun"
            value={pronoun}
            onChange={(e) =>
              setPronoun(
                e.target.value as '' | 'he/him' | 'she/her' | 'they/them' | 'other',
              )
            }
            className="input-field w-full px-3 py-2.5 min-h-[44px]"
            disabled={isPending}
          >
            <option value="">Select…</option>
            <option value="he/him">he/him</option>
            <option value="she/her">she/her</option>
            <option value="they/them">they/them</option>
            <option value="other">other</option>
          </select>
        </div>
        <Input
          label="Phone"
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={32}
          error={fieldErrors?.phone?.[0]}
          disabled={isPending}
        />
        <Input
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={255}
          error={fieldErrors?.email?.[0]}
          disabled={isPending}
        />
      </div>

      <div className="mt-5">
        <label
          htmlFor="context"
          className="label block text-fn-base font-semibold mb-1.5"
        >
          Patient context
        </label>
        <textarea
          id="context"
          name="context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="Chronic L knee pain. Hx TKA 2024."
          className="input-field w-full px-3 py-2"
          disabled={isPending}
          aria-describedby="context-hint"
        />
        <p id="context-hint" className="mt-1.5 text-fn-xs text-fn-text-secondary">
          Optional. Injected into future notes generated for this patient.
        </p>
        {fieldErrors?.context && (
          <p role="alert" className="mt-1 text-fn-xs text-fn-error">
            Validation failed
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <Link href="/dashboard/patients">
          <Button variant="secondary" type="button" disabled={isPending}>
            Cancel
          </Button>
        </Link>
        <Button type="submit" variant="primary" loading={isPending}>
          Save patient
        </Button>
      </div>
    </form>
  );
}
