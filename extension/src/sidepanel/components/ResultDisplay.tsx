import { useState, useEffect } from 'react';
import { type GeneratedNote } from '@/shared/schemas';
import { useStreamingText } from '../hooks/useStreamingText';

interface ResultDisplayProps {
  note: GeneratedNote;
  onBack: () => void;
}

type SectionKey = 'subjective' | 'objective' | 'assessment' | 'plan';

const SECTION_CONFIG: { key: SectionKey; label: string; icon: string }[] = [
  { key: 'subjective', label: 'SUBJECTIVE', icon: '💬' },
  { key: 'objective', label: 'OBJECTIVE', icon: '📊' },
  { key: 'assessment', label: 'ASSESSMENT', icon: '🎯' },
  { key: 'plan', label: 'PLAN', icon: '📝' },
];

function StreamingSection({
  content,
  onCopy,
  isCopied,
  label,
  icon,
  delay = 0
}: {
  content: string;
  onCopy: () => void;
  isCopied: boolean;
  label: string;
  icon: string;
  delay?: number;
}) {
  const [shouldStream, setShouldStream] = useState(false);
  const { displayedText, isComplete } = useStreamingText(
    shouldStream ? content : '',
    { speed: 8 }
  );

  useEffect(() => {
    const timer = setTimeout(() => setShouldStream(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!shouldStream) {
    return null;
  }

  return (
    <div className="card section-reveal overflow-hidden" style={{ animationDelay: `${delay}ms` }}>
      <div className="card-header flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span>{icon}</span>
          {label}
        </h3>
        <button
          onClick={onCopy}
          className="icon-btn text-xs flex items-center gap-1 px-2 py-1 rounded"
        >
          {isCopied ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <p className="text-sm whitespace-pre-wrap">
          {displayedText}
          {!isComplete && <span className="typing-cursor" />}
        </p>
      </div>
    </div>
  );
}

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
      <div className="flex items-center justify-between px-4 py-2 border-b card-header">
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

      {/* Sections with staggered streaming */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {SECTION_CONFIG.map((section, index) => (
          <StreamingSection
            key={section.key}
            content={note[section.key]}
            label={section.label}
            icon={section.icon}
            onCopy={() => copyToClipboard(note[section.key], section.key)}
            isCopied={copiedSection === section.key}
            delay={index * 200}
          />
        ))}
      </div>

      {/* Footer */}
      {note.metadata && (
        <div className="px-4 py-2 border-t text-xs text-center opacity-50">
          Generated in {(note.metadata.generationTimeMs / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
}
