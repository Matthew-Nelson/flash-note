import { useState, useEffect, useRef } from 'react';
import { api } from '@/shared/api';
import { validateGenerateNote, type NoteType, type GeneratedNote } from '@/shared/schemas';

interface NoteGeneratorProps {
  onNoteGenerated: (note: GeneratedNote) => void;
}

const NOTE_TYPES: { value: NoteType; label: string; icon: string }[] = [
  { value: 'daily_note', label: 'Daily Note', icon: '📋' },
  { value: 'initial_eval', label: 'Initial Evaluation', icon: '🔍' },
  { value: 'progress_note', label: 'Progress Note', icon: '📈' },
  { value: 'discharge', label: 'Discharge Summary', icon: '✅' },
];

const LOADING_STAGES = [
  'Analyzing your notes...',
  'Drafting Subjective section...',
  'Composing Objective findings...',
  'Formulating Assessment...',
  'Creating Plan of care...',
  'Finalizing note...',
];

type GenerationPhase = 'idle' | 'loading' | 'success';

export default function NoteGenerator({ onNoteGenerated }: NoteGeneratorProps) {
  const [noteType, setNoteType] = useState<NoteType>('daily_note');
  const [patientContext, setPatientContext] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [loadingStage, setLoadingStage] = useState(0);

  // Store the generated note temporarily during success animation
  const generatedNoteRef = useRef<GeneratedNote | null>(null);

  // Cycle through loading stages while loading
  useEffect(() => {
    if (phase !== 'loading') {
      return;
    }

    const interval = setInterval(() => {
      setLoadingStage((prev) => (prev + 1) % LOADING_STAGES.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [phase]);

  // Handle success phase transition to results
  useEffect(() => {
    if (phase !== 'success') return;

    // Show success animation for 1.5 seconds, then navigate to results
    const timeout = setTimeout(() => {
      if (generatedNoteRef.current) {
        onNoteGenerated(generatedNoteRef.current);
        generatedNoteRef.current = null;
      }
      setPhase('idle');
    }, 1500);

    return () => clearTimeout(timeout);
  }, [phase, onNoteGenerated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    // Validate input with Zod
    const validation = validateGenerateNote({
      noteType,
      patientContext: patientContext || undefined,
      quickNotes,
    });

    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }

    setPhase('loading');
    setLoadingStage(0); // Reset loading stage in event handler, not effect

    try {
      const result = await api.generateNote(validation.data);
      // Store result and transition to success phase
      generatedNoteRef.current = result;
      setPhase('success');
    } catch (err) {
      if (err instanceof Error) {
        setErrors([err.message]);
      } else {
        setErrors(['Failed to generate note']);
      }
      setPhase('idle');
    }
  };

  const charCount = quickNotes.length;
  const charPercentage = (charCount / 5000) * 100;
  const charColor = charPercentage > 90 ? 'text-red-500' : charPercentage > 70 ? 'text-yellow-500' : 'opacity-50';

  // Loading state
  // TODO: Add error state animation (e.g., shake + red X) when API call fails,
  // instead of immediately returning to idle. This would provide better user feedback.
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center p-8 flex-1 animate-fade-in">
        <div className="loading-indicator flex flex-col items-center">
          <div className="relative flex flex-col items-center">
            <div className="loading-spinner">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>

          {/* Stage indicator */}
          <p className="loading-stage text-base font-medium mt-4 animate-fade-in" key={loadingStage}>
            {LOADING_STAGES[loadingStage]}
          </p>
        </div>
      </div>
    );
  }

  // Success state - checkmark animation
  if (phase === 'success') {
    return (
      <div className="flex flex-col items-center justify-center p-8 flex-1 animate-fade-in">
        <div className="success-checkmark-container hold">
          <div className="success-checkmark">
            <svg
              className="success-checkmark-icon"
              viewBox="0 0 52 52"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="success-checkmark-circle"
                cx="26"
                cy="26"
                r="24"
                stroke="url(#checkGradientMain)"
                strokeWidth="3"
                fill="none"
              />
              <path
                className="success-checkmark-check"
                d="M15 27l7 7 15-15"
                stroke="url(#checkGradientMain)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <defs>
                <linearGradient id="checkGradientMain" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--accent-primary)" />
                  <stop offset="50%" stopColor="var(--accent-secondary)" />
                  <stop offset="100%" stopColor="var(--accent-tertiary)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="success-checkmark-shimmer" />
          </div>
          <p className="success-checkmark-text mt-4 text-base font-medium">
            Note generated!
          </p>
        </div>
      </div>
    );
  }

  // Default: form state
  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      {/* Note Type */}
      <div className="animate-fade-in-up">
        <label htmlFor="noteType" className="label block text-sm mb-1">
          Note Type
        </label>
        <select
          id="noteType"
          value={noteType}
          onChange={(e) => setNoteType(e.target.value as NoteType)}
          className="input-field w-full px-3 py-2"
        >
          {NOTE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.icon} {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Patient Context */}
      <div className="animate-fade-in-up stagger-1">
        <label htmlFor="patientContext" className="label block text-sm mb-1">
          Patient Context <span className="opacity-50">(optional)</span>
        </label>
        <textarea
          id="patientContext"
          value={patientContext}
          onChange={(e) => setPatientContext(e.target.value)}
          maxLength={500}
          rows={2}
          className="input-field w-full px-3 py-2 resize-y min-h-[60px]"
          placeholder="e.g., John, 52M, chronic LBP, visit 5/12"
        />
      </div>

      {/* Session Notes */}
      <div className="animate-fade-in-up stagger-2">
        <label htmlFor="quickNotes" className="label block text-sm mb-1">
          Session Notes
        </label>
        <textarea
          id="quickNotes"
          value={quickNotes}
          onChange={(e) => setQuickNotes(e.target.value)}
          required
          minLength={10}
          maxLength={5000}
          rows={8}
          className="input-field w-full px-3 py-2 resize-y min-h-[120px]"
          placeholder="Enter your quick notes here...

e.g., reports 40% pain reduction. flex ROM 50->65. MFR lumbar paraspinals. grade III mobs L4-5. HEP bridges 2x15, bird dogs 2x10. tolerated well."
        />
        <p className={`mt-1 text-xs ${charColor} transition-colors`}>
          {charCount.toLocaleString()}/5,000 characters
        </p>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="error-message text-sm px-3 py-2 animate-fade-in">
          {errors.length === 1 ? (
            errors[0]
          ) : (
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="animate-fade-in-up stagger-3">
        <button
          type="submit"
          disabled={phase !== 'idle' || quickNotes.length < 10}
          className="btn-primary w-full flex justify-center items-center gap-2 py-3 px-4 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Generate Note
        </button>
      </div>
    </form>
  );
}
