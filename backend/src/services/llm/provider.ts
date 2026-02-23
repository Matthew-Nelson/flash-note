/**
 * LLM Provider interface and base class with retry logic.
 *
 * Provides a unified interface for LLM providers (Gemini, Claude) with
 * built-in retry handling for transient errors.
 */

import type {
  LLMProviderType,
  LLMCompletionResult,
  LLMRequestConfig,
  LLMRetryConfig,
  LLMErrorCode,
  PTNoteResult,
} from './types.js';
import { DEFAULT_RETRY_CONFIG } from './types.js';
import { LLMError } from './errors.js';

/**
 * Interface for LLM providers.
 *
 * Each provider must implement this interface to be usable through the
 * unified LLM abstraction layer.
 */
export interface LLMProvider {
  /** Provider identifier */
  readonly name: LLMProviderType;

  /** Model name being used */
  readonly model: string;

  /**
   * Generate a structured PT note from system and user prompts.
   *
   * Uses JSON mode (Gemini) or tool use (Claude) to ensure structured output.
   * System prompt is sent via the provider's dedicated system instruction field
   * for stronger isolation from user content.
   *
   * @param systemPrompt - System instructions (sent via systemInstruction/system field)
   * @param userPrompt - User content with note type instructions and clinician input
   * @param config - Request configuration (tokens, temperature, timeout)
   * @returns Parsed and validated PT note with usage metadata
   * @throws LLMError on failure
   */
  generatePTNote(
    systemPrompt: string,
    userPrompt: string,
    config: LLMRequestConfig
  ): Promise<PTNoteResult>;

  /**
   * Generate a raw completion (text response).
   *
   * Used for non-structured outputs or debugging.
   *
   * @param prompt - The prompt to send to the LLM
   * @param config - Request configuration
   * @returns Raw completion result with content and metadata
   * @throws LLMError on failure
   */
  generateCompletion(
    prompt: string,
    config: LLMRequestConfig
  ): Promise<LLMCompletionResult>;

  /**
   * Health check for the provider.
   *
   * @returns true if the provider is reachable and authenticated
   */
  healthCheck?(): Promise<boolean>;
}

/**
 * Base class for LLM providers with built-in retry logic.
 *
 * Subclasses implement the actual API calls; this class handles:
 * - Automatic retry for transient errors (rate limits, overloaded, network)
 * - Exponential backoff with jitter
 * - Retry-after header support
 */
export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly name: LLMProviderType;
  abstract readonly model: string;

  protected readonly retryConfig: LLMRetryConfig;

  constructor(retryConfig: LLMRetryConfig = DEFAULT_RETRY_CONFIG) {
    this.retryConfig = retryConfig;
  }

  /**
   * Generate a structured PT note with automatic retry.
   */
  async generatePTNote(
    systemPrompt: string,
    userPrompt: string,
    config: LLMRequestConfig
  ): Promise<PTNoteResult> {
    return this.withRetry(() => this.doGeneratePTNote(systemPrompt, userPrompt, config));
  }

  /**
   * Generate a raw completion with automatic retry.
   */
  async generateCompletion(
    prompt: string,
    config: LLMRequestConfig
  ): Promise<LLMCompletionResult> {
    return this.withRetry(() => this.doGenerateCompletion(prompt, config));
  }

  /**
   * Provider-specific implementation of structured PT note generation.
   * Must be implemented by subclasses.
   */
  protected abstract doGeneratePTNote(
    systemPrompt: string,
    userPrompt: string,
    config: LLMRequestConfig
  ): Promise<PTNoteResult>;

  /**
   * Provider-specific implementation of raw completion.
   * Must be implemented by subclasses.
   */
  protected abstract doGenerateCompletion(
    prompt: string,
    config: LLMRequestConfig
  ): Promise<LLMCompletionResult>;

  /**
   * Execute a function with automatic retry on transient errors.
   *
   * Uses exponential backoff with jitter and respects retry-after headers.
   */
  protected async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: LLMError | undefined;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (!(error instanceof LLMError)) {
          throw error;
        }

        lastError = error;

        // Check if error is retryable
        if (!this.isRetryable(error.code) || attempt === this.retryConfig.maxRetries) {
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, error.retryAfterMs);

        // SECURITY: Log retry attempt without PHI
        console.warn('LLM retry attempt:', {
          provider: this.name,
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
          errorCode: error.code,
          delayMs: delay,
        });

        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError ?? new Error('Retry loop exited unexpectedly');
  }

  /**
   * Check if an error code is retryable based on configuration.
   */
  protected isRetryable(code: LLMErrorCode): boolean {
    return this.retryConfig.retryableErrors.includes(code);
  }

  /**
   * Calculate retry delay with exponential backoff and jitter.
   *
   * @param attempt - Current attempt number (0-indexed)
   * @param retryAfterMs - Optional server-specified retry delay
   * @returns Delay in milliseconds
   */
  protected calculateDelay(attempt: number, retryAfterMs?: number): number {
    // If server specified retry-after, use that (with minimum of base delay)
    if (retryAfterMs !== undefined) {
      return Math.max(retryAfterMs, this.retryConfig.baseDelayMs);
    }

    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);

    // Add jitter (0-25% of the delay)
    const jitter = exponentialDelay * 0.25 * Math.random();

    // Cap at max delay
    return Math.min(exponentialDelay + jitter, this.retryConfig.maxDelayMs);
  }

  /**
   * Sleep for a specified duration.
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Parse retry-after header value.
   *
   * @param headerValue - The Retry-After header value (seconds or HTTP date)
   * @returns Delay in milliseconds, or undefined if not parseable
   */
  protected parseRetryAfter(headerValue: string | null): number | undefined {
    if (!headerValue) return undefined;

    // Try parsing as seconds
    const seconds = parseInt(headerValue, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try parsing as HTTP date
    const date = Date.parse(headerValue);
    if (!isNaN(date)) {
      const delayMs = date - Date.now();
      return delayMs > 0 ? delayMs : undefined;
    }

    return undefined;
  }
}
