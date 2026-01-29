import { config, isProduction } from '../config.js';
import { buildSOAPPrompt, parseSOAPSections } from '../prompts/pt-prompts.js';
import { AppError } from '../middleware/error-handler.js';
import { generateMockSOAPNote } from './mock-ai-service.js';
import type { GeneratedNote, NoteType } from '../types/index.js';

// SECURITY: Prevent mock AI from being used in production
// This could result in fake clinical notes that could harm patients
if (isProduction && config.USE_MOCK_AI) {
  throw new Error(
    'SECURITY ERROR: USE_MOCK_AI cannot be enabled in production. ' +
    'Mock responses could generate fake clinical notes that harm patients.'
  );
}

// TODO: This service is currently Gemini-specific. If experimenting with other LLM
// providers (Claude, OpenAI, etc.), consider:
// - Extracting a common LLMProvider interface
// - Renaming GeminiResponse to a generic LLMResponse or creating provider-specific types
// - Moving provider-specific logic (API URLs, auth headers, response parsing) into
//   separate adapter classes
// - Updating config to support provider selection
// The error logging is already provider-agnostic (see SECURITY comments below).

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

class AIService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly timeout: number;

  constructor() {
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.apiKey = config.GEMINI_API_KEY;
    this.model = config.GEMINI_MODEL;
    this.maxTokens = config.GEMINI_MAX_TOKENS;
    this.temperature = config.GEMINI_TEMPERATURE;
    this.timeout = config.GEMINI_TIMEOUT_MS;
  }

  async generateSOAPNote(
    quickNotes: string,
    noteType: NoteType,
    patientContext?: string
  ): Promise<GeneratedNote> {
    // Use mock response in development when USE_MOCK_AI is enabled
    if (config.USE_MOCK_AI) {
      return generateMockSOAPNote(quickNotes, noteType, patientContext);
    }

    const startTime = Date.now();

    const prompt = buildSOAPPrompt(quickNotes, noteType, patientContext);

    const response = await this.callGemini(prompt);
    const generationTimeMs = Date.now() - startTime;

    const content = response.candidates[0]?.content?.parts[0]?.text;
    if (!content) {
      throw new AppError(500, 'ai_error', 'Failed to generate note: empty response');
    }

    const sections = parseSOAPSections(content);

    return {
      ...sections,
      metadata: {
        model: this.model,
        tokensUsed: response.usageMetadata.totalTokenCount,
        generationTimeMs,
      },
    };
  }

  private async callGemini(prompt: string): Promise<GeminiResponse> {
    // SECURITY: API key moved to header instead of URL to prevent logging exposure
    const url = `${this.apiUrl}/models/${this.model}:generateContent`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: this.maxTokens,
            temperature: this.temperature,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // SECURITY: Never log raw error response body from LLM APIs.
        // Error responses may echo back portions of the request, which contains PHI.
        // This principle applies regardless of LLM provider (Gemini, Claude, OpenAI, etc.)
        console.error('LLM API error:', {
          status: response.status,
          statusText: response.statusText,
        });
        throw new AppError(500, 'ai_error', 'Failed to generate note');
      }

      return (await response.json()) as GeminiResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AppError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError(500, 'ai_error', 'Note generation timed out');
      }

      // SECURITY: Log only error type/message, not full error object.
      // Full error objects may contain request details including PHI.
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('LLM service error:', { type: error instanceof Error ? error.name : 'Unknown', message: errorMessage });
      throw new AppError(500, 'ai_error', 'Failed to generate note');
    }
  }
}

export const aiService = new AIService();
