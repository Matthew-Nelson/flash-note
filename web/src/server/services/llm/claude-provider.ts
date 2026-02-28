import 'server-only';

/**
 * Claude LLM Provider implementation.
 *
 * Uses Claude's tool use feature for structured output by forcing the model
 * to call a specific tool with a defined input schema.
 */

import { BaseLLMProvider } from './provider';
import type { LLMProviderType, LLMRequestConfig, LLMRetryConfig, PTNoteResult } from './types';
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
} from './errors';
import { getPTNoteJsonSchema, validatePTNoteOutput, type PTNoteOutput } from './schemas';
import { z } from 'zod';

// Zod schemas for runtime validation of Claude API responses (Rule 3)
const ClaudeTextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const ClaudeToolUseBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});

const ClaudeContentBlockSchema = z.discriminatedUnion('type', [
  ClaudeTextBlockSchema,
  ClaudeToolUseBlockSchema,
]);

const ClaudeErrorSchema = z.object({
  type: z.string(),
  message: z.string(),
});

const ClaudeUsageSchema = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
});

const ClaudeResponseSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  role: z.string().optional(),
  content: z.array(ClaudeContentBlockSchema).optional(),
  model: z.string().optional(),
  stop_reason: z.enum(['end_turn', 'max_tokens', 'stop_sequence', 'tool_use', 'pause_turn', 'refusal']).optional(),
  stop_sequence: z.string().nullable().optional(),
  usage: ClaudeUsageSchema.optional(),
  error: ClaudeErrorSchema.optional(),
});

type ClaudeResponse = z.infer<typeof ClaudeResponseSchema>;
type ClaudeContentBlock = z.infer<typeof ClaudeContentBlockSchema>;
type ClaudeErrorObject = z.infer<typeof ClaudeErrorSchema>;

export interface ClaudeProviderConfig {
  apiKey: string;
  model: string;
  apiUrl?: string;
  apiVersion?: string;
  retryConfig?: LLMRetryConfig;
}

const PT_NOTE_TOOL_NAME = 'generate_pt_note';

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
    this.ptNoteJsonSchema = getPTNoteJsonSchema();
  }

  protected async doGeneratePTNote(
    systemPrompt: string,
    userPrompt: string,
    config: LLMRequestConfig,
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

      const rawJson: unknown = await response.json();
      clearTimeout(timeoutId);

      const parseResult = ClaudeResponseSchema.safeParse(rawJson);
      if (!parseResult.success) {
        throw new ParseError(this.name, 'Unexpected Claude API response structure');
      }
      const data = parseResult.data;

      if (!response.ok) {
        throw this.handleHttpError(response.status, response.headers, data);
      }

      if (data.error) {
        throw this.handleApiError(data.error);
      }

      const stopReason = data.stop_reason;
      if (stopReason === 'refusal') {
        throw new ContentBlockedError(this.name);
      }

      const toolUseBlock = data.content?.find(
        (block): block is Extract<ClaudeContentBlock, { type: 'tool_use' }> =>
          block.type === 'tool_use' && block.name === PT_NOTE_TOOL_NAME,
      );

      if (!toolUseBlock) {
        if (stopReason === 'max_tokens') {
          throw new OutputTruncatedError(this.name);
        }
        throw new ParseError(this.name, 'No tool_use block in Claude response');
      }

      let note: PTNoteOutput;
      try {
        note = validatePTNoteOutput(toolUseBlock.input);
      } catch (e) {
        if (stopReason === 'max_tokens') {
          throw new OutputTruncatedError(this.name, e instanceof Error ? e : undefined);
        }
        throw new ParseError(
          this.name,
          'Tool input does not match expected schema',
          e instanceof Error ? e : undefined,
        );
      }

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

  private handleHttpError(status: number, headers: Headers, data: ClaudeResponse): LLMError {
    // SECURITY: Never log raw error body - may echo back PHI from request
    // TODO: Replace with Pino structured logger when available
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

  private handleApiError(error: ClaudeErrorObject): LLMError {
    // SECURITY: Never log error message - may contain PHI
    // TODO: Replace with Pino structured logger when available
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

}
