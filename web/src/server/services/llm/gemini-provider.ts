import 'server-only';

/**
 * Gemini LLM Provider implementation.
 *
 * Uses Gemini's JSON mode with response schema for structured output.
 * Handles Gemini-specific response formats, error codes, and retry logic.
 */

import { logger } from '@/server/lib/logger';
import { BaseLLMProvider } from './provider';
import type { LLMProviderType, LLMRequestConfig, LLMRetryConfig, PTNoteResult } from './types';
import {
  LLMError,
  RateLimitError,
  AuthenticationError,
  InvalidRequestError,
  ContentBlockedError,
  OutputTruncatedError,
  TimeoutError,
  NetworkError,
  ProviderError,
  ParseError,
} from './errors';
import { getPTNoteJsonSchema, validatePTNoteOutput, type PTNoteOutput } from './schemas';
import { z } from 'zod';

// Zod schemas for runtime validation of Gemini API responses (Rule 3)
const GeminiErrorSchema = z.object({
  code: z.number().optional(),
  message: z.string().optional(),
  status: z.string().optional(),
});

const GeminiCandidateSchema = z.object({
  content: z.object({
    parts: z.array(z.object({ text: z.string().optional() })).optional(),
  }).optional(),
  finishReason: z.string().optional(),
});

const GeminiUsageSchema = z.object({
  promptTokenCount: z.number().optional(),
  candidatesTokenCount: z.number().optional(),
  totalTokenCount: z.number().optional(),
});

const GeminiResponseSchema = z.object({
  candidates: z.array(GeminiCandidateSchema).optional(),
  usageMetadata: GeminiUsageSchema.optional(),
  error: GeminiErrorSchema.optional(),
});

type GeminiResponse = z.infer<typeof GeminiResponseSchema>;

// Schema for GCP metadata server ADC token response
const ADCTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  token_type: z.string().optional(),
});

/**
 * PROMPT-01 — Explicit Gemini safety settings (Plan 04-03 Task 1).
 *
 * Every generateContent request sends this array so Gemini applies the clinician-
 * appropriate threshold instead of its (unstable) defaults. BLOCK_ONLY_HIGH is
 * chosen because BLOCK_MEDIUM_AND_ABOVE false-positives on routine clinical content
 * (pain descriptions, anatomical references, treatment narratives).
 *
 * Rationale: see .planning/phases/04-phi-storage/04-RESEARCH.md §7.1.
 *
 * m-7 — If Vertex AI ever rejects the string literal 'BLOCK_ONLY_HIGH' with a 400
 * Bad Request, switch this constant to the SDK enum form
 * ({ category: HarmCategory.HARM_CATEGORY_*, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH })
 * from @google-cloud/vertexai — DO NOT drop the setting, DO NOT downgrade to
 * 'OFF' or 'BLOCK_NONE'. The threshold must remain BLOCK_ONLY_HIGH (or enum equivalent).
 */
const GEMINI_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
] as const;

export interface GeminiProviderConfig {
  /** API key for direct Gemini API auth. Required unless useADC is true. */
  apiKey?: string;
  model: string;
  apiUrl: string;
  /**
   * Use Application Default Credentials (ADC) for Vertex AI auth.
   * When true, authenticates via service account bearer token instead of API key.
   * Required for production (Vertex AI on Cloud Run).
   */
  useADC?: boolean;
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
      result[key] = value.toUpperCase();
    } else if (key === '$schema' || key === 'additionalProperties' || key === '$ref' || key === 'definitions') {
      continue;
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        result[key] = value.map((item: unknown): unknown =>
          typeof item === 'object' && item !== null
            ? convertToGeminiSchema(item as Record<string, unknown>)
            : item,
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

export class GeminiProvider extends BaseLLMProvider {
  readonly name: LLMProviderType = 'gemini';
  readonly model: string;

  private readonly apiKey: string | undefined;
  private readonly apiUrl: string;
  private readonly useADC: boolean;
  private readonly geminiSchema: Record<string, unknown>;

  constructor(config: GeminiProviderConfig) {
    super(config.retryConfig);
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.apiUrl = config.apiUrl;
    this.useADC = config.useADC ?? false;
    this.geminiSchema = convertToGeminiSchema(getPTNoteJsonSchema());

    if (!this.useADC && !this.apiKey) {
      throw new Error('GeminiProvider requires either apiKey or useADC=true');
    }
  }

  protected async doGeneratePTNote(
    systemPrompt: string,
    userPrompt: string,
    config: LLMRequestConfig,
  ): Promise<PTNoteResult> {
    const url = `${this.apiUrl}/models/${this.model}:generateContent`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.useADC) {
      const token = await this.getADCToken();
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['x-goog-api-key'] = this.apiKey!;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: config.maxTokens,
            temperature: config.temperature,
            responseMimeType: 'application/json',
            responseSchema: this.geminiSchema,
          },
          // PROMPT-01: explicit safety thresholds — top-level sibling per Vertex AI spec.
          safetySettings: GEMINI_SAFETY_SETTINGS,
        }),
        signal: controller.signal,
      });

      const rawJson: unknown = await response.json();
      clearTimeout(timeoutId);

      const parseResult = GeminiResponseSchema.safeParse(rawJson);
      if (!parseResult.success) {
        throw new ParseError(this.name, 'Unexpected Gemini API response structure');
      }
      const data = parseResult.data;

      if (!response.ok) {
        throw this.handleHttpError(response.status, response.headers, data);
      }

      if (data.error) {
        throw this.handleApiError(data.error);
      }

      const finishReason = data.candidates?.[0]?.finishReason;

      // Fail closed: only STOP is a valid completion for clinical notes.
      // RECITATION = copyright cutoff, OTHER = unknown, FINISH_REASON_UNSPECIFIED = unknown.
      // All produce unreliable content that must not be returned as a PT note.
      if (finishReason === 'SAFETY') {
        throw new ContentBlockedError(this.name);
      }
      if (finishReason === 'MAX_TOKENS') {
        throw new OutputTruncatedError(this.name);
      }
      if (finishReason && finishReason !== 'STOP') {
        // RECITATION (copyright), OTHER, FINISH_REASON_UNSPECIFIED — all produce
        // unreliable content. Not retryable (deterministic from the same input).
        throw new ContentBlockedError(this.name);
      }

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new ParseError(this.name, 'Empty response from Gemini');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        throw new ParseError(
          this.name,
          'Invalid JSON in Gemini response',
          e instanceof Error ? e : undefined,
        );
      }

      let note: PTNoteOutput;
      try {
        note = validatePTNoteOutput(parsed);
      } catch (e) {
        throw new ParseError(
          this.name,
          'Response does not match expected schema',
          e instanceof Error ? e : undefined,
        );
      }

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
   * Fetch an access token via Application Default Credentials (ADC).
   *
   * On Cloud Run, this hits the instance metadata server to get a short-lived
   * OAuth2 token from the service account. The token is cached and refreshed
   * 60 seconds before expiry.
   */
  private adcTokenCache: { token: string; expiresAt: number } | null = null;

  private async getADCToken(): Promise<string> {
    const now = Date.now();
    if (this.adcTokenCache && this.adcTokenCache.expiresAt > now + 60_000) {
      return this.adcTokenCache.token;
    }

    const metadataUrl =
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

    const response = await fetch(metadataUrl, {
      headers: { 'Metadata-Flavor': 'Google' },
    });

    if (!response.ok) {
      throw new AuthenticationError(this.name);
    }

    const tokenData = ADCTokenResponseSchema.safeParse(await response.json());
    if (!tokenData.success) {
      throw new AuthenticationError(this.name);
    }

    this.adcTokenCache = {
      token: tokenData.data.access_token,
      expiresAt: now + tokenData.data.expires_in * 1000,
    };

    return this.adcTokenCache.token;
  }

  private handleHttpError(status: number, headers: Headers, data: GeminiResponse): LLMError {
    // SECURITY: Never log raw error body - may echo back PHI from request
    logger.error({ source: 'llm_gemini', errorType: 'http_error', status }, 'Gemini API HTTP error');

    const retryAfter = this.parseRetryAfter(headers.get('retry-after'));

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
        return new ProviderError(this.name, status);
      default:
        return new ProviderError(this.name, status);
    }
  }

  private handleApiError(error: NonNullable<GeminiResponse['error']>): LLMError {
    // SECURITY: Never log error message - may contain PHI
    logger.error({ source: 'llm_gemini', errorType: 'api_error', code: error.code, status: error.status }, 'Gemini API error');

    if (error.status === 'RESOURCE_EXHAUSTED') {
      return new RateLimitError(this.name);
    }

    if (error.code === 400) {
      return new InvalidRequestError(this.name, error.status);
    }

    return new ProviderError(this.name, error.code);
  }

}
