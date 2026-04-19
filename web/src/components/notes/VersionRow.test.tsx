import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VersionRow } from './VersionRow';
import type { NoteVersionWithSection } from '@/lib/types';

function row(overrides: Partial<NoteVersionWithSection> = {}): NoteVersionWithSection {
  return {
    id: 'v1',
    noteId: 'n1',
    sectionId: 's1',
    version: 1,
    content: 'Version 1 content',
    source: 'generated',
    createdBy: 'user-1',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    sectionTitle: 'Subjective',
    ...overrides,
  };
}

describe('VersionRow', () => {
  it('renders version number and "(current)" label when isCurrent', () => {
    render(<VersionRow version={row({ version: 2 })} isCurrent />);
    expect(screen.getByText(/Version 2/)).toBeInTheDocument();
    expect(screen.getByText(/\(current\)/)).toBeInTheDocument();
  });

  it('does not render "(current)" label when !isCurrent', () => {
    render(<VersionRow version={row()} isCurrent={false} />);
    expect(screen.queryByText(/\(current\)/)).toBeNull();
  });

  it('renders GENERATED source badge', () => {
    render(<VersionRow version={row({ source: 'generated' })} isCurrent />);
    expect(screen.getByText('GENERATED')).toBeInTheDocument();
  });

  it('renders MANUAL EDIT source badge', () => {
    render(<VersionRow version={row({ source: 'manual' })} isCurrent={false} />);
    expect(screen.getByText('MANUAL EDIT')).toBeInTheDocument();
  });

  it('toggles content visibility via Show/Hide button (aria-expanded)', async () => {
    const user = userEvent.setup();
    render(<VersionRow version={row({ content: 'HIDDEN_CONTENT_XYZ' })} isCurrent />);
    const toggle = screen.getByRole('button', { name: /Show content/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('HIDDEN_CONTENT_XYZ')).toBeNull();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('HIDDEN_CONTENT_XYZ')).toBeInTheDocument();
  });

  it('renders relative time label', () => {
    render(<VersionRow version={row()} isCurrent />);
    // Either "2h ago" or a relative-time synonym.
    expect(screen.getByText(/ago|just now|\d{1,2}[hmd]/i)).toBeInTheDocument();
  });
});
