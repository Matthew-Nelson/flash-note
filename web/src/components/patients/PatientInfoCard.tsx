'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, Card, CardContent, Input } from '@/components/ui';
import { updatePatientAction } from '@/actions/patients';
import type { Patient, Pronoun } from '@/lib/types';
import { mapPatientError } from './error-messages';

interface PatientInfoCardProps {
  patient: Patient;
}

/**
 * Read/edit patient info card on the detail page.
 *
 * - Read mode: renders key profile fields as read-only.
 * - Edit mode: renders Inputs for each field + Save/Cancel.
 * - Save invokes updatePatientAction. Errors surface as curated strings
 *   through mapPatientError (Rule 2).
 * - aria-live region unconditionally rendered (Rule 13) and announces
 *   "Saved." after a successful save.
 */
export function PatientInfoCard({ patient }: PatientInfoCardProps): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');

  const [firstName, setFirstName] = useState(patient.firstName);
  const [lastName, setLastName] = useState(patient.lastName);
  const [dob, setDob] = useState(
    patient.dateOfBirth instanceof Date
      ? patient.dateOfBirth.toISOString().slice(0, 10)
      : patient.dateOfBirth
        ? String(patient.dateOfBirth).slice(0, 10)
        : '',
  );
  const [pronoun, setPronoun] = useState<Pronoun | ''>(patient.pronoun ?? '');
  const [phone, setPhone] = useState(patient.phone ?? '');
  const [email, setEmail] = useState(patient.email ?? '');

  function resetToPatient(): void {
    setFirstName(patient.firstName);
    setLastName(patient.lastName);
    setDob(
      patient.dateOfBirth instanceof Date
        ? patient.dateOfBirth.toISOString().slice(0, 10)
        : patient.dateOfBirth
          ? String(patient.dateOfBirth).slice(0, 10)
          : '',
    );
    setPronoun(patient.pronoun ?? '');
    setPhone(patient.phone ?? '');
    setEmail(patient.email ?? '');
  }

  function handleCancel(): void {
    resetToPatient();
    setErrorCode(null);
    setEditing(false);
  }

  function handleSave(e: React.FormEvent): void {
    e.preventDefault();
    setErrorCode(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('firstName', firstName.trim());
      fd.set('lastName', lastName.trim());
      // Empty string is how the action's normalizer signals "no change / null"
      fd.set('dateOfBirth', dob.trim());
      fd.set('pronoun', pronoun);
      fd.set('phone', phone.trim());
      fd.set('email', email.trim());
      const res = await updatePatientAction(patient.id, fd);
      if (res.success) {
        setEditing(false);
        setAnnouncement('Saved.');
        // Clear announcement after a short time so the live region is ready
        // to pick up the next change.
        setTimeout(() => setAnnouncement(''), 1500);
        return;
      }
      setErrorCode(res.error);
    });
  }

  const dobDisplay = dob ? dob : '—';
  const pronounDisplay = pronoun || '—';
  const phoneDisplay = phone || '—';
  const emailDisplay = email || '—';

  return (
    <Card>
      <CardContent>
        {/* Unconditional aria-live region (Rule 13) */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>

        {errorCode && (
          <Alert variant="error" className="mb-4">
            {mapPatientError(errorCode)}
          </Alert>
        )}

        {!editing ? (
          <div className="space-y-3">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <dt className="text-fn-xs font-semibold text-fn-text-secondary uppercase tracking-fn-wider">
                  Date of birth
                </dt>
                <dd className="text-fn-base text-fn-text-primary">{dobDisplay}</dd>
              </div>
              <div>
                <dt className="text-fn-xs font-semibold text-fn-text-secondary uppercase tracking-fn-wider">
                  Pronoun
                </dt>
                <dd className="text-fn-base text-fn-text-primary">{pronounDisplay}</dd>
              </div>
              <div>
                <dt className="text-fn-xs font-semibold text-fn-text-secondary uppercase tracking-fn-wider">
                  Phone
                </dt>
                <dd className="text-fn-base text-fn-text-primary">{phoneDisplay}</dd>
              </div>
              <div>
                <dt className="text-fn-xs font-semibold text-fn-text-secondary uppercase tracking-fn-wider">
                  Email
                </dt>
                <dd className="text-fn-base text-fn-text-primary">{emailDisplay}</dd>
              </div>
            </dl>
            <div>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} noValidate className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First name *"
                name="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                aria-required="true"
                maxLength={100}
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
                disabled={isPending}
              />
              <Input
                label="Date of birth"
                name="dateOfBirth"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                disabled={isPending}
              />
              <div>
                <label
                  htmlFor={`pronoun-${patient.id}`}
                  className="label block text-fn-base font-semibold mb-1.5"
                >
                  Pronoun
                </label>
                <select
                  id={`pronoun-${patient.id}`}
                  name="pronoun"
                  value={pronoun}
                  onChange={(e) => setPronoun(e.target.value as Pronoun | '')}
                  className="input-field w-full px-3 py-2.5 min-h-[44px]"
                  disabled={isPending}
                >
                  <option value="">—</option>
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
                disabled={isPending}
              />
              <Input
                label="Email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                disabled={isPending}
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                type="button"
                onClick={handleCancel}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isPending}>
                Save
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
