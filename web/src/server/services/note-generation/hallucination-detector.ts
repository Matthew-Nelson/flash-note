import 'server-only';

/**
 * Post-generation hallucination detector (PROMPT-02).
 *
 * Scans LLM-generated section content for numeric values in four high-risk
 * categories (ROM degrees, MMT grades, billing minutes, goal percentages) and
 * flags any number that does NOT appear in the clinician's original quick
 * notes. Flag-and-continue UX — we never block generation; the UI renders a
 * warning alert so the clinician reviews before saving.
 *
 * See .planning/phases/04-phi-storage/04-RESEARCH.md §7.2.
 */

export type HallucinationKind =
  | 'rom_degrees'
  | 'mmt_grade'
  | 'billing_minutes'
  | 'goal_percent';

export interface HallucinationIssue {
  kind: HallucinationKind;
  /** Numeric token from the generated output, e.g. "120", "4+/5", "45", "90". */
  value: string;
  /** Section title the value appeared in (snapshot from the template). */
  sectionTitle: string;
  /**
   * ~20-character context snippet around the match, for UI display only.
   * This is NEVER persisted to audit logs (may contain surrounding PHI).
   */
  context: string;
}

// Matches "120°", "110 deg", "45 degrees" — captures the number in group 1 or 2.
const ROM_PATTERN = /(\d{1,3})\s*°|(\d{1,3})\s*(?:deg|degrees)\b/gi;

// Matches "4/5", "3+/5", "5-/5" — captures the grade portion in group 1.
const MMT_PATTERN = /\b([0-5](?:\+|-)?)\s*\/\s*5\b/g;

// Matches "15 min", "30 minute", "45 minutes" — captures the number in group 1.
const BILLING_MIN_PATTERN = /(\d{1,3})\s*(?:min|minute|minutes)\b/gi;

// Matches "75%", "100 %" — captures the number in group 1.
const PERCENT_PATTERN = /(\d{1,3})\s*%/g;

const SNIPPET_RADIUS = 20;

/**
 * Extract every numeric token (and MMT-style grades like "4+/5") from the
 * clinician's input, building the "allowed numbers" whitelist. Numbers can
 * include decimals (e.g., "23.5").
 */
export function extractAllNumbers(text: string): Set<string> {
  const allowed = new Set<string>();

  // Plain decimal/integer numbers.
  for (const match of text.matchAll(/\d+(?:\.\d+)?/g)) {
    allowed.add(match[0]);
  }

  // MMT grades written as "4/5", "3+/5", "5-/5" — add both the grade-prefix
  // (e.g. "4", "3+", "5-") and the numeric prefix stripped of its sign ("3")
  // so either spelling in the output passes.
  for (const match of text.matchAll(/\b([0-5](?:\+|-)?)\s*\/\s*5\b/g)) {
    const grade = match[1];
    allowed.add(grade);
    allowed.add(grade.replace(/[+-]/g, ''));
  }

  return allowed;
}

function extractSnippet(text: string, index: number, radius = SNIPPET_RADIUS): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end);
}

function scanForPattern(
  section: { title: string; content: string },
  pattern: RegExp,
  kind: HallucinationKind,
  allowed: Set<string>,
  extract: (match: RegExpMatchArray) => string | null,
): HallucinationIssue[] {
  const issues: HallucinationIssue[] = [];
  // Create a fresh copy so we don't share lastIndex state with the caller.
  const re = new RegExp(pattern.source, pattern.flags);
  for (const match of section.content.matchAll(re)) {
    const value = extract(match);
    if (!value) continue;
    if (allowed.has(value)) continue;
    issues.push({
      kind,
      value,
      sectionTitle: section.title,
      context: extractSnippet(section.content, match.index ?? 0),
    });
  }
  return issues;
}

/**
 * Detect numeric hallucinations across the generated sections.
 *
 * @param quickNotes - The clinician's original quick notes (whitelist source).
 * @param sections   - Generated section content to scan.
 * @returns An array of HallucinationIssue objects; empty if the output is clean.
 */
export function detectHallucinations(
  quickNotes: string,
  sections: { title: string; content: string }[],
): HallucinationIssue[] {
  const allowed = extractAllNumbers(quickNotes);
  const issues: HallucinationIssue[] = [];

  for (const section of sections) {
    // ROM degrees
    issues.push(
      ...scanForPattern(section, ROM_PATTERN, 'rom_degrees', allowed, (m) => m[1] ?? m[2] ?? null),
    );

    // MMT grades — value = the grade string (e.g. "4+")
    issues.push(
      ...scanForPattern(section, MMT_PATTERN, 'mmt_grade', allowed, (m) => m[1] ?? null),
    );

    // Billing minutes
    issues.push(
      ...scanForPattern(section, BILLING_MIN_PATTERN, 'billing_minutes', allowed, (m) => m[1] ?? null),
    );

    // Goal percentages
    issues.push(
      ...scanForPattern(section, PERCENT_PATTERN, 'goal_percent', allowed, (m) => m[1] ?? null),
    );
  }

  return issues;
}
