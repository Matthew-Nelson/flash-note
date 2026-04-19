'use client';

import { useState } from 'react';

import type { NoteVersionWithSection } from '@/lib/types';

interface VersionRowProps {
  version: NoteVersionWithSection;
  isCurrent: boolean;
}

const SOURCE_LABEL: Record<NoteVersionWithSection['source'], string> = {
  generated: 'GENERATED',
  manual: 'MANUAL EDIT',
  magic_edit: 'MAGIC EDIT',
};

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

/**
 * VersionRow — single row in the VersionHistory disclosure.
 *
 * Renders version number + source badge (GENERATED / MANUAL EDIT) + relative
 * timestamp (absolute on hover via `title`) + second-level disclosure button
 * to reveal the full content text.
 */
export function VersionRow({ version, isCurrent }: VersionRowProps) {
  const [expanded, setExpanded] = useState(false);

  const createdAt = new Date(version.createdAt);
  const absolute = createdAt.toLocaleString();

  return (
    <li className="text-fn-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">
          Version {version.version}
          {isCurrent && (
            <span className="text-fn-text-secondary ml-1">(current)</span>
          )}
        </span>
        <span
          className={`inline-block rounded-fn-sm px-1.5 py-0.5 text-fn-2xs font-semibold uppercase tracking-wider ${
            version.source === 'generated'
              ? 'bg-fn-bg-secondary text-fn-text-secondary border border-fn-border'
              : 'bg-fn-primary-DEFAULT/10 text-fn-primary-DEFAULT border border-fn-primary-DEFAULT/20'
          }`}
          aria-label={`Source: ${SOURCE_LABEL[version.source]}`}
        >
          {SOURCE_LABEL[version.source]}
        </span>
        <span className="text-fn-text-secondary" title={absolute}>
          {formatRelativeTime(createdAt)}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="ml-auto text-fn-primary-DEFAULT hover:underline"
        >
          {expanded ? 'Hide content' : 'Show content'}
        </button>
      </div>
      {expanded && (
        <pre className="mt-2 whitespace-pre-wrap text-fn-sm bg-fn-bg-secondary p-2 rounded-fn-sm border border-fn-border">
          {version.content}
        </pre>
      )}
    </li>
  );
}
