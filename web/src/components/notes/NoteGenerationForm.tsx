'use client';

import { useState, useEffect, useTransition } from 'react';
import { generateNoteAction } from '@/actions/notes';
import type { GenerateNoteResponse } from '@/actions/notes';
import { GeneratedNote } from './GeneratedNote';
import { Alert, Button } from '@/components/ui';
import type { NoteType } from '@/lib/types';

export const NOTE_ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: 'Please sign in to generate notes.',
  email_not_verified: 'Please verify your email before generating notes.',
  subscription_required: 'An active subscription is required to generate notes.',
  trial_expired: 'Your free trial has ended. Please subscribe to continue.',
  rate_limit_exceeded: 'Too many requests. Please wait a moment and try again.',
  validation_error: 'Please check your input and try again.',
  ai_rate_limited: 'The AI service is temporarily busy. Please try again in a moment.',
  ai_content_blocked: 'Unable to process this content. Please revise your notes and try again.',
  ai_timeout: 'Note generation timed out. Please try again.',
  ai_unavailable: 'The AI service is temporarily unavailable. Please try again later.',
  ai_error: 'Something went wrong generating your note. Please try again.',
  internal_error: 'Something went wrong. Please try again.',
};

const NOTE_ERROR_FALLBACK = 'Something went wrong. Please try again.';

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  daily_note: 'Daily Note',
  initial_eval: 'Initial Eval',
  progress_note: 'Progress Note',
  discharge: 'Discharge',
};

export function NoteGenerationForm() {
  const [noteType, setNoteType] = useState<NoteType>('daily_note');
  const [quickNotes, setQuickNotes] = useState('');
  const [patientContext, setPatientContext] = useState('');
  const [generatedNote, setGeneratedNote] = useState<GenerateNoteResponse | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [isPending, startTransition] = useTransition();

  // Rule 4: Clear all PHI state when logout is initiated
  useEffect(() => {
    function handleLogout() {
      setQuickNotes('');
      setPatientContext('');
      setGeneratedNote(null);
      setErrorCode(null);
      setFieldErrors(null);
    }
    window.addEventListener('flashnote:logout', handleLogout);
    return () => window.removeEventListener('flashnote:logout', handleLogout);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorCode(null);
    setFieldErrors(null);
    setGeneratedNote(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('noteType', noteType);
      formData.set('quickNotes', quickNotes.trim());
      if (patientContext.trim()) formData.set('patientContext', patientContext);
      const result = await generateNoteAction(formData);
      if (result.success) {
        setGeneratedNote(result.data);
      } else {
        setErrorCode(result.error);
        if (!result.success && result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      }
    });
  }

  function handleQuickNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setQuickNotes(e.target.value);
    setFieldErrors(null);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate>
        {/* Note Type */}
        <div className="mb-5">
          <label
            htmlFor="noteType"
            className="label block text-sm mb-1.5"
          >
            Note Type
          </label>
          <select
            id="noteType"
            name="noteType"
            value={noteType}
            onChange={(e) => {
              const value = e.target.value;
              if (value in NOTE_TYPE_LABELS) setNoteType(value as NoteType);
            }}
            className="input-field w-full px-3 py-2"
            disabled={isPending}
          >
            {(Object.keys(NOTE_TYPE_LABELS) as NoteType[]).map((type) => (
              <option key={type} value={type}>
                {NOTE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Notes */}
        <div className="mb-5">
          <label
            htmlFor="quickNotes"
            className="label block text-sm mb-1.5"
          >
            Quick Notes <span className="text-fn-error">*</span>
          </label>
          <textarea
            id="quickNotes"
            name="quickNotes"
            value={quickNotes}
            onChange={handleQuickNotesChange}
            required
            aria-required="true"
            aria-describedby={fieldErrors?.quickNotes ? 'quickNotes-error' : undefined}
            maxLength={5000}
            rows={6}
            placeholder="Pt reports decreased L knee pain 5/10, AROM flexion 95deg, performed manual therapy and therapeutic exercise..."
            className={`input-field w-full px-3 py-2 resize-y ${fieldErrors?.quickNotes ? 'input-field-error' : ''}`}
            disabled={isPending}
          />
          <div className="flex items-start justify-between mt-1">
            <div>
              {fieldErrors?.quickNotes && (
                <p id="quickNotes-error" className="text-fn-error text-sm">
                  {fieldErrors.quickNotes[0]}
                </p>
              )}
            </div>
            <p className="text-xs text-fn-text-secondary ml-4 shrink-0">
              {quickNotes.length}/5000
            </p>
          </div>
        </div>

        {/* Patient Context */}
        <div className="mb-6">
          <label
            htmlFor="patientContext"
            className="label block text-sm mb-1.5"
          >
            Patient Context{' '}
            <span className="text-fn-text-secondary text-xs">(optional)</span>
          </label>
          <input
            id="patientContext"
            name="patientContext"
            type="text"
            value={patientContext}
            onChange={(e) => setPatientContext(e.target.value)}
            maxLength={500}
            placeholder="e.g., 68yo female, post-op TKA 6 weeks"
            className="input-field w-full px-3 py-2"
            disabled={isPending}
          />
        </div>

        {/* Error display */}
        <div aria-live="assertive">
          {errorCode && (
            <Alert variant="error" className="mb-5">
              {NOTE_ERROR_MESSAGES[errorCode] ?? NOTE_ERROR_FALLBACK}
            </Alert>
          )}
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          loading={isPending}
          aria-busy={isPending}
          className="w-full"
        >
          {isPending ? 'Generating...' : 'Generate SOAP Note'}
        </Button>

        {/* Loading status */}
        <div aria-live="polite" className="mt-3 min-h-[1.25rem]">
          {isPending && (
            <p className="text-sm text-fn-text-secondary text-center">
              Generating your SOAP note... (this may take up to 30 seconds)
            </p>
          )}
        </div>
      </form>

      {generatedNote && <GeneratedNote note={generatedNote} />}
    </div>
  );
}
