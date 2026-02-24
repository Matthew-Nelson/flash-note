import * as Sentry from '@sentry/node';
import { config, isProduction } from '../config.js';
import { getSystemPrompt, buildUserPrompt } from '../prompts/pt-prompts.js';
import { AppError } from '../middleware/error-handler.js';
import { generateMockSOAPNote } from './mock-ai-service.js';
import { detectSuspiciousPatterns } from '../utils/prompt-sanitization.js';
import type { GeneratedNote, NoteType, PromptSecurityMetadata } from '../types/index.js';
import {
  getConfiguredProvider,
  LLMError,
  type LLMProvider,
  type LLMRequestConfig,
} from './llm/index.js';

// SECURITY: Prevent mock AI from being used in production
// This could result in fake clinical notes that could harm patients
if (isProduction && config.USE_MOCK_AI) {
  throw new Error(
    'SECURITY ERROR: USE_MOCK_AI cannot be enabled in production. ' +
    'Mock responses could generate fake clinical notes that harm patients.'
  );
}

/**
 * AI Service for generating PT SOAP notes.
 *
 * Uses the unified LLM provider abstraction to support multiple providers
 * (Gemini, Claude) with consistent response handling and retry logic.
 */
class AIService {
  private readonly provider: LLMProvider;
  private readonly requestConfig: LLMRequestConfig;

  constructor() {
    // Initialize the configured LLM provider
    this.provider = getConfiguredProvider({
      provider: config.LLM_PROVIDER,
      geminiApiKey: config.GEMINI_API_KEY,
      geminiModel: config.GEMINI_MODEL,
      claudeApiKey: config.ANTHROPIC_API_KEY,
      claudeModel: config.ANTHROPIC_MODEL,
    });

    // Set up request configuration based on provider
    if (config.LLM_PROVIDER === 'gemini') {
      this.requestConfig = {
        maxTokens: config.GEMINI_MAX_TOKENS,
        temperature: config.GEMINI_TEMPERATURE,
        timeoutMs: config.GEMINI_TIMEOUT_MS,
      };
    } else {
      this.requestConfig = {
        maxTokens: config.ANTHROPIC_MAX_TOKENS,
        temperature: config.ANTHROPIC_TEMPERATURE,
        timeoutMs: config.ANTHROPIC_TIMEOUT_MS,
      };
    }
  }

  /**
   * Generate a SOAP note from quick notes.
   *
   * Uses structured JSON output from the LLM provider (JSON mode for Gemini,
   * tool use for Claude) for reliable parsing.
   *
   * @param quickNotes - The clinician's shorthand notes
   * @param noteType - The type of note (daily, initial eval, progress, discharge)
   * @param patientContext - Optional patient context
   * @returns Generated note with SOAP sections, billing info, and metadata
   */
  async generateSOAPNote(
    quickNotes: string,
    noteType: NoteType,
    patientContext?: string
  ): Promise<GeneratedNote> {
    // SECURITY (MEDIUM-005): Detect suspicious patterns for monitoring
    // This is detection-only; we do NOT block requests based on this
    // XML delimiters in buildUserPrompt provide the actual protection
    const quickNotesDetection = detectSuspiciousPatterns(quickNotes);
    const contextDetection = patientContext
      ? detectSuspiciousPatterns(patientContext)
      : { detected: false, count: 0 };

    const securityMetadata: PromptSecurityMetadata = {
      suspiciousPatternDetected: quickNotesDetection.detected || contextDetection.detected,
      suspiciousPatternCount: quickNotesDetection.count + contextDetection.count,
    };

    // Use mock response in development when USE_MOCK_AI is enabled
    if (config.USE_MOCK_AI) {
      const mockResult = await generateMockSOAPNote(quickNotes, noteType, patientContext);
      return { ...mockResult, securityMetadata };
    }

    const startTime = Date.now();

    const systemPrompt = getSystemPrompt();
    const userPrompt = buildUserPrompt(quickNotes, noteType, patientContext);

    try {
      const result = await this.provider.generatePTNote(systemPrompt, userPrompt, this.requestConfig);
      const generationTimeMs = Date.now() - startTime;

      return {
        // Core SOAP sections
        subjective: result.note.subjective,
        objective: result.note.objective,
        assessment: result.note.assessment,
        plan: result.note.plan,

        // Structured billing reference (optional)
        billing: result.note.billing,

        // Goal tracking (optional)
        goals: result.note.goals,

        // Alerts for the therapist (optional)
        alerts: result.note.alerts,

        // Uncertainty signals (optional)
        uncertainAreas: result.note.uncertainAreas,

        // Metadata
        metadata: {
          model: this.provider.model,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
          generationTimeMs,
        },
        securityMetadata,
      };
    } catch (error) {
      // Map LLM errors to AppError for HTTP response
      if (error instanceof LLMError) {
        throw this.mapLLMErrorToAppError(error);
      }
      throw error;
    }
  }

  /**
   * Map LLMError to AppError for HTTP responses.
   *
   * SECURITY: Error messages are kept generic to avoid leaking internal details.
   */
  private mapLLMErrorToAppError(error: LLMError): AppError {
    // SECURITY: Log only safe error details (no PHI)
    console.error('LLM error:', error.toSafeLogObject());

    // Capture to Sentry for visibility into LLM failures (core product feature)
    // Rate limited errors are excluded as they occur during normal operation
    if (error.code !== 'rate_limited') {
      Sentry.captureException(error, {
        extra: {
          source: 'ai_service',
          errorCode: error.code,
          provider: config.LLM_PROVIDER,
          model: this.provider.model,
        },
      });
    }

    switch (error.code) {
      case 'rate_limited':
        return new AppError(429, 'ai_rate_limited', 'AI service is temporarily rate limited. Please try again.');

      case 'content_blocked':
        return new AppError(422, 'ai_content_blocked', 'Unable to process this content. Please modify and try again.');

      case 'output_truncated':
        return new AppError(500, 'ai_error', 'Generated note was truncated. Please try with shorter input.');

      case 'auth_error':
        return new AppError(500, 'ai_config_error', 'AI service configuration error. Please contact support.');

      case 'timeout':
        return new AppError(504, 'ai_timeout', 'Note generation timed out. Please try again.');

      case 'network_error':
      case 'overloaded':
      case 'provider_error':
        return new AppError(502, 'ai_unavailable', 'AI service is temporarily unavailable. Please try again.');

      case 'invalid_request':
      case 'parse_error':
      default:
        return new AppError(500, 'ai_error', 'Failed to generate note');
    }
  }
}

export const aiService = new AIService();
