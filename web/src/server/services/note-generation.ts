import 'server-only';

import { config, isProduction } from '@/server/db/config';
import { getSystemPrompt } from '@/server/prompts/system';
import { assembleUserPrompt } from '@/server/prompts/assemble';
import { detectSuspiciousPatterns } from '@/server/lib/prompt-sanitization';
import { detectHallucinations } from './note-generation/hallucination-detector';
import type { HallucinationIssue } from './note-generation/hallucination-detector';
import {
  getConfiguredProvider,
  type LLMRequestConfig,
  type BillingSummary,
  type GoalsTracking,
} from '@/server/services/llm';
import type { NoteSection, NoteTemplateWithSections, NoteType } from '@/lib/types';

/**
 * Security metadata for audit purposes (MEDIUM-005).
 * Tracks whether prompt injection patterns were detected in user input.
 */
export interface PromptSecurityMetadata {
  suspiciousPatternDetected: boolean;
  suspiciousPatternCount: number;
}

/**
 * Result from template-driven note generation (Plan 04-03).
 *
 * The Server Action strips sensitive fields before returning to the client.
 *
 * `content` is an ordered array of `NoteSection` — one entry per loaded
 * template section. Titles are snapshots so downstream consumers (note
 * detail page, copy buttons) are stable if a template rename happens later.
 */
export interface GeneratedNoteResult {
  content: NoteSection[];
  billing?: BillingSummary;
  goals?: GoalsTracking;
  alerts?: string[];
  uncertainAreas?: string[];
  hallucinationIssues: HallucinationIssue[];
  metadata: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    generationTimeMs: number;
  };
  securityMetadata: PromptSecurityMetadata;
}

// SECURITY: Prevent mock AI from being used in production.
// This could result in fake clinical notes that could harm patients.
if (isProduction && config.USE_MOCK_AI) {
  throw new Error(
    'SECURITY ERROR: USE_MOCK_AI cannot be enabled in production. ' +
    'Mock responses could generate fake clinical notes that harm patients.'
  );
}

/**
 * Build provider-specific request config from environment.
 */
function getRequestConfig(): LLMRequestConfig {
  if (config.LLM_PROVIDER === 'gemini') {
    return {
      maxTokens: config.GEMINI_MAX_TOKENS,
      temperature: config.GEMINI_TEMPERATURE,
      timeoutMs: config.GEMINI_TIMEOUT_MS,
    };
  }
  return {
    maxTokens: config.ANTHROPIC_MAX_TOKENS,
    temperature: config.ANTHROPIC_TEMPERATURE,
    timeoutMs: config.ANTHROPIC_TIMEOUT_MS,
  };
}

/**
 * Map the LLM's response (currently legacy SOAP keys subjective/objective/
 * assessment/plan — see "Response schema fallback" note below) back to an
 * ordered `NoteSection[]` aligned with the template's section order.
 *
 * Matching is case-insensitive on `section.title`. Unknown titles (future
 * non-SOAP templates) fall through to an empty-string placeholder so the
 * per-section mapping is always complete — the hallucination detector and
 * UI can still render the section even if the LLM didn't populate it.
 *
 * Response schema fallback: Vertex AI's `responseSchema` doesn't handle
 * dynamic UUID-keyed object properties reliably across model revisions, so
 * the provider still requests the stable SOAP-keyed schema and this function
 * bridges that to the template's section IDs. Documented in Plan 04-03 SUMMARY.
 */
function mapResponseToSections(
  template: NoteTemplateWithSections,
  response: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  },
): NoteSection[] {
  const byTitle = new Map<string, string>();
  byTitle.set('subjective', response.subjective);
  byTitle.set('objective', response.objective);
  byTitle.set('assessment', response.assessment);
  byTitle.set('plan', response.plan);

  return template.sections
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((section) => ({
      sectionId: section.id,
      title: section.title,
      content: byTitle.get(section.title.toLowerCase()) ?? '',
    }));
}

/**
 * Generate a mock SOAP note for development/testing.
 * Returns a realistic fixture response without calling any LLM API.
 */
function generateMockNote(
  template: NoteTemplateWithSections,
  quickNotesLength: number,
): GeneratedNoteResult {
  const mockSections: Record<string, string> = {
    Subjective:
      'Patient reports pain level of 4/10 at rest, increasing to 6/10 with prolonged standing. States compliance with home exercise program at 80%.',
    Objective:
      'Lumbar AROM: Flexion 60°, Extension 15°. Hip strength: R hip abductors 4/5. Gait: Decreased lateral trunk sway. Manual therapy to lumbar spine 15 min, therapeutic exercises 20 min.',
    Assessment:
      'Patient demonstrates continued progress toward functional goals. Improved lumbar ROM and hip strength correlate with reported functional improvements.',
    Plan: 'Continue PT 2x/week for 3 weeks. Progress hip strengthening. Update HEP.',
  };

  const content: NoteSection[] = template.sections
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((section) => ({
      sectionId: section.id,
      title: section.title,
      content: mockSections[section.title] ?? '',
    }));

  const outputChars = content.reduce((acc, s) => acc + s.content.length, 0);

  return {
    content,
    billing: {
      suggestedCodes: [
        { cptCode: '97140', description: 'Manual Therapy' },
        { cptCode: '97110', description: 'Therapeutic Exercise' },
      ],
    },
    hallucinationIssues: [],
    metadata: {
      model: `mock-${config.LLM_PROVIDER}`,
      inputTokens: Math.ceil(quickNotesLength / 4),
      outputTokens: Math.ceil(outputChars / 4),
      totalTokens: Math.ceil(quickNotesLength / 4) + Math.ceil(outputChars / 4),
      generationTimeMs: 0,
    },
    securityMetadata: { suspiciousPatternDetected: false, suspiciousPatternCount: 0 },
  };
}

export interface GenerateNoteInput {
  quickNotes: string;
  noteType: NoteType;
  /** Loaded template with user style overrides already applied. */
  template: NoteTemplateWithSections;
  /** Patient persistent context (server-loaded snapshot) or null. */
  patientContext: string | null;
}

/**
 * Generate a clinical note (template-driven — Plan 04-03).
 *
 * Orchestrates prompt assembly (system + user), security detection, the LLM
 * call, and post-generation hallucination detection. Does NOT handle auth,
 * rate limiting, usage tracking, persistence, or audit — those are the
 * Server Action's responsibility.
 *
 * @throws {LLMError} on LLM failures (rate limit, content blocked, timeout, etc.)
 */
export async function generateNote(
  input: GenerateNoteInput,
): Promise<GeneratedNoteResult> {
  // SECURITY (MEDIUM-005): Detect suspicious patterns for monitoring
  // This is detection-only; we do NOT block requests based on this
  const quickNotesDetection = detectSuspiciousPatterns(input.quickNotes);
  const contextDetection = input.patientContext
    ? detectSuspiciousPatterns(input.patientContext)
    : { detected: false, count: 0 };

  const securityMetadata: PromptSecurityMetadata = {
    suspiciousPatternDetected: quickNotesDetection.detected || contextDetection.detected,
    suspiciousPatternCount: quickNotesDetection.count + contextDetection.count,
  };

  // Mock AI for development/testing (production guard above prevents misuse)
  if (config.USE_MOCK_AI) {
    return { ...generateMockNote(input.template, input.quickNotes.length), securityMetadata };
  }

  const startTime = Date.now();

  const systemPrompt = getSystemPrompt();
  const userPrompt = assembleUserPrompt({
    noteType: input.noteType,
    sections: input.template.sections,
    quickNotes: input.quickNotes,
    patientContext: input.patientContext,
  });

  const provider = getConfiguredProvider({
    provider: config.LLM_PROVIDER,
    geminiApiKey: config.GEMINI_API_KEY,
    geminiModel: config.GEMINI_MODEL,
    geminiApiUrl: config.GEMINI_API_URL,
    geminiUseADC: config.GEMINI_USE_ADC,
    claudeApiKey: config.ANTHROPIC_API_KEY,
    claudeModel: config.ANTHROPIC_MODEL,
  });

  const requestConfig = getRequestConfig();
  const result = await provider.generatePTNote(systemPrompt, userPrompt, requestConfig);
  const generationTimeMs = Date.now() - startTime;

  const sections = mapResponseToSections(input.template, {
    subjective: result.note.subjective,
    objective: result.note.objective,
    assessment: result.note.assessment,
    plan: result.note.plan,
  });

  const hallucinationIssues = detectHallucinations(
    input.quickNotes,
    sections.map((s) => ({ title: s.title, content: s.content })),
  );

  return {
    content: sections,
    billing: result.note.billing,
    goals: result.note.goals,
    alerts: result.note.alerts,
    uncertainAreas: result.note.uncertainAreas,
    hallucinationIssues,
    metadata: {
      model: provider.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
      generationTimeMs,
    },
    securityMetadata,
  };
}
