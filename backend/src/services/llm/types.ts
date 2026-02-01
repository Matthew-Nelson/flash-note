/**
 * Unified LLM types for provider-agnostic LLM abstraction layer.
 *
 * These types normalize the response formats from different LLM providers
 * (Gemini, Claude) into a consistent interface.
 */

// Provider types
export type LLMProviderType = 'gemini' | 'claude';

// Unified finish reasons across providers
// Maps Gemini's finishReason and Claude's stop_reason to common values
export type LLMFinishReason =
  | 'complete' // Normal completion (Gemini: STOP, Claude: end_turn)
  | 'length' // Token limit reached (Gemini: MAX_TOKENS, Claude: max_tokens)
  | 'content_filter' // Safety/refusal (Gemini: SAFETY, Claude: refusal)
  | 'error'; // Other issues (Gemini: OTHER/RECITATION, Claude: various)

// Token usage tracking
export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// Provider-agnostic completion result
export interface LLMCompletionResult {
  content: string;
  finishReason: LLMFinishReason;
  usage: LLMUsage;
  model: string;
  provider: LLMProviderType;
}

// Configuration for LLM requests
export interface LLMRequestConfig {
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

// Retry configuration
export interface LLMRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: readonly LLMErrorCode[];
}

// Error codes for LLM operations
export type LLMErrorCode =
  | 'rate_limited' // 429 - retryable
  | 'overloaded' // 529/503 - retryable
  | 'auth_error' // 401 - not retryable
  | 'invalid_request' // 400 - not retryable
  | 'content_blocked' // Safety filter - not retryable
  | 'output_truncated' // MAX_TOKENS - not retryable but warning
  | 'timeout' // Client timeout - retryable
  | 'network_error' // Connection issues - retryable
  | 'provider_error' // 500 - retryable
  | 'parse_error'; // JSON parsing failed - not retryable

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: LLMRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: [
    'rate_limited',
    'overloaded',
    'network_error',
    'timeout',
    'provider_error',
  ] as const,
};

// Result type for structured PT note generation
// Wraps PTNoteOutput with usage metadata
import type { PTNoteOutput } from './schemas.js';

export interface PTNoteResult {
  /** The generated PT note content */
  note: PTNoteOutput;
  /** Token usage for this request */
  usage: LLMUsage;
}
