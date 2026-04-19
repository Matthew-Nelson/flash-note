'use client';

import { useState } from 'react';

import type { NoteVersionWithSection } from '@/lib/types';

import { VersionRow } from './VersionRow';

interface VersionHistoryProps {
  sectionId: string;
  versions: NoteVersionWithSection[];
}

/**
 * VersionHistory — disclosure showing prior versions of a single section
 * (DESC by version). Hidden when only version=1 exists (no meaningful history).
 *
 * aria-expanded + aria-controls on the trigger button (Rule 14). When
 * expanded, renders a <ul> of VersionRow items with timestamps + source
 * badges + collapsible per-row content.
 */
export function VersionHistory({ sectionId, versions }: VersionHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  // Filter to this section and sort DESC.
  const rows = versions
    .filter((v) => v.sectionId === sectionId)
    .sort((a, b) => b.version - a.version);

  if (rows.length <= 1) return null;

  const panelId = `version-history-${sectionId}`;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="text-fn-sm text-fn-primary-DEFAULT hover:underline"
      >
        {expanded ? 'Hide history' : `History (${rows.length - 1} ${rows.length - 1 === 1 ? 'edit' : 'edits'})`}
      </button>
      {expanded && (
        <ul id={panelId} className="mt-2 space-y-2 border-l-2 border-fn-border pl-3">
          {rows.map((v, idx) => (
            <VersionRow
              key={v.id}
              version={v}
              isCurrent={idx === 0}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
