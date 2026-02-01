/**
 * Tests for LLM error classes.
 *
 * Verifies error properties, inheritance, and HIPAA-compliant logging.
 */
import { describe, it, expect } from 'vitest';
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

describe('LLM Error Classes', () => {
  describe('LLMError (base class)', () => {
    it('should create error with all properties', () => {
      const error = new LLMError(
        'rate_limited',
        'Test error message',
        'gemini',
        true,
        5000
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(LLMError);
      expect(error.name).toBe('LLMError');
      expect(error.code).toBe('rate_limited');
      expect(error.message).toBe('Test error message');
      expect(error.provider).toBe('gemini');
      expect(error.retryable).toBe(true);
      expect(error.retryAfterMs).toBe(5000);
    });

    it('should support cause chain', () => {
      const cause = new Error('Original error');
      const error = new LLMError(
        'network_error',
        'Wrapped error',
        'claude',
        true,
        undefined,
        cause
      );

      expect(error.cause).toBe(cause);
    });

    it('should have correct prototype chain', () => {
      const error = new LLMError('auth_error', 'Auth failed', 'gemini', false);
      expect(Object.getPrototypeOf(error)).toBe(LLMError.prototype);
    });

    describe('toSafeLogObject', () => {
      it('should return HIPAA-compliant object for logging', () => {
        const error = new LLMError(
          'rate_limited',
          'Rate limit exceeded for gemini',
          'gemini',
          true,
          5000
        );

        const logObject = error.toSafeLogObject();

        expect(logObject).toEqual({
          name: 'LLMError',
          code: 'rate_limited',
          message: 'Rate limit exceeded for gemini',
          provider: 'gemini',
          retryable: true,
          retryAfterMs: 5000,
        });
      });

      it('should not include cause or stack trace', () => {
        const cause = new Error('Original error with PHI: John Doe');
        const error = new LLMError(
          'network_error',
          'Network error',
          'claude',
          true,
          undefined,
          cause
        );

        const logObject = error.toSafeLogObject();

        expect(logObject).not.toHaveProperty('cause');
        expect(logObject).not.toHaveProperty('stack');
        expect(JSON.stringify(logObject)).not.toContain('John Doe');
      });
    });
  });

  describe('RateLimitError', () => {
    it('should create with correct properties', () => {
      const error = new RateLimitError('gemini', 5000);

      expect(error).toBeInstanceOf(LLMError);
      expect(error.name).toBe('RateLimitError');
      expect(error.code).toBe('rate_limited');
      expect(error.provider).toBe('gemini');
      expect(error.retryable).toBe(true);
      expect(error.retryAfterMs).toBe(5000);
      expect(error.message).toContain('Rate limit exceeded');
      expect(error.message).toContain('5000ms');
    });

    it('should work without retryAfterMs', () => {
      const error = new RateLimitError('claude');

      expect(error.retryAfterMs).toBeUndefined();
      expect(error.message).toContain('Rate limit exceeded');
      expect(error.message).not.toContain('retry after');
    });

    it('should support cause', () => {
      const cause = new Error('Original');
      const error = new RateLimitError('gemini', 5000, cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('OverloadedError', () => {
    it('should create with correct properties', () => {
      const error = new OverloadedError('claude', 10000);

      expect(error).toBeInstanceOf(LLMError);
      expect(error.name).toBe('OverloadedError');
      expect(error.code).toBe('overloaded');
      expect(error.provider).toBe('claude');
      expect(error.retryable).toBe(true);
      expect(error.retryAfterMs).toBe(10000);
      expect(error.message).toContain('temporarily overloaded');
    });

    it('should work without retryAfterMs', () => {
      const error = new OverloadedError('gemini');

      expect(error.retryAfterMs).toBeUndefined();
    });

    it('should support cause', () => {
      const cause = new Error('Original');
      const error = new OverloadedError('claude', undefined, cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('AuthenticationError', () => {
    it('should create with correct properties', () => {
      const error = new AuthenticationError('gemini');

      expect(error).toBeInstanceOf(LLMError);
      expect(error.name).toBe('AuthenticationError');
      expect(error.code).toBe('auth_error');
      expect(error.provider).toBe('gemini');
      expect(error.retryable).toBe(false);
      expect(error.retryAfterMs).toBeUndefined();
      expect(error.message).toContain('Authentication failed');
      expect(error.message).toContain('API key');
    });

    it('should support cause', () => {
      const cause = new Error('Original');
      const error = new AuthenticationError('claude', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('InvalidRequestError', () => {
    it('should create with details', () => {
      const error = new InvalidRequestError('claude', 'missing required field');

      expect(error).toBeInstanceOf(LLMError);
      expect(error.name).toBe('InvalidRequestError');
      expect(error.code).toBe('invalid_request');
      expect(error.provider).toBe('claude');
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('Invalid request');
      expect(error.message).toContain('missing required field');
    });

    it('should work without details', () => {
      const error = new InvalidRequestError('gemini');

      expect(error.message).toContain('Invalid request');
      expect(error.message).not.toContain(':');
    });

    it('should support cause', () => {
      const cause = new Error('Original');
      const error = new InvalidRequestError('claude', 'details', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('ContentBlockedError', () => {
    it('should create with correct properties', () => {
      const error = new ContentBlockedError('gemini');

      expect(error).toBeInstanceOf(LLMError);
      expect(error.name).toBe('ContentBlockedError');
      expect(error.code).toBe('content_blocked');
      expect(error.provider).toBe('gemini');
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('Content blocked');
      expect(error.message).toContain('safety filter');
    });

    it('should support cause', () => {
      const cause = new Error('Original');
      const error = new ContentBlockedError('claude', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('OutputTruncatedError', () => {
    it('should create with correct properties', () => {
      const error = new OutputTruncatedError('claude');

      expect(error).toBeInstanceOf(LLMError);
      expect(error.name).toBe('OutputTruncatedError');
      expect(error.code).toBe('output_truncated');
      expect(error.provider).toBe('claude');
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('truncated');
      expect(error.message).toContain('token limit');
    });

    it('should support cause', () => {
      const cause = new Error('JSON parse failed');
      const error = new OutputTruncatedError('gemini', cause);

      expect(error.cause).toBe(cause);
    });

    it('should work for gemini provider', () => {
      const error = new OutputTruncatedError('gemini');

      expect(error.provider).toBe('gemini');
      expect(error.message).toContain('gemini');
    });

    it('should work for claude provider', () => {
      const error = new OutputTruncatedError('claude');

      expect(error.provider).toBe('claude');
      expect(error.message).toContain('claude');
    });
  });

  describe('TimeoutError', () => {
    it('should create with correct properties', () => {
      const error = new TimeoutError('gemini', 30000);

      expect(error).toBeInstanceOf(LLMError);
      expect(error.name).toBe('TimeoutError');
      expect(error.code).toBe('timeout');
      expect(error.provider).toBe('gemini');
      expect(error.retryable).toBe(true);
      expect(error.message).toContain('timed out');
      expect(error.message).toContain('30000ms');
    });

    it('should support cause', () => {
      const cause = new Error('AbortError');
      const error = new TimeoutError('claude', 60000, cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('NetworkError', () => {
    it('should create with correct properties', () => {
      const error = new NetworkError('claude');

      expect(error).toBeInstanceOf(LLMError);
      expect(error.name).toBe('NetworkError');
      expect(error.code).toBe('network_error');
      expect(error.provider).toBe('claude');
      expect(error.retryable).toBe(true);
      expect(error.message).toContain('Network error');
    });

    it('should support cause', () => {
      const cause = new Error('ECONNREFUSED');
      const error = new NetworkError('gemini', cause);

      expect(error.cause).toBe(cause);
    });

    it('should work for gemini provider', () => {
      const error = new NetworkError('gemini');

      expect(error.provider).toBe('gemini');
      expect(error.message).toContain('gemini');
    });

    it('should work for claude provider', () => {
      const error = new NetworkError('claude');

      expect(error.provider).toBe('claude');
      expect(error.message).toContain('claude');
    });
  });

  describe('ProviderError', () => {
    it('should create with status code', () => {
      const error = new ProviderError('gemini', 500);

      expect(error).toBeInstanceOf(LLMError);
      expect(error.name).toBe('ProviderError');
      expect(error.code).toBe('provider_error');
      expect(error.provider).toBe('gemini');
      expect(error.retryable).toBe(true);
      expect(error.message).toContain('server error');
      expect(error.message).toContain('500');
    });

    it('should work without status code', () => {
      const error = new ProviderError('claude');

      expect(error.message).toContain('server error');
      expect(error.message).not.toContain('(');
    });

    it('should support cause', () => {
      const cause = new Error('Original');
      const error = new ProviderError('gemini', 502, cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('ParseError', () => {
    it('should create with details', () => {
      const error = new ParseError('claude', 'Invalid JSON at position 42');

      expect(error).toBeInstanceOf(LLMError);
      expect(error.name).toBe('ParseError');
      expect(error.code).toBe('parse_error');
      expect(error.provider).toBe('claude');
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('Failed to parse');
      expect(error.message).toContain('Invalid JSON at position 42');
    });

    it('should work without details', () => {
      const error = new ParseError('gemini');

      expect(error.message).toContain('Failed to parse');
      expect(error.message).not.toContain(':');
    });

    it('should support cause', () => {
      const cause = new SyntaxError('Unexpected token');
      const error = new ParseError('claude', 'parsing failed', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('error inheritance', () => {
    it('should all be instanceof Error', () => {
      const errors = [
        new LLMError('rate_limited', 'test', 'gemini', true),
        new RateLimitError('gemini'),
        new OverloadedError('claude'),
        new AuthenticationError('gemini'),
        new InvalidRequestError('claude'),
        new ContentBlockedError('gemini'),
        new OutputTruncatedError('claude'),
        new TimeoutError('gemini', 30000),
        new NetworkError('claude'),
        new ProviderError('gemini'),
        new ParseError('claude'),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(LLMError);
      });
    });

    it('should all have proper name property', () => {
      expect(new RateLimitError('gemini').name).toBe('RateLimitError');
      expect(new OverloadedError('claude').name).toBe('OverloadedError');
      expect(new AuthenticationError('gemini').name).toBe('AuthenticationError');
      expect(new InvalidRequestError('claude').name).toBe('InvalidRequestError');
      expect(new ContentBlockedError('gemini').name).toBe('ContentBlockedError');
      expect(new OutputTruncatedError('claude').name).toBe('OutputTruncatedError');
      expect(new TimeoutError('gemini', 30000).name).toBe('TimeoutError');
      expect(new NetworkError('claude').name).toBe('NetworkError');
      expect(new ProviderError('gemini').name).toBe('ProviderError');
      expect(new ParseError('claude').name).toBe('ParseError');
    });
  });
});
