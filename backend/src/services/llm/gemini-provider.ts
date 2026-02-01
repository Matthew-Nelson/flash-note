/**
 * Gemini LLM Provider implementation.
 *
 * Uses Gemini's JSON mode with response schema for structured output.
 * Handles Gemini-specific response formats, error codes, and retry logic.
 */

import { BaseLLMProvider } from './provider.js';
import type { LLMProviderType, LLMCompletionResult, LLMRequestConfig, LLMFinishReason, LLMRetryConfig, PTNoteResult } from './types.js';
import {
  LLMError,
  RateLimitError,
  OverloadedError,
  AuthenticationError,
  InvalidRequestError,
  ContentBlockedError,
  OutputTruncatedError,
  TimeoutError,
  NetworkError,
  ProviderError,
  ParseError,
} from './errors.js';
import { getPTNoteJsonSchema, validatePTNoteOutput, type PTNoteOutput } from './schemas.js';

/**
 * Gemini API response structure.
 */
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: GeminiFinishReason;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

/**
 * Gemini finish reasons.
 */
type GeminiFinishReason =
  | 'STOP'
  | 'MAX_TOKENS'
  | 'SAFETY'
  | 'RECITATION'
  | 'OTHER'
  | 'FINISH_REASON_UNSPECIFIED';

/**
 * Configuration for Gemini provider.
 */
export interface GeminiProviderConfig {
  apiKey: string;
  model: string;
  apiUrl?: string;
  retryConfig?: LLMRetryConfig;
}

/**
 * Convert JSON Schema types to Gemini's OpenAPI-style format.
 *
 * Gemini expects uppercase type names (OBJECT, STRING, etc.)
 * and has specific format requirements.
 */
function convertToGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === 'type' && typeof value === 'string') {
      // Convert lowercase type to uppercase for Gemini
      result[key] = value.toUpperCase();
    } else if (key === '$schema' || key === 'additionalProperties' || key === '$ref' || key === 'definitions') {
      // Skip JSON Schema specific keys that Gemini doesn't support
      continue;
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        result[key] = value.map((item: unknown): unknown =>
          typeof item === 'object' && item !== null
            ? convertToGeminiSchema(item as Record<string, unknown>)
            : item
        );
      } else {
        result[key] = convertToGeminiSchema(value as Record<string, unknown>);
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Gemini LLM provider using JSON mode for structured output.
 */
export class GeminiProvider extends BaseLLMProvider {
  readonly name: LLMProviderType = 'gemini';
  readonly model: string;

  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly geminiSchema: Record<string, unknown>;

  constructor(config: GeminiProviderConfig) {
    super(config.retryConfig);
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.apiUrl = config.apiUrl ?? 'https://generativelanguage.googleapis.com/v1beta';

    // Pre-convert schema to Gemini format
    this.geminiSchema = convertToGeminiSchema(getPTNoteJsonSchema());
  }

  /**
   * Generate a structured PT note using Gemini's JSON mode.
   */
  protected async doGeneratePTNote(
    prompt: string,
    config: LLMRequestConfig
  ): Promise<PTNoteResult> {
    const url = `${this.apiUrl}/models/${this.model}:generateContent`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

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
            maxOutputTokens: config.maxTokens,
            temperature: config.temperature,
            responseMimeType: 'application/json',
            responseSchema: this.geminiSchema,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await response.json()) as GeminiResponse;

      // Handle HTTP errors
      if (!response.ok) {
        throw this.handleHttpError(response.status, data);
      }

      // Handle API-level errors
      if (data.error) {
        throw this.handleApiError(data.error);
      }

      // Check finish reason (affects error handling for parse failures)
      const finishReason = data.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY') {
        throw new ContentBlockedError(this.name);
      }

      // For MAX_TOKENS with no content, throw immediately
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (finishReason === 'MAX_TOKENS' && !content) {
        throw new OutputTruncatedError(this.name);
      }

      if (!content) {
        throw new ParseError(this.name, 'Empty response from Gemini');
      }

      // Parse and validate JSON response
      // If parsing fails due to truncation, provide better error context
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        // If output was truncated, the JSON is likely incomplete
        if (finishReason === 'MAX_TOKENS') {
          throw new OutputTruncatedError(this.name, e instanceof Error ? e : undefined);
        }
        throw new ParseError(
          this.name,
          'Invalid JSON in Gemini response',
          e instanceof Error ? e : undefined
        );
      }

      // Validate against schema
      let note: PTNoteOutput;
      try {
        note = validatePTNoteOutput(parsed);
      } catch (e) {
        // Schema validation failure on truncated output
        if (finishReason === 'MAX_TOKENS') {
          throw new OutputTruncatedError(this.name, e instanceof Error ? e : undefined);
        }
        throw new ParseError(
          this.name,
          'Response does not match expected schema',
          e instanceof Error ? e : undefined
        );
      }

      // Extract token usage
      const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

      return {
        note,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LLMError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(this.name, config.timeoutMs);
        }
        throw new NetworkError(this.name, error);
      }

      throw new NetworkError(this.name);
    }
  }

  /**
   * Generate a raw text completion (non-structured).
   */
  protected async doGenerateCompletion(
    prompt: string,
    config: LLMRequestConfig
  ): Promise<LLMCompletionResult> {
    const url = `${this.apiUrl}/models/${this.model}:generateContent`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

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
            maxOutputTokens: config.maxTokens,
            temperature: config.temperature,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await response.json()) as GeminiResponse;

      // Handle HTTP errors
      if (!response.ok) {
        throw this.handleHttpError(response.status, data);
      }

      // Handle API-level errors
      if (data.error) {
        throw this.handleApiError(data.error);
      }

      // Extract content
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const finishReason = this.mapFinishReason(data.candidates?.[0]?.finishReason);

      return {
        content,
        finishReason,
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
        },
        model: this.model,
        provider: this.name,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LLMError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(this.name, config.timeoutMs);
        }
        throw new NetworkError(this.name, error);
      }

      throw new NetworkError(this.name);
    }
  }

  /**
   * Handle HTTP-level errors from Gemini API.
   */
  private handleHttpError(status: number, data: GeminiResponse): LLMError {
    // SECURITY: Never log raw error body - may echo back PHI from request
    console.error('Gemini API HTTP error:', { status });

    const retryAfter = undefined; // Gemini doesn't use Retry-After header consistently

    switch (status) {
      case 400:
        return new InvalidRequestError(this.name, data.error?.status);
      case 401:
      case 403:
        return new AuthenticationError(this.name);
      case 429:
        return new RateLimitError(this.name, retryAfter);
      case 500:
      case 502:
      case 503:
        return new OverloadedError(this.name, retryAfter);
      default:
        return new ProviderError(this.name, status);
    }
  }

  /**
   * Handle API-level errors embedded in response.
   */
  private handleApiError(error: NonNullable<GeminiResponse['error']>): LLMError {
    // SECURITY: Never log error message - may contain PHI
    console.error('Gemini API error:', { code: error.code, status: error.status });

    if (error.status === 'RESOURCE_EXHAUSTED') {
      return new RateLimitError(this.name);
    }

    if (error.code === 400) {
      return new InvalidRequestError(this.name, error.status);
    }

    return new ProviderError(this.name, error.code);
  }

  /**
   * Map Gemini finish reason to unified format.
   */
  private mapFinishReason(reason?: GeminiFinishReason): LLMFinishReason {
    switch (reason) {
      case 'STOP':
        return 'complete';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
      case 'RECITATION':
        return 'content_filter';
      default:
        return 'error';
    }
  }

  /**
   * Health check - verify API key is valid.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.apiUrl}/models/${this.model}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-goog-api-key': this.apiKey,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
