/**
 * Tests for BaseLLMProvider.
 *
 * Tests retry logic, delay calculation, and utility methods.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BaseLLMProvider } from './provider';
import {
  LLMError,
  RateLimitError,
  NetworkError,
  AuthenticationError,
} from './errors';
import type {
  LLMProviderType,
  LLMRequestConfig,
  LLMRetryConfig,
  PTNoteResult,
} from './types';

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
}));
vi.mock('@/server/lib/logger', () => ({ logger: mockLogger }));

// Concrete implementation for testing
class TestProvider extends BaseLLMProvider {
  readonly name: LLMProviderType = 'gemini';
  readonly model: string = 'test-model';

  public testCalculateDelay(attempt: number, retryAfterMs?: number): number {
    return this.calculateDelay(attempt, retryAfterMs);
  }

  public testIsRetryable(code: LLMError['code']): boolean {
    return this.isRetryable(code);
  }

  public testParseRetryAfter(headerValue: string | null): number | undefined {
    return this.parseRetryAfter(headerValue);
  }

  public testWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    return this.withRetry(fn);
  }

  doGeneratePTNoteImpl: () => Promise<PTNoteResult> = () =>
    Promise.resolve({
      note: {
        subjective: 'test',
        objective: 'test',
        assessment: 'test',
        plan: 'test',
      },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });

  protected async doGeneratePTNote(
    _systemPrompt: string,
    _userPrompt: string,
    _config: LLMRequestConfig,
  ): Promise<PTNoteResult> {
    return this.doGeneratePTNoteImpl();
  }
}

// Fast retry config for tests
const FAST_RETRY_CONFIG: LLMRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 10,
  maxDelayMs: 50,
  retryableErrors: ['rate_limited', 'overloaded', 'network_error', 'timeout', 'provider_error'] as const,
};

describe('BaseLLMProvider', () => {
  let provider: TestProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new TestProvider(FAST_RETRY_CONFIG);
  });

  afterEach(() => {
    // no-op: mocks cleared in beforeEach
  });

  describe('calculateDelay', () => {
    it('should use exponential backoff', () => {
      const delay0 = provider.testCalculateDelay(0);
      const delay1 = provider.testCalculateDelay(1);
      const delay2 = provider.testCalculateDelay(2);

      expect(delay0).toBeGreaterThanOrEqual(10);
      expect(delay0).toBeLessThanOrEqual(12.5);

      expect(delay1).toBeGreaterThanOrEqual(20);
      expect(delay1).toBeLessThanOrEqual(25);

      expect(delay2).toBeGreaterThanOrEqual(40);
      expect(delay2).toBeLessThanOrEqual(50);
    });

    it('should cap delay at maxDelayMs', () => {
      const delay = provider.testCalculateDelay(10);
      expect(delay).toBeLessThanOrEqual(50);
    });

    it('should use retryAfterMs when provided', () => {
      const delay = provider.testCalculateDelay(0, 5000);
      expect(delay).toBe(5000);
    });

    it('should use baseDelayMs minimum when retryAfterMs is too small', () => {
      const delay = provider.testCalculateDelay(0, 1);
      expect(delay).toBe(10);
    });
  });

  describe('isRetryable', () => {
    it('should return true for retryable errors', () => {
      expect(provider.testIsRetryable('rate_limited')).toBe(true);
      expect(provider.testIsRetryable('overloaded')).toBe(true);
      expect(provider.testIsRetryable('network_error')).toBe(true);
      expect(provider.testIsRetryable('timeout')).toBe(true);
      expect(provider.testIsRetryable('provider_error')).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      expect(provider.testIsRetryable('auth_error')).toBe(false);
      expect(provider.testIsRetryable('invalid_request')).toBe(false);
      expect(provider.testIsRetryable('content_blocked')).toBe(false);
      expect(provider.testIsRetryable('parse_error')).toBe(false);
      expect(provider.testIsRetryable('output_truncated')).toBe(false);
    });
  });

  describe('parseRetryAfter', () => {
    it('should return undefined for null value', () => {
      expect(provider.testParseRetryAfter(null)).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(provider.testParseRetryAfter('')).toBeUndefined();
    });

    it('should parse seconds value', () => {
      expect(provider.testParseRetryAfter('5')).toBe(5000);
      expect(provider.testParseRetryAfter('60')).toBe(60000);
      expect(provider.testParseRetryAfter('0')).toBe(0);
    });

    it('should parse HTTP date format', () => {
      const futureDate = new Date(Date.now() + 30000);
      const httpDate = futureDate.toUTCString();

      const result = provider.testParseRetryAfter(httpDate);

      expect(result).toBeDefined();
      expect(result).toBeGreaterThan(25000);
      expect(result).toBeLessThan(35000);
    });

    it('should return undefined for past HTTP date', () => {
      const pastDate = new Date(Date.now() - 30000);
      const httpDate = pastDate.toUTCString();

      expect(provider.testParseRetryAfter(httpDate)).toBeUndefined();
    });

    it('should return undefined for invalid format', () => {
      expect(provider.testParseRetryAfter('not-a-number-or-date')).toBeUndefined();
      expect(provider.testParseRetryAfter('abc123')).toBeUndefined();
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      let callCount = 0;
      const result = await provider.testWithRetry(() => {
        callCount++;
        return Promise.resolve('success');
      });

      expect(result).toBe('success');
      expect(callCount).toBe(1);
    });

    it('should retry on retryable error and succeed', async () => {
      let callCount = 0;
      const result = await provider.testWithRetry(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.reject(new RateLimitError('gemini'));
        }
        return Promise.resolve('success');
      });

      expect(result).toBe('success');
      expect(callCount).toBe(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ source: 'llm_service' }), 'LLM retry attempt');
    });

    it('should exhaust retries and throw final error', async () => {
      let callCount = 0;

      await expect(
        provider.testWithRetry(() => {
          callCount++;
          return Promise.reject(new NetworkError('gemini'));
        }),
      ).rejects.toThrow(NetworkError);

      // 1 initial + 3 retries = 4 attempts
      expect(callCount).toBe(4);
    });

    it('should not retry non-retryable errors', async () => {
      let callCount = 0;

      await expect(
        provider.testWithRetry(() => {
          callCount++;
          return Promise.reject(new AuthenticationError('gemini'));
        }),
      ).rejects.toThrow(AuthenticationError);

      expect(callCount).toBe(1);
    });

    it('should rethrow non-LLMError exceptions immediately', async () => {
      let callCount = 0;
      const customError = new Error('Custom error');

      await expect(
        provider.testWithRetry(() => {
          callCount++;
          return Promise.reject(customError);
        }),
      ).rejects.toThrow(customError);

      expect(callCount).toBe(1);
    });

    it('should log retry attempts with correct metadata', async () => {
      await expect(
        provider.testWithRetry(() => {
          return Promise.reject(new RateLimitError('gemini'));
        }),
      ).rejects.toThrow(RateLimitError);

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({
        source: 'llm_service',
        provider: 'gemini',
        attempt: expect.any(Number),
        maxRetries: 3,
        errorCode: 'rate_limited',
        delayMs: expect.any(Number),
      }), 'LLM retry attempt');
    });
  });

  describe('generatePTNote', () => {
    it('should delegate to doGeneratePTNote', async () => {
      const expectedResult: PTNoteResult = {
        note: {
          subjective: 'Patient reports improvement',
          objective: 'ROM 90 degrees',
          assessment: 'Progress noted',
          plan: 'Continue therapy',
        },
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      };

      provider.doGeneratePTNoteImpl = vi.fn().mockResolvedValue(expectedResult);

      const result = await provider.generatePTNote('test system', 'test prompt', {
        maxTokens: 2000,
        temperature: 0.2,
        timeoutMs: 30000,
      });

      expect(result).toEqual(expectedResult);
      expect(provider.doGeneratePTNoteImpl).toHaveBeenCalled();
    });

    it('should apply retry logic', async () => {
      let callCount = 0;
      const expectedResult: PTNoteResult = {
        note: {
          subjective: 'test',
          objective: 'test',
          assessment: 'test',
          plan: 'test',
        },
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };

      provider.doGeneratePTNoteImpl = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.reject(new NetworkError('gemini'));
        }
        return Promise.resolve(expectedResult);
      });

      const result = await provider.generatePTNote('test system', 'test', {
        maxTokens: 2000,
        temperature: 0.2,
        timeoutMs: 30000,
      });

      expect(result).toEqual(expectedResult);
      expect(callCount).toBe(2);
    });
  });

  describe('constructor', () => {
    it('should use default retry config when not provided', () => {
      const defaultProvider = new TestProvider();
      expect(defaultProvider.testIsRetryable('rate_limited')).toBe(true);
    });
  });
});
