import { useState, useEffect } from 'react';
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

export default function NoteGenerator({ onNoteGenerated }: NoteGeneratorProps) {
  const [noteType, setNoteType] = useState<NoteType>('daily_note');
  const [patientContext, setPatientContext] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);

  // Cycle through loading stages
  useEffect(() => {
    if (!isLoading) {
      setLoadingStage(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingStage((prev) => (prev + 1) % LOADING_STAGES.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [isLoading]);

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

    setIsLoading(true);

    try {
      const result = await api.generateNote(validation.data);
      onNoteGenerated(result);
    } catch (err) {
      if (err instanceof Error) {
        setErrors([err.message]);
      } else {
        setErrors(['Failed to generate note']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const charCount = quickNotes.length;
  const charPercentage = (charCount / 5000) * 100;
  const charColor = charPercentage > 90 ? 'text-red-500' : charPercentage > 70 ? 'text-yellow-500' : 'opacity-50';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 flex-1 animate-fade-in">
        <div className="loading-indicator flex flex-col items-center gap-6">
          {/* Loading visual - adapts per theme */}
          <div className="relative">
            <div className="loading-orb" />
            <div className="loading-rings" />
            <div className="loading-bar" />
          </div>

          {/* Stage indicator */}
          <div className="text-center">
            <p className="text-sm font-medium animate-fade-in" key={loadingStage}>
              {LOADING_STAGES[loadingStage]}
            </p>
            <div className="flex justify-center gap-1 mt-3">
              {LOADING_STAGES.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i === loadingStage ? 'btn-primary scale-125' : 'opacity-30'
                  }`}
                  style={{ backgroundColor: i === loadingStage ? 'var(--accent-primary, #06b6d4)' : 'currentColor' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          disabled={isLoading || quickNotes.length < 10}
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
