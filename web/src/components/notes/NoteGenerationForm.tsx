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

/** Step indicator rendered above the form */
function StepIndicator({ activeStep }: { activeStep: 1 | 2 }) {
  return (
    <nav aria-label="Form steps" className="flex items-center gap-2 mb-6">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
            activeStep === 1
              ? 'bg-fn-primary text-white'
              : 'bg-fn-success text-white'
          }`}
          aria-current={activeStep === 1 ? 'step' : undefined}
        >
          {activeStep === 1 ? '1' : '✓'}
        </span>
        <span
          className={`text-fn-sm font-medium ${
            activeStep === 1 ? 'text-fn-text-primary' : 'text-fn-text-secondary'
          }`}
        >
          Enter Notes
        </span>
      </div>
      <div className="flex-1 h-px bg-fn-border mx-1" aria-hidden="true" />
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
            activeStep === 2
              ? 'bg-fn-primary text-white'
              : 'bg-fn-bg-secondary text-fn-text-secondary border border-fn-border'
          }`}
          aria-current={activeStep === 2 ? 'step' : undefined}
        >
          2
        </span>
        <span
          className={`text-fn-sm font-medium ${
            activeStep === 2 ? 'text-fn-text-primary' : 'text-fn-text-secondary'
          }`}
        >
          Review &amp; Copy
        </span>
      </div>
    </nav>
  );
}

export function NoteGenerationForm() {
  const [noteType, setNoteType] = useState<NoteType>('daily_note');
  const [modality, setModality] = useState<'in_person' | 'telehealth'>('in_person');
  const [duration, setDuration] = useState<string>('');
  const [quickNotes, setQuickNotes] = useState('');
  const [patientContext, setPatientContext] = useState('');
  const [generatedNote, setGeneratedNote] = useState<GenerateNoteResponse | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [isPending, startTransition] = useTransition();

  // Rule 4: Clear all PHI state when logout is initiated
  useEffect(() => {
    function handleLogout() {
      setQuickNotes('');
      setPatientContext('');
      setModality('in_person');
      setDuration('');
      setGeneratedNote(null);
      setErrorCode(null);
      setFieldErrors(null);
      setActiveStep(1);
    }
    window.addEventListener('flashnote:logout', handleLogout);
    return () => window.removeEventListener('flashnote:logout', handleLogout);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorCode(null);
    setFieldErrors(null);
    setGeneratedNote(null);
    setActiveStep(1);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('noteType', noteType);
      formData.set('modality', modality);
      // Strip duration when empty — z.coerce.number() on "" coerces to 0, failing .min(1)
      if (duration.trim()) formData.set('duration', duration);
      formData.set('quickNotes', quickNotes.trim());
      if (patientContext.trim()) formData.set('patientContext', patientContext);
      const result = await generateNoteAction(formData);
      if (result.success) {
        setGeneratedNote(result.data);
        setActiveStep(2);
      } else {
        setErrorCode(result.error);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      }
    });
  }

  function handleQuickNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setQuickNotes(e.target.value);
    setFieldErrors(null);
  }

  const wordCount = quickNotes.trim().split(/\s+/).filter(Boolean).length;
  const sessionDate = new Date().toLocaleDateString();

  return (
    <div>
      <StepIndicator activeStep={activeStep} />

      {/* Error display — above form per spec */}
      <div aria-live="assertive">
        {errorCode && (
          <Alert variant="error" className="mb-5">
            {NOTE_ERROR_MESSAGES[errorCode] ?? NOTE_ERROR_FALLBACK}
          </Alert>
        )}
      </div>

      <div className="flex gap-6">
        {/* Form column */}
        <div className="flex-1 min-w-0">
          <form onSubmit={handleSubmit} noValidate>
            {/* Patient selector stub */}
            <div className="mb-5">
              <label htmlFor="patient" className="label block text-fn-sm mb-1.5">
                Patient{' '}
                <span className="text-fn-2xs text-fn-text-secondary ml-1">Coming soon</span>
              </label>
              <input
                id="patient"
                type="text"
                disabled
                placeholder="Patient selection coming soon"
                className="input-field w-full px-3 py-2.5 text-fn-base opacity-60 cursor-not-allowed"
              />
            </div>

            {/* 2-col row: Template + Modality */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              {/* Note Type (Template) */}
              <div>
                <label htmlFor="noteType" className="label block text-fn-sm mb-1.5">
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
                  className="input-field w-full px-3 py-2.5 text-fn-base"
                  disabled={isPending}
                >
                  {(Object.keys(NOTE_TYPE_LABELS) as NoteType[]).map((type) => (
                    <option key={type} value={type}>
                      {NOTE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Modality */}
              <div>
                <label htmlFor="modality" className="label block text-fn-sm mb-1.5">
                  Modality
                </label>
                <select
                  id="modality"
                  name="modality"
                  value={modality}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'in_person' || value === 'telehealth') setModality(value);
                  }}
                  className="input-field w-full px-3 py-2.5 text-fn-base"
                  disabled={isPending}
                >
                  <option value="in_person">In Person</option>
                  <option value="telehealth">Telehealth</option>
                </select>
              </div>
            </div>

            {/* 2-col row: Duration + Session Date */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
              {/* Duration */}
              <div>
                <label htmlFor="duration" className="label block text-fn-sm mb-1.5">
                  Duration{' '}
                  <span className="text-fn-text-secondary text-fn-2xs">(optional)</span>
                </label>
                <input
                  id="duration"
                  name="duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min={1}
                  max={480}
                  placeholder="45 min"
                  className="input-field w-full px-3 py-2.5 text-fn-base"
                  disabled={isPending}
                />
              </div>

              {/* Session Date — readonly, not sent in FormData */}
              <div>
                <label htmlFor="sessionDate" className="label block text-fn-sm mb-1.5">
                  Session Date
                </label>
                <input
                  id="sessionDate"
                  type="text"
                  value={sessionDate}
                  readOnly
                  className="input-field w-full px-3 py-2.5 text-fn-base opacity-70 cursor-default"
                />
              </div>
            </div>

            {/* Session Notes textarea */}
            <div className="mb-5">
              <label htmlFor="quickNotes" className="label block text-fn-sm mb-1.5">
                Session Notes <span className="text-fn-error">*</span>
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
                rows={8}
                placeholder="Pt reports decreased L knee pain 5/10, AROM flexion 95deg, performed manual therapy and therapeutic exercise..."
                className={`input-field w-full px-3 py-2 resize-y min-h-[200px] ${fieldErrors?.quickNotes ? 'input-field-error' : ''}`}
                disabled={isPending}
              />
              <div className="flex items-start justify-between mt-1">
                <div>
                  {fieldErrors?.quickNotes && (
                    <p id="quickNotes-error" className="text-fn-error text-fn-sm">
                      {fieldErrors.quickNotes[0]}
                    </p>
                  )}
                </div>
                <p className="text-fn-2xs text-fn-text-secondary ml-4 shrink-0">
                  {wordCount} words
                </p>
              </div>
            </div>

            {/* TEMPORARY: "Additional Context" free-text input.
                This field is a bridge until PHI Storage Phase 2 lands the functional patient
                selector and stored patient context. When PHI Storage PR 3 (Notes end-to-end)
                ships, this free-text input will be replaced by:
                1. A patient search/typeahead selector (backed by api.getPatients())
                2. Stored patient context from patients.context (auto-injected into generation)
                See: docs/planning/PHI_STORAGE_PLAN.md (Chunk 6, "New Note page")
                See: docs/planning/UI_OVERHAUL_PLAN.md ("Additional Context Deprecation Plan") */}
            <div className="mb-6">
              <label htmlFor="patientContext" className="label block text-fn-sm mb-1.5">
                Additional Context{' '}
                <span className="text-fn-text-secondary text-fn-2xs">(optional)</span>
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

            {/* Submit button */}
            <Button
              type="submit"
              size="lg"
              disabled={isPending}
              loading={isPending}
              aria-busy={isPending}
              className="w-full"
            >
              {isPending ? 'Generating...' : 'Generate Professional Note'}
            </Button>

            {/* Loading status */}
            <div aria-live="polite" className="mt-3 min-h-[1.25rem]">
              {isPending && (
                <p className="text-fn-sm text-fn-text-secondary text-center">
                  Generating your professional note... (this may take up to 30 seconds)
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Context panel stub — xl+ only */}
        <aside className="hidden xl:block w-72 flex-shrink-0">
          <div className="card p-4">
            <h2 className="text-fn-sm font-semibold text-fn-text-primary mb-3">
              Patient Context
            </h2>
            <p className="text-fn-sm text-fn-text-secondary">
              Select a patient to see context
            </p>
          </div>
        </aside>
      </div>

      {generatedNote && <GeneratedNote note={generatedNote} />}
    </div>
  );
}
