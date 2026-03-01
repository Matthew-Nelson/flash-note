import 'server-only';

import { config, isProduction } from '@/server/db/config';
import { getSystemPrompt, buildUserPrompt } from '@/server/prompts/pt-prompts';
import { detectSuspiciousPatterns } from '@/server/lib/prompt-sanitization';
import {
  getConfiguredProvider,
  type LLMRequestConfig,
  type BillingSummary,
  type GoalsTracking,
} from '@/server/services/llm';
import type { NoteType } from '@/lib/types';

/**
 * Security metadata for audit purposes (MEDIUM-005).
 * Tracks whether prompt injection patterns were detected in user input.
 */
export interface PromptSecurityMetadata {
  suspiciousPatternDetected: boolean;
  suspiciousPatternCount: number;
}

/**
 * Full internal result from note generation.
 * The Server Action strips sensitive fields before returning to the client.
 */
export interface GeneratedNoteResult {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  billing?: BillingSummary;
  goals?: GoalsTracking;
  alerts?: string[];
  uncertainAreas?: string[];
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
 * Generate a mock SOAP note for development/testing.
 * Returns a realistic fixture response without calling any LLM API.
 */
function generateMockNote(_noteType: NoteType, quickNotesLength: number): GeneratedNoteResult {
  const mockSections = {
    subjective: 'Patient reports pain level of 4/10 at rest, increasing to 6/10 with prolonged standing. States compliance with home exercise program at 80%.',
    objective: 'Lumbar AROM: Flexion 60°, Extension 15°. Hip strength: R hip abductors 4/5. Gait: Decreased lateral trunk sway. Manual therapy to lumbar spine 15 min, therapeutic exercises 20 min.',
    assessment: 'Patient demonstrates continued progress toward functional goals. Improved lumbar ROM and hip strength correlate with reported functional improvements.',
    plan: 'Continue PT 2x/week for 3 weeks. Progress hip strengthening. Update HEP.',
  };

  const outputChars = Object.values(mockSections).join('').length;

  return {
    ...mockSections,
    billing: {
      suggestedCodes: [
        { cptCode: '97140', description: 'Manual Therapy' },
        { cptCode: '97110', description: 'Therapeutic Exercise' },
      ],
    },
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

/**
 * Generate a PT SOAP note from clinician input.
 *
 * Orchestrates prompt building, security detection, and LLM call.
 * Does NOT handle auth, rate limiting, usage tracking, or audit — those
 * are the Server Action's responsibility.
 *
 * @throws {LLMError} on LLM failures (rate limit, content blocked, timeout, etc.)
 */
export async function generateNote(
  quickNotes: string,
  noteType: NoteType,
  patientContext?: string
): Promise<GeneratedNoteResult> {
  // SECURITY (MEDIUM-005): Detect suspicious patterns for monitoring
  // This is detection-only; we do NOT block requests based on this
  const quickNotesDetection = detectSuspiciousPatterns(quickNotes);
  const contextDetection = patientContext
    ? detectSuspiciousPatterns(patientContext)
    : { detected: false, count: 0 };

  const securityMetadata: PromptSecurityMetadata = {
    suspiciousPatternDetected: quickNotesDetection.detected || contextDetection.detected,
    suspiciousPatternCount: quickNotesDetection.count + contextDetection.count,
  };

  // Mock AI for development/testing (production guard above prevents misuse)
  if (config.USE_MOCK_AI) {
    return { ...generateMockNote(noteType, quickNotes.length), securityMetadata };
  }

  const startTime = Date.now();

  const systemPrompt = getSystemPrompt();
  const userPrompt = buildUserPrompt(quickNotes, noteType, patientContext);

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

  return {
    subjective: result.note.subjective,
    objective: result.note.objective,
    assessment: result.note.assessment,
    plan: result.note.plan,
    billing: result.note.billing,
    goals: result.note.goals,
    alerts: result.note.alerts,
    uncertainAreas: result.note.uncertainAreas,
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
