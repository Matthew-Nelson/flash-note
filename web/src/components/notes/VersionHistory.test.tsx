import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VersionHistory } from './VersionHistory';
import type { NoteVersionWithSection } from '@/lib/types';

function v(partial: Partial<NoteVersionWithSection>): NoteVersionWithSection {
  return {
    id: partial.id ?? 'v-default',
    noteId: 'n1',
    sectionId: 's1',
    version: 1,
    content: '',
    source: 'generated',
    createdBy: 'user-1',
    createdAt: new Date(),
    sectionTitle: 'Subjective',
    ...partial,
  };
}

describe('VersionHistory', () => {
  it('renders nothing when only version 1 exists', () => {
    const { container } = render(
      <VersionHistory sectionId="s1" versions={[v({ version: 1 })]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when versions list is empty', () => {
    const { container } = render(<VersionHistory sectionId="s1" versions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders disclosure button when >1 version exists', () => {
    render(
      <VersionHistory
        sectionId="s1"
        versions={[
          v({ id: 'v1', version: 1 }),
          v({ id: 'v2', version: 2, source: 'manual' }),
        ]}
      />,
    );
    const btn = screen.getByRole('button', { name: /History \(1 edit\)/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('singular/plural "edit(s)" copy based on edit count', () => {
    render(
      <VersionHistory
        sectionId="s1"
        versions={[
          v({ id: 'v1', version: 1 }),
          v({ id: 'v2', version: 2 }),
          v({ id: 'v3', version: 3 }),
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: /History \(2 edits\)/i })).toBeInTheDocument();
  });

  it('expands via aria-controls link to panel id', async () => {
    const user = userEvent.setup();
    render(
      <VersionHistory
        sectionId="s1"
        versions={[
          v({ id: 'v1', version: 1 }),
          v({ id: 'v2', version: 2 }),
        ]}
      />,
    );
    const btn = screen.getByRole('button', { name: /History/i });
    const panelId = btn.getAttribute('aria-controls');
    expect(panelId).toBe('version-history-s1');

    await user.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    const list = document.getElementById(panelId!);
    expect(list).not.toBeNull();
  });

  it('sorts versions DESC (current version first)', async () => {
    const user = userEvent.setup();
    render(
      <VersionHistory
        sectionId="s1"
        versions={[
          v({ id: 'v1', version: 1 }),
          v({ id: 'v2', version: 2 }),
          v({ id: 'v3', version: 3 }),
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: /History/i }));
    const items = screen.getAllByRole('listitem');
    // First item = v3 (current)
    expect(items[0].textContent).toMatch(/Version 3/);
    // Last item = v1
    expect(items[items.length - 1].textContent).toMatch(/Version 1/);
  });

  it('filters versions to the given sectionId', () => {
    const { container } = render(
      <VersionHistory
        sectionId="s1"
        versions={[
          v({ id: 'v1', version: 1, sectionId: 's1' }),
          v({ id: 'v-other-1', version: 1, sectionId: 's2' }),
          v({ id: 'v-other-2', version: 2, sectionId: 's2' }),
        ]}
      />,
    );
    // Only one version for s1 → hidden entirely.
    expect(container.firstChild).toBeNull();
  });
});
