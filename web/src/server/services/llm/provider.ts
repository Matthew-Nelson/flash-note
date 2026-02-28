import 'server-only';

/**
 * LLM Provider interface and base class with retry logic.
 *
 * Provides a unified interface for LLM providers (Gemini, Claude) with
 * built-in retry handling for transient errors.
 */

import type {
  LLMProviderType,
  LLMRequestConfig,
  LLMRetryConfig,
  LLMErrorCode,
  PTNoteResult,
} from './types';
import { DEFAULT_RETRY_CONFIG } from './types';
import { LLMError } from './errors';

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
   */
  generatePTNote(
    systemPrompt: string,
    userPrompt: string,
    config: LLMRequestConfig,
  ): Promise<PTNoteResult>;

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

  async generatePTNote(
    systemPrompt: string,
    userPrompt: string,
    config: LLMRequestConfig,
  ): Promise<PTNoteResult> {
    return this.withRetry(() => this.doGeneratePTNote(systemPrompt, userPrompt, config));
  }

  protected abstract doGeneratePTNote(
    systemPrompt: string,
    userPrompt: string,
    config: LLMRequestConfig,
  ): Promise<PTNoteResult>;

  /**
   * Execute a function with automatic retry on transient errors.
   *
   * Uses exponential backoff with jitter and respects retry-after headers.
   */
  protected async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (!(error instanceof LLMError)) {
          throw error;
        }

        if (!this.isRetryable(error.code) || attempt === this.retryConfig.maxRetries) {
          throw error;
        }

        const delay = this.calculateDelay(attempt, error.retryAfterMs);

        // SECURITY: Log retry attempt without PHI
        // TODO: Replace with Pino structured logger when available
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

    // TypeScript requires this — the loop always returns or throws
    throw new Error('Retry loop exited unexpectedly');
  }

  protected isRetryable(code: LLMErrorCode): boolean {
    return this.retryConfig.retryableErrors.includes(code);
  }

  /**
   * Calculate retry delay with exponential backoff and jitter.
   */
  protected calculateDelay(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs !== undefined) {
      return Math.max(retryAfterMs, this.retryConfig.baseDelayMs);
    }

    const exponentialDelay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
    const jitter = exponentialDelay * 0.25 * Math.random();
    return Math.min(exponentialDelay + jitter, this.retryConfig.maxDelayMs);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Parse retry-after header value.
   */
  protected parseRetryAfter(headerValue: string | null): number | undefined {
    if (!headerValue) return undefined;

    const seconds = parseInt(headerValue, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    const date = Date.parse(headerValue);
    if (!isNaN(date)) {
      const delayMs = date - Date.now();
      return delayMs > 0 ? delayMs : undefined;
    }

    return undefined;
  }
}
