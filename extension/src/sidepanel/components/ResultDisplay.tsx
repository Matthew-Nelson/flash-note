import { useState } from 'react';
import { type GeneratedNote } from '@/shared/schemas';

interface ResultDisplayProps {
  note: GeneratedNote;
  onBack: () => void;
}

type SectionKey = 'subjective' | 'objective' | 'assessment' | 'plan';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'subjective', label: 'SUBJECTIVE' },
  { key: 'objective', label: 'OBJECTIVE' },
  { key: 'assessment', label: 'ASSESSMENT' },
  { key: 'plan', label: 'PLAN' },
];

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
      {/* Action bar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <button
          onClick={onBack}
          className="btn-secondary flex items-center text-sm px-3 py-1.5 rounded-lg"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <button
          onClick={copyAll}
          className="btn-primary flex items-center px-3 py-1.5 text-sm font-medium rounded-lg"
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

      {/* Document content */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className="document-container rounded-lg p-5"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
          }}
        >
          {SECTIONS.map((section, index) => (
            <div
              key={section.key}
              className={`document-section ${index < SECTIONS.length - 1 ? 'mb-5' : ''}`}
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <h4
                className="document-section-label text-xs font-bold tracking-wide mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                {section.label}:
              </h4>
              <p
                className="document-section-content text-sm leading-relaxed"
                style={{ color: 'var(--text-primary)' }}
              >
                {note[section.key]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      {note.metadata && (
        <div
          className="px-4 py-2 border-t text-xs text-center"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
        >
          Generated in {(note.metadata.generationTimeMs / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
}
