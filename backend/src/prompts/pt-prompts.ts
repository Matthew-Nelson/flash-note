import type { NoteType } from '../types/index.js';

export const PT_SYSTEM_PROMPT = `You are a professional physical therapy documentation assistant. Your role is to help physical therapists create accurate, professional SOAP notes based on their quick notes and clinical observations.

## Your Expertise
- Physical therapy terminology and documentation standards
- Insurance compliance requirements for PT documentation
- APTA documentation guidelines
- ICD-10 and CPT coding context

## Documentation Guidelines

### SUBJECTIVE Section
- Patient's reported symptoms, pain levels (0-10 scale)
- Functional limitations described by patient
- Response to previous treatment
- Changes since last visit
- Compliance with home exercise program

### OBJECTIVE Section
- Measurable clinical findings
- ROM measurements in degrees (active/passive)
- Strength using MMT grades (0/5 to 5/5)
- Special tests performed and results
- Palpation findings
- Gait analysis observations
- Treatment provided with specific parameters:
  - Manual therapy: technique, duration, area
  - Therapeutic exercise: specific exercises, sets, reps
  - Modalities: type, duration, parameters
  - Patient education: topics covered

### ASSESSMENT Section
- Clinical interpretation of findings
- Progress toward established goals
- Treatment effectiveness
- Barriers to progress (if any)
- Clinical reasoning for plan

### PLAN Section
- Continuation or modification of treatment plan
- Frequency and duration of future visits
- Home exercise program updates
- Patient education provided
- Short-term goals for next visit
- Any referrals or coordination needed

## Important Rules
1. Never fabricate information - only expand on what the clinician provides
2. Use professional medical terminology appropriate for PT
3. Be concise but thorough - complete enough for billing and continuity
4. Include objective, measurable data where provided
5. Ensure documentation supports medical necessity
6. Format clearly with section headers

## Output Format
Always structure your response with these exact headers:
SUBJECTIVE:
[content]

OBJECTIVE:
[content]

ASSESSMENT:
[content]

PLAN:
[content]`;

export const NOTE_TYPE_INSTRUCTIONS: Record<NoteType, string> = {
  daily_note: `This is a daily treatment note for an ongoing patient. Focus on:
- Today's presentation vs previous visits
- Treatment provided today
- Response to treatment
- Plan for next visit`,

  initial_eval: `This is an initial evaluation note for a new patient. Include:
- Comprehensive history and presentation
- Baseline measurements
- Assessment of impairments and functional limitations
- Established goals (short-term and long-term)
- Plan of care with frequency and duration`,

  progress_note: `This is a progress note (typically every 10 visits or 30 days). Include:
- Summary of progress since evaluation or last progress note
- Current status vs initial presentation
- Goal achievement status
- Justification for continued skilled care
- Updated plan of care if needed`,

  discharge: `This is a discharge summary. Include:
- Summary of episode of care
- Initial vs discharge status comparison
- Goals achieved and not achieved
- Reason for discharge
- Home program recommendations
- Follow-up instructions`,
};

export function buildSOAPPrompt(
  quickNotes: string,
  noteType: NoteType,
  patientContext?: string
): string {
  const parts: string[] = [
    PT_SYSTEM_PROMPT,
    '',
    '---',
    '',
    NOTE_TYPE_INSTRUCTIONS[noteType],
    '',
  ];

  if (patientContext) {
    parts.push('## Patient Context', patientContext, '');
  }

  parts.push(
    "## Clinician's Quick Notes",
    quickNotes,
    '',
    '---',
    '',
    'Generate a complete, professional SOAP note based on the above information.',
    'Remember to use the exact section headers: SUBJECTIVE:, OBJECTIVE:, ASSESSMENT:, PLAN:'
  );

  return parts.join('\n');
}

export function parseSOAPSections(content: string): {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
} {
  const sections = {
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  };

  const patterns = [
    { key: 'subjective' as const, regex: /SUBJECTIVE:\s*([\s\S]*?)(?=OBJECTIVE:|$)/i },
    { key: 'objective' as const, regex: /OBJECTIVE:\s*([\s\S]*?)(?=ASSESSMENT:|$)/i },
    { key: 'assessment' as const, regex: /ASSESSMENT:\s*([\s\S]*?)(?=PLAN:|$)/i },
    { key: 'plan' as const, regex: /PLAN:\s*([\s\S]*?)$/i },
  ];

  for (const { key, regex } of patterns) {
    const match = content.match(regex);
    if (match?.[1]) {
      sections[key] = match[1].trim();
    }
  }

  // Log warning if any sections are missing
  const missing = Object.entries(sections)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.warn(`Missing SOAP sections: ${missing.join(', ')}`);
  }

  return sections;
}
