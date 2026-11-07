import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { HallucinationFlag } from './HallucinationFlag';
import type { HallucinationIssue } from '@/server/services/note-generation/hallucination-detector';

function issue(partial: Partial<HallucinationIssue> = {}): HallucinationIssue {
  return {
    kind: 'rom_degrees',
    value: '120',
    sectionTitle: 'Objective',
    context: '…flexion 120°…',
    ...partial,
  };
}

describe('HallucinationFlag', () => {
  it('renders nothing when issues is empty', () => {
    const { container } = render(<HallucinationFlag issues={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Alert warning variant when issues exist', () => {
    render(<HallucinationFlag issues={[issue()]} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert.className).toMatch(/warning/i);
  });

  it('wraps content in aria-live="polite" region', () => {
    render(<HallucinationFlag issues={[issue()]} />);
    expect(screen.getByRole('alert').closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
  });

  it('groups multiple issues by section title', () => {
    render(
      <HallucinationFlag
        issues={[
          issue({ kind: 'rom_degrees', value: '120', sectionTitle: 'Objective' }),
          issue({ kind: 'mmt_grade', value: '5', sectionTitle: 'Objective' }),
          issue({ kind: 'goal_percent', value: '90', sectionTitle: 'Assessment' }),
        ]}
      />
    );
    const items = within(screen.getByRole('alert')).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Objective: ROM measurement "120" not found in your quick notes; Strength grade "5" not found in your quick notes',
      'Assessment: Goal percentage "90" not found in your quick notes',
    ]);
  });

  it('uses labels for each hallucination kind', () => {
    render(
      <HallucinationFlag
        issues={[
          issue({ kind: 'rom_degrees', value: '120' }),
          issue({ kind: 'mmt_grade', value: '5', sectionTitle: 'S' }),
          issue({ kind: 'billing_minutes', value: '45', sectionTitle: 'B' }),
          issue({ kind: 'goal_percent', value: '90', sectionTitle: 'G' }),
        ]}
      />
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('ROM measurement "120" not found in your quick notes');
    expect(alert.textContent).toContain('Strength grade "5" not found in your quick notes');
    expect(alert.textContent).toContain('Billing time "45" not found in your quick notes');
    expect(alert.textContent).toContain('Goal percentage "90" not found in your quick notes');
  });

  it('does NOT render the per-issue context snippet (PHI — UI-only data)', () => {
    const snippet = 'SENSITIVE_CONTEXT_SHOULD_NOT_LEAK';
    render(
      <HallucinationFlag issues={[issue({ context: snippet })]} />
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).not.toContain(snippet);
  });
});
