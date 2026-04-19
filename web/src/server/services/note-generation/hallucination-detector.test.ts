import { describe, it, expect } from 'vitest';
import {
  detectHallucinations,
  extractAllNumbers,
  type HallucinationIssue,
} from './hallucination-detector';

function titles(issues: HallucinationIssue[]): string[] {
  return issues.map((i) => `${i.kind}:${i.value}@${i.sectionTitle}`);
}

describe('extractAllNumbers', () => {
  it('captures plain integers and decimals', () => {
    const s = extractAllNumbers('ROM 110°, 23.5 min, 4 reps');
    expect(s.has('110')).toBe(true);
    expect(s.has('23.5')).toBe(true);
    expect(s.has('4')).toBe(true);
  });

  it('captures MMT grade tokens both with and without sign', () => {
    const s = extractAllNumbers('quad strength 4+/5');
    expect(s.has('4+')).toBe(true);
    expect(s.has('4')).toBe(true);
    expect(s.has('5')).toBe(true);
  });

  it('returns empty set for empty input', () => {
    const s = extractAllNumbers('');
    expect(s.size).toBe(0);
  });
});

describe('detectHallucinations — ROM degrees', () => {
  it('does NOT flag ROM degrees that appear in the input', () => {
    const issues = detectHallucinations(
      'knee flex 110°, ext 0°',
      [{ title: 'Objective', content: 'Knee flexion measured at 110°, extension at 0°.' }],
    );
    expect(issues).toEqual([]);
  });

  it('flags ROM degrees that are NOT in the input', () => {
    const issues = detectHallucinations(
      'knee flex 110°',
      [{ title: 'Objective', content: 'Knee flexion increased from 95° to 120°.' }],
    );
    expect(issues).toHaveLength(2);
    expect(titles(issues)).toEqual(
      expect.arrayContaining(['rom_degrees:95@Objective', 'rom_degrees:120@Objective']),
    );
  });

  it('recognizes "degrees" and "deg" spellings', () => {
    const issues = detectHallucinations(
      'some notes',
      [{ title: 'Objective', content: 'ROM 45 degrees and elbow 30 deg.' }],
    );
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.kind === 'rom_degrees')).toBe(true);
  });
});

describe('detectHallucinations — MMT grades', () => {
  it('does NOT flag MMT grades present in input', () => {
    const issues = detectHallucinations(
      'quad 4/5',
      [{ title: 'Objective', content: 'Quadriceps 4/5 strength grade.' }],
    );
    expect(issues).toEqual([]);
  });

  it('flags MMT grades NOT in input', () => {
    const issues = detectHallucinations(
      'quad strong',
      [{ title: 'Objective', content: 'Hip abductors 3/5 and quadriceps 4/5.' }],
    );
    // "4" is already in allowed via the "5" at the right-hand-side of the /5 tokens?
    // No — allowed comes from input "quad strong" which has no numbers.
    const mmtIssues = issues.filter((i) => i.kind === 'mmt_grade');
    expect(mmtIssues.length).toBeGreaterThanOrEqual(2);
    expect(mmtIssues.map((i) => i.value).sort()).toEqual(['3', '4']);
  });

  it('handles grade-with-sign like "3+/5"', () => {
    const issues = detectHallucinations(
      'strength improving',
      [{ title: 'Objective', content: 'Hip flex 3+/5.' }],
    );
    const mmt = issues.find((i) => i.kind === 'mmt_grade');
    expect(mmt?.value).toBe('3+');
  });
});

describe('detectHallucinations — billing minutes', () => {
  it('does NOT flag billing minutes present in input', () => {
    const issues = detectHallucinations(
      'tx 30 min',
      [{ title: 'Objective', content: 'Therapeutic exercise 30 min.' }],
    );
    expect(issues.filter((i) => i.kind === 'billing_minutes')).toEqual([]);
  });

  it('flags billing minutes NOT in input', () => {
    const issues = detectHallucinations(
      'tx applied',
      [{ title: 'Objective', content: 'Manual therapy 15 min, ther ex 25 minutes.' }],
    );
    const bill = issues.filter((i) => i.kind === 'billing_minutes');
    expect(bill.map((i) => i.value).sort()).toEqual(['15', '25']);
  });
});

describe('detectHallucinations — goal percentages', () => {
  it('does NOT flag percentages present in input', () => {
    const issues = detectHallucinations(
      '75% toward goal',
      [{ title: 'Assessment', content: 'Patient 75% toward flexion goal.' }],
    );
    expect(issues.filter((i) => i.kind === 'goal_percent')).toEqual([]);
  });

  it('flags percentages NOT in input', () => {
    const issues = detectHallucinations(
      'progressing well',
      [{ title: 'Assessment', content: 'Patient 90% toward goal.' }],
    );
    const pct = issues.filter((i) => i.kind === 'goal_percent');
    expect(pct).toHaveLength(1);
    expect(pct[0].value).toBe('90');
  });
});

describe('detectHallucinations — context snippet', () => {
  it('limits context snippet to ~40 characters', () => {
    const issues = detectHallucinations(
      'no numbers here',
      [
        {
          title: 'Objective',
          content:
            'The patient reports substantial progress with knee flexion measuring 120° consistently across the last three sessions.',
        },
      ],
    );
    expect(issues.length).toBeGreaterThan(0);
    for (const i of issues) {
      expect(i.context.length).toBeLessThanOrEqual(40);
    }
  });
});

describe('detectHallucinations — edge cases', () => {
  it('returns empty when input and output are both empty', () => {
    expect(detectHallucinations('', [])).toEqual([]);
  });

  it('returns empty when sections have no numeric content', () => {
    expect(
      detectHallucinations('notes', [
        { title: 'Subjective', content: 'Patient reports generalized soreness.' },
      ]),
    ).toEqual([]);
  });

  it('scans every section independently', () => {
    const issues = detectHallucinations(
      '',
      [
        { title: 'Subjective', content: 'Patient reports soreness 4/5 tender.' },
        { title: 'Objective', content: 'Hip strength 3/5.' },
      ],
    );
    // One MMT issue per section.
    const mmt = issues.filter((i) => i.kind === 'mmt_grade');
    expect(mmt).toHaveLength(2);
    expect(new Set(mmt.map((i) => i.sectionTitle))).toEqual(
      new Set(['Subjective', 'Objective']),
    );
  });
});
