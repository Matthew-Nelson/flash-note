import { useState } from 'react';
import { api } from '@/shared/api';

type NoteType = 'daily_note' | 'initial_eval' | 'progress_note' | 'discharge';

interface GeneratedNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  metadata: {
    model: string;
    tokensUsed: number;
    generationTimeMs: number;
  };
}

interface NoteGeneratorProps {
  onNoteGenerated: (note: GeneratedNote) => void;
}

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: 'daily_note', label: 'Daily Note' },
  { value: 'initial_eval', label: 'Initial Evaluation' },
  { value: 'progress_note', label: 'Progress Note' },
  { value: 'discharge', label: 'Discharge Summary' },
];

export default function NoteGenerator({ onNoteGenerated }: NoteGeneratorProps) {
  const [noteType, setNoteType] = useState<NoteType>('daily_note');
  const [patientContext, setPatientContext] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await api.generateNote({
        noteType,
        patientContext: patientContext || undefined,
        quickNotes,
      });
      onNoteGenerated(result);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to generate note');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      {/* Note Type */}
      <div>
        <label htmlFor="noteType" className="block text-sm font-medium text-gray-700">
          Note Type
        </label>
        <select
          id="noteType"
          value={noteType}
          onChange={(e) => setNoteType(e.target.value as NoteType)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
        >
          {NOTE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Patient Context */}
      <div>
        <label htmlFor="patientContext" className="block text-sm font-medium text-gray-700">
          Patient Context <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="patientContext"
          type="text"
          value={patientContext}
          onChange={(e) => setPatientContext(e.target.value)}
          maxLength={500}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          placeholder="e.g., John, 52M, chronic LBP, visit 5/12"
        />
      </div>

      {/* Quick Notes */}
      <div>
        <label htmlFor="quickNotes" className="block text-sm font-medium text-gray-700">
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
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 resize-none"
          placeholder="Enter your quick notes here...

e.g., reports 40% pain reduction. flex ROM 50->65. MFR lumbar paraspinals. grade III mobs L4-5. HEP bridges 2x15, bird dogs 2x10. tolerated well."
        />
        <p className="mt-1 text-xs text-gray-500">
          {quickNotes.length}/5000 characters
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || quickNotes.length < 10}
        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating...
          </span>
        ) : (
          'Generate Note'
        )}
      </button>
    </form>
  );
}
