/**
 * Claude LLM Provider implementation.
 *
 * Uses Claude's tool use feature for structured output by forcing the model
 * to call a specific tool with a defined input schema.
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
 * Claude API response structure.
 */
interface ClaudeResponse {
  id?: string;
  type?: string;
  role?: string;
  content?: Array<ClaudeContentBlock>;
  model?: string;
  stop_reason?: ClaudeStopReason;
  stop_sequence?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: ClaudeErrorObject;
}

/**
 * Claude content block types.
 */
type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown };

/**
 * Claude stop reasons.
 */
type ClaudeStopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'stop_sequence'
  | 'tool_use'
  | 'pause_turn'
  | 'refusal';

/**
 * Claude error object in response.
 */
interface ClaudeErrorObject {
  type: string;
  message: string;
}

/**
 * Configuration for Claude provider.
 */
export interface ClaudeProviderConfig {
  apiKey: string;
  model: string;
  apiUrl?: string;
  apiVersion?: string;
  retryConfig?: LLMRetryConfig;
}

/**
 * Tool name for PT note generation.
 */
const PT_NOTE_TOOL_NAME = 'generate_pt_note';

/**
 * Claude LLM provider using tool use for structured output.
 */
export class ClaudeProvider extends BaseLLMProvider {
  readonly name: LLMProviderType = 'claude';
  readonly model: string;

  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly apiVersion: string;
  private readonly ptNoteJsonSchema: Record<string, unknown>;

  constructor(config: ClaudeProviderConfig) {
    super(config.retryConfig);
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.apiUrl = config.apiUrl ?? 'https://api.anthropic.com';
    this.apiVersion = config.apiVersion ?? '2023-06-01';

    // Pre-compute JSON schema for tool definition
    this.ptNoteJsonSchema = getPTNoteJsonSchema();
  }

  /**
   * Generate a structured PT note using Claude's tool use.
   */
  protected async doGeneratePTNote(
    systemPrompt: string,
    userPrompt: string,
    config: LLMRequestConfig
  ): Promise<PTNoteResult> {
    const url = `${this.apiUrl}/v1/messages`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          system: systemPrompt,
          tools: [
            {
              name: PT_NOTE_TOOL_NAME,
              description:
                'Generate a structured physical therapy SOAP note with billing information, ' +
                'goal tracking, and clinical alerts. This tool MUST be used to output the note.',
              input_schema: this.ptNoteJsonSchema,
            },
          ],
          tool_choice: {
            type: 'tool',
            name: PT_NOTE_TOOL_NAME,
          },
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await response.json()) as ClaudeResponse;

      // Handle HTTP errors
      if (!response.ok) {
        throw this.handleHttpError(response.status, response.headers, data);
      }

      // Handle API-level errors
      if (data.error) {
        throw this.handleApiError(data.error);
      }

      // Check stop reason (affects error handling for parse failures)
      const stopReason = data.stop_reason;
      if (stopReason === 'refusal') {
        throw new ContentBlockedError(this.name);
      }

      // Find the tool_use block
      const toolUseBlock = data.content?.find(
        (block): block is Extract<ClaudeContentBlock, { type: 'tool_use' }> =>
          block.type === 'tool_use' && block.name === PT_NOTE_TOOL_NAME
      );

      // If no tool_use block and output was truncated, provide better error context
      if (!toolUseBlock) {
        if (stopReason === 'max_tokens') {
          throw new OutputTruncatedError(this.name);
        }
        throw new ParseError(this.name, 'No tool_use block in Claude response');
      }

      // Validate against schema
      let note: PTNoteOutput;
      try {
        note = validatePTNoteOutput(toolUseBlock.input);
      } catch (e) {
        // Schema validation failure on truncated output
        if (stopReason === 'max_tokens') {
          throw new OutputTruncatedError(this.name, e instanceof Error ? e : undefined);
        }
        throw new ParseError(
          this.name,
          'Tool input does not match expected schema',
          e instanceof Error ? e : undefined
        );
      }

      // Extract token usage
      const inputTokens = data.usage?.input_tokens ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;

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
    const url = `${this.apiUrl}/v1/messages`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await response.json()) as ClaudeResponse;

      // Handle HTTP errors
      if (!response.ok) {
        throw this.handleHttpError(response.status, response.headers, data);
      }

      // Handle API-level errors
      if (data.error) {
        throw this.handleApiError(data.error);
      }

      // Extract text content
      const textBlock = data.content?.find(
        (block): block is Extract<ClaudeContentBlock, { type: 'text' }> =>
          block.type === 'text'
      );

      const content = textBlock?.text ?? '';
      const finishReason = this.mapStopReason(data.stop_reason);

      return {
        content,
        finishReason,
        usage: {
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0,
          totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
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
   * Handle HTTP-level errors from Claude API.
   */
  private handleHttpError(status: number, headers: Headers, data: ClaudeResponse): LLMError {
    // SECURITY: Never log raw error body - may echo back PHI from request
    console.error('Claude API HTTP error:', { status });

    const retryAfter = this.parseRetryAfter(headers.get('retry-after'));

    switch (status) {
      case 400:
        return new InvalidRequestError(this.name, data.error?.type);
      case 401:
      case 403:
        return new AuthenticationError(this.name);
      case 429:
        return new RateLimitError(this.name, retryAfter);
      case 529:
        return new OverloadedError(this.name, retryAfter);
      case 500:
      case 502:
      case 503:
        return new ProviderError(this.name, status);
      default:
        return new ProviderError(this.name, status);
    }
  }

  /**
   * Handle API-level errors embedded in response.
   */
  private handleApiError(error: ClaudeErrorObject): LLMError {
    // SECURITY: Never log error message - may contain PHI
    console.error('Claude API error:', { type: error.type });

    switch (error.type) {
      case 'invalid_request_error':
        return new InvalidRequestError(this.name, error.type);
      case 'authentication_error':
        return new AuthenticationError(this.name);
      case 'rate_limit_error':
        return new RateLimitError(this.name);
      case 'overloaded_error':
        return new OverloadedError(this.name);
      case 'api_error':
        return new ProviderError(this.name);
      default:
        return new ProviderError(this.name);
    }
  }

  /**
   * Map Claude stop reason to unified format.
   */
  private mapStopReason(reason?: ClaudeStopReason): LLMFinishReason {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
      case 'tool_use':
      case 'pause_turn':
        return 'complete';
      case 'max_tokens':
        return 'length';
      case 'refusal':
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
      // Use a minimal request to check API key validity
      const response = await fetch(`${this.apiUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });
      // 200 = success, 400 = valid key but bad request (still means key works)
      return response.status === 200 || response.status === 400;
    } catch {
      return false;
    }
  }
}
