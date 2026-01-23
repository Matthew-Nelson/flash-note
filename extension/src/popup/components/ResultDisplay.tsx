import { useState } from 'react';

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

interface ResultDisplayProps {
  note: GeneratedNote;
  onBack: () => void;
}

type SectionKey = 'subjective' | 'objective' | 'assessment' | 'plan';

const SECTION_LABELS: Record<SectionKey, string> = {
  subjective: 'SUBJECTIVE',
  objective: 'OBJECTIVE',
  assessment: 'ASSESSMENT',
  plan: 'PLAN',
};

export default function ResultDisplay({ note, onBack }: ResultDisplayProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyAll = () => {
    const fullNote = `SUBJECTIVE:
${note.subjective}

OBJECTIVE:
${note.objective}

ASSESSMENT:
${note.assessment}

PLAN:
${note.plan}`;
    copyToClipboard(fullNote, 'all');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <button
          onClick={onBack}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <button
          onClick={copyAll}
          className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
        >
          {copiedSection === 'all' ? (
            <>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy All
            </>
          )}
        </button>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
          <div key={key} className="bg-white border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
              <h3 className="text-sm font-semibold text-gray-700">
                {SECTION_LABELS[key]}
              </h3>
              <button
                onClick={() => copyToClipboard(note[key], key)}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
              >
                {copiedSection === key ? (
                  <>
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied
                  </>
                ) : (
                  'Copy'
                )}
              </button>
            </div>
            <div className="p-3">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{note[key]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500 text-center">
        Generated in {(note.metadata.generationTimeMs / 1000).toFixed(1)}s
      </div>
    </div>
  );
}
