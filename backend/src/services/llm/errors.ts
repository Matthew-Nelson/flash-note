/**
 * LLM-specific error classes for the provider abstraction layer.
 *
 * These errors provide detailed information about LLM failures while
 * maintaining HIPAA compliance by never including PHI in error messages.
 */

import type { LLMErrorCode, LLMProviderType } from './types.js';

/**
 * Base error class for all LLM-related errors.
 *
 * SECURITY: Error messages must NEVER contain PHI. Only include:
 * - Error codes and status information
 * - Provider name and model information
 * - Timing information (retry delays)
 */
export class LLMError extends Error {
  public readonly code: LLMErrorCode;
  public readonly provider: LLMProviderType;
  public readonly retryable: boolean;
  public readonly retryAfterMs?: number;

  constructor(
    code: LLMErrorCode,
    message: string,
    provider: LLMProviderType,
    retryable: boolean = false,
    retryAfterMs?: number,
    cause?: Error
  ) {
    super(message, { cause });
    this.name = 'LLMError';
    this.code = code;
    this.provider = provider;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Create a safe object for logging (HIPAA compliant).
   * Never includes request/response content that might contain PHI.
   */
  toSafeLogObject(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      provider: this.provider,
      retryable: this.retryable,
      retryAfterMs: this.retryAfterMs,
    };
  }
}

/**
 * Rate limit error (429) - retryable after delay.
 */
export class RateLimitError extends LLMError {
  constructor(
    provider: LLMProviderType,
    retryAfterMs?: number,
    cause?: Error
  ) {
    super(
      'rate_limited',
      `Rate limit exceeded for ${provider}${retryAfterMs ? `, retry after ${retryAfterMs}ms` : ''}`,
      provider,
      true, // retryable
      retryAfterMs,
      cause
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Provider overloaded error (529/503) - retryable after delay.
 */
export class OverloadedError extends LLMError {
  constructor(
    provider: LLMProviderType,
    retryAfterMs?: number,
    cause?: Error
  ) {
    super(
      'overloaded',
      `${provider} is temporarily overloaded`,
      provider,
      true, // retryable
      retryAfterMs, // Use server-specified delay, or undefined for exponential backoff
      cause
    );
    this.name = 'OverloadedError';
  }
}

/**
 * Authentication error (401) - not retryable, configuration issue.
 */
export class AuthenticationError extends LLMError {
  constructor(provider: LLMProviderType, cause?: Error) {
    super(
      'auth_error',
      `Authentication failed for ${provider}. Check API key configuration.`,
      provider,
      false, // not retryable
      undefined,
      cause
    );
    this.name = 'AuthenticationError';
  }
}

/**
 * Invalid request error (400) - not retryable, likely a bug.
 */
export class InvalidRequestError extends LLMError {
  constructor(provider: LLMProviderType, details?: string, cause?: Error) {
    super(
      'invalid_request',
      `Invalid request to ${provider}${details ? `: ${details}` : ''}`,
      provider,
      false, // not retryable
      undefined,
      cause
    );
    this.name = 'InvalidRequestError';
  }
}

/**
 * Content blocked error - safety filter triggered, not retryable.
 */
export class ContentBlockedError extends LLMError {
  constructor(provider: LLMProviderType, cause?: Error) {
    super(
      'content_blocked',
      `Content blocked by ${provider} safety filter`,
      provider,
      false, // not retryable
      undefined,
      cause
    );
    this.name = 'ContentBlockedError';
  }
}

/**
 * Output truncated - token limit reached, not retryable but may need config change.
 */
export class OutputTruncatedError extends LLMError {
  constructor(provider: LLMProviderType, cause?: Error) {
    super(
      'output_truncated',
      `${provider} output was truncated due to token limit`,
      provider,
      false, // not retryable - same input will hit same limit
      undefined,
      cause
    );
    this.name = 'OutputTruncatedError';
  }
}

/**
 * Timeout error - client-side timeout, retryable.
 */
export class TimeoutError extends LLMError {
  constructor(provider: LLMProviderType, timeoutMs: number, cause?: Error) {
    super(
      'timeout',
      `${provider} request timed out after ${timeoutMs}ms`,
      provider,
      true, // retryable
      undefined,
      cause
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Network error - connection issues, retryable.
 */
export class NetworkError extends LLMError {
  constructor(provider: LLMProviderType, cause?: Error) {
    super(
      'network_error',
      `Network error connecting to ${provider}`,
      provider,
      true, // retryable
      undefined,
      cause
    );
    this.name = 'NetworkError';
  }
}

/**
 * Provider error (500) - server-side error, retryable.
 */
export class ProviderError extends LLMError {
  constructor(provider: LLMProviderType, statusCode?: number, cause?: Error) {
    super(
      'provider_error',
      `${provider} server error${statusCode ? ` (${statusCode})` : ''}`,
      provider,
      true, // retryable
      undefined,
      cause
    );
    this.name = 'ProviderError';
  }
}

/**
 * Parse error - JSON parsing failed, not retryable.
 */
export class ParseError extends LLMError {
  constructor(provider: LLMProviderType, details?: string, cause?: Error) {
    super(
      'parse_error',
      `Failed to parse ${provider} response${details ? `: ${details}` : ''}`,
      provider,
      false, // not retryable - same response will fail same way
      undefined,
      cause
    );
    this.name = 'ParseError';
  }
}
