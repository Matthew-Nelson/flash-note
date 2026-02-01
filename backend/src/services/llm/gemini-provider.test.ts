import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GeminiProvider } from './gemini-provider.js';
import {
  RateLimitError,
  OverloadedError,
  AuthenticationError,
  ContentBlockedError,
  TimeoutError,
  ParseError,
  InvalidRequestError,
  ProviderError,
  OutputTruncatedError,
  NetworkError,
} from './errors.js';
import type { LLMRequestConfig, LLMRetryConfig } from './types.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Fast retry config for tests
const FAST_RETRY_CONFIG: LLMRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 10, // 10ms instead of 1000ms
  maxDelayMs: 50,
  retryableErrors: ['rate_limited', 'overloaded', 'network_error', 'timeout', 'provider_error'] as const,
};

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  const requestConfig: LLMRequestConfig = {
    maxTokens: 2000,
    temperature: 0.7,
    timeoutMs: 30000,
  };

  const validPTNoteResponse = {
    subjective: 'Patient reports pain 4/10.',
    objective: 'ROM: Knee flexion 110 degrees.',
    assessment: 'Good progress.',
    plan: 'Continue PT 2x/week.',
  };

  beforeEach(() => {
    mockFetch.mockReset(); // Reset mock implementations, not just call history
    provider = new GeminiProvider({
      apiKey: 'test-api-key',
      model: 'gemini-2.5-flash',
      retryConfig: FAST_RETRY_CONFIG,
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('generatePTNote', () => {
    it('should generate a structured PT note successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(validPTNoteResponse) }],
                },
                finishReason: 'STOP',
              },
            ],
            usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 50, totalTokenCount: 100 },
          }),
      });

      const result = await provider.generatePTNote('test prompt', requestConfig);

      expect(result.note.subjective).toBe(validPTNoteResponse.subjective);
      expect(result.note.objective).toBe(validPTNoteResponse.objective);
      expect(result.note.assessment).toBe(validPTNoteResponse.assessment);
      expect(result.note.plan).toBe(validPTNoteResponse.plan);
      expect(result.usage.totalTokens).toBe(100);
    });

    it('should include billing information when provided', async () => {
      const responseWithBilling = {
        ...validPTNoteResponse,
        billing: {
          charges: [{ cptCode: '97110', description: 'Therapeutic Exercise', minutes: 23, units: 2 }],
          totalTimedMinutes: 23,
          totalUnits: 2,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(responseWithBilling) }] },
                finishReason: 'STOP',
              },
            ],
          }),
      });

      const result = await provider.generatePTNote('test prompt', requestConfig);

      expect(result.note.billing).toBeDefined();
      expect(result.note.billing!.charges).toHaveLength(1);
    });

    it('should throw ParseError for invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: 'not valid json' }] },
                finishReason: 'STOP',
              },
            ],
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ParseError
      );
    });

    it('should throw ParseError for response not matching schema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify({ invalid: 'schema' }) }] },
                finishReason: 'STOP',
              },
            ],
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ParseError
      );
    });

    it('should throw ContentBlockedError for SAFETY finish reason', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: '' }] },
                finishReason: 'SAFETY',
              },
            ],
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ContentBlockedError
      );
    });

    it('should throw RateLimitError for 429 response after retries exhausted', async () => {
      // Mock 4 calls (1 initial + 3 retries) to exhaust all retries
      const errorResponse = {
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: { status: 'RESOURCE_EXHAUSTED' } }),
      };
      mockFetch.mockResolvedValue(errorResponse);

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        RateLimitError
      );
    });

    it('should throw AuthenticationError for 401 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { status: 'UNAUTHENTICATED' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should throw OverloadedError for 503 response after retries exhausted', async () => {
      // Mock persistent error to exhaust all retries
      const errorResponse = {
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: { status: 'SERVICE_UNAVAILABLE' } }),
      };
      mockFetch.mockResolvedValue(errorResponse);

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        OverloadedError
      );
    });

    it('should throw TimeoutError on abort after retries exhausted', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      // Mock persistent timeout to exhaust all retries
      mockFetch.mockRejectedValue(abortError);

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        TimeoutError
      );
    });

    it('should use API key in header, not URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(validPTNoteResponse) }] },
                finishReason: 'STOP',
              },
            ],
          }),
      });

      await provider.generatePTNote('test prompt', requestConfig);

      const [url, options] = mockFetch.mock.calls[0]!;
      expect(url).not.toContain('test-api-key');
      expect((options as { headers: Record<string, string> }).headers['x-goog-api-key']).toBe(
        'test-api-key'
      );
    });

    it('should include response schema in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(validPTNoteResponse) }] },
                finishReason: 'STOP',
              },
            ],
          }),
      });

      await provider.generatePTNote('test prompt', requestConfig);

      const [, options] = mockFetch.mock.calls[0]!;
      const body = JSON.parse((options as { body: string }).body);
      expect(body.generationConfig.responseMimeType).toBe('application/json');
      expect(body.generationConfig.responseSchema).toBeDefined();
    });

    it('should not log PHI in error messages', async () => {
      // Mock persistent error to exhaust all retries (500 is retryable)
      const errorResponse = {
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            error: { message: 'Error with patient data: John Doe DOB 1990-01-01' },
          }),
      };
      mockFetch.mockResolvedValue(errorResponse);

      try {
        await provider.generatePTNote('sensitive patient data', requestConfig);
      } catch {
        // Expected
      }

      // Verify that logged error does not contain the error message (which might have PHI)
      const logCall = consoleErrorSpy.mock.calls[0];
      expect(logCall).toBeDefined();
      expect(logCall![0]).toBe('Gemini API HTTP error:');
      expect(logCall![1]).toEqual({ status: 500 });
    });
  });

  describe('generateCompletion', () => {
    it('should return raw text completion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: 'Raw text response' }] },
                finishReason: 'STOP',
              },
            ],
            usageMetadata: {
              promptTokenCount: 50,
              candidatesTokenCount: 20,
              totalTokenCount: 70,
            },
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.content).toBe('Raw text response');
      expect(result.finishReason).toBe('complete');
      expect(result.usage.totalTokens).toBe(70);
      expect(result.provider).toBe('gemini');
    });

    it('should map MAX_TOKENS finish reason to length', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: 'Truncated...' }] },
                finishReason: 'MAX_TOKENS',
              },
            ],
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.finishReason).toBe('length');
    });
  });

  describe('healthCheck', () => {
    it('should return true for successful API response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await provider.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false for failed API response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await provider.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false for network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('retry logic', () => {
    it('should retry on rate limit error', async () => {
      // First call: rate limited
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: { status: 'RESOURCE_EXHAUSTED' } }),
      });

      // Second call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(validPTNoteResponse) }] },
                finishReason: 'STOP',
              },
            ],
          }),
      });

      const result = await provider.generatePTNote('test prompt', requestConfig);

      expect(result.note.subjective).toBe(validPTNoteResponse.subjective);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith('LLM retry attempt:', expect.any(Object));
    });

    it('should not retry on auth error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { status: 'UNAUTHENTICATED' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        AuthenticationError
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('HTTP error handling', () => {
    it('should throw InvalidRequestError for 400 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: { status: 'INVALID_ARGUMENT' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        InvalidRequestError
      );
    });

    it('should throw AuthenticationError for 403 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: { status: 'PERMISSION_DENIED' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should throw OverloadedError for 500 response after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: { status: 'INTERNAL' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        OverloadedError
      );
    });

    it('should throw OverloadedError for 502 response after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: { status: 'BAD_GATEWAY' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        OverloadedError
      );
    });

    it('should throw ProviderError for unexpected status codes after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 418,
        json: () => Promise.resolve({ error: { status: 'TEAPOT' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ProviderError
      );
    });
  });

  describe('API error in response body', () => {
    it('should handle RESOURCE_EXHAUSTED error in response body after retries exhausted', async () => {
      // When ok is true but error is in response body - use persistent mock for retries
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            error: { status: 'RESOURCE_EXHAUSTED' },
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        RateLimitError
      );
    });

    it('should handle error code 400 in response body (non-retryable)', async () => {
      // 400 errors are not retryable, so mockResolvedValueOnce is fine
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            error: { code: 400, status: 'INVALID_ARGUMENT' },
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        InvalidRequestError
      );
    });

    it('should handle generic API error in response body after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            error: { code: 500, status: 'INTERNAL' },
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ProviderError
      );
    });
  });

  describe('finish reason handling', () => {
    it('should throw OutputTruncatedError for MAX_TOKENS with no content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: '' }] },
                finishReason: 'MAX_TOKENS',
              },
            ],
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        OutputTruncatedError
      );
    });

    it('should throw OutputTruncatedError for MAX_TOKENS when JSON parsing fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: '{"incomplete": true' }] },
                finishReason: 'MAX_TOKENS',
              },
            ],
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        OutputTruncatedError
      );
    });

    it('should throw OutputTruncatedError for MAX_TOKENS when schema validation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify({ subjective: 'only' }) }] },
                finishReason: 'MAX_TOKENS',
              },
            ],
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        OutputTruncatedError
      );
    });

    it('should map RECITATION finish reason to content_filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: 'Some content' }] },
                finishReason: 'RECITATION',
              },
            ],
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.finishReason).toBe('content_filter');
    });

    it('should map OTHER finish reason to error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: 'Some content' }] },
                finishReason: 'OTHER',
              },
            ],
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.finishReason).toBe('error');
    });

    it('should map undefined finish reason to error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: 'Some content' }] },
              },
            ],
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.finishReason).toBe('error');
    });
  });

  describe('network error handling', () => {
    it('should throw NetworkError for generic fetch errors after retries exhausted', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        NetworkError
      );
    });

    it('should throw NetworkError for non-Error objects after retries exhausted', async () => {
      mockFetch.mockRejectedValue('some string error');

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        NetworkError
      );
    });
  });

  describe('empty content handling', () => {
    it('should throw ParseError for missing content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                finishReason: 'STOP',
              },
            ],
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ParseError
      );
    });

    it('should handle empty content in generateCompletion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                finishReason: 'STOP',
              },
            ],
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.content).toBe('');
    });

    it('should handle missing usage metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(validPTNoteResponse) }] },
                finishReason: 'STOP',
              },
            ],
          }),
      });

      const result = await provider.generatePTNote('test prompt', requestConfig);

      expect(result.usage.inputTokens).toBe(0);
      expect(result.usage.outputTokens).toBe(0);
    });
  });

  describe('generateCompletion error handling', () => {
    it('should throw TimeoutError on abort in generateCompletion', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(provider.generateCompletion('test prompt', requestConfig)).rejects.toThrow(
        TimeoutError
      );
    });

    it('should throw NetworkError for fetch errors in generateCompletion', async () => {
      mockFetch.mockRejectedValue(new Error('Network failed'));

      await expect(provider.generateCompletion('test prompt', requestConfig)).rejects.toThrow(
        NetworkError
      );
    });

    it('should handle HTTP errors in generateCompletion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { status: 'UNAUTHENTICATED' } }),
      });

      await expect(provider.generateCompletion('test prompt', requestConfig)).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should handle API errors in generateCompletion', async () => {
      // RESOURCE_EXHAUSTED is retryable, so use persistent mock
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            error: { status: 'RESOURCE_EXHAUSTED' },
          }),
      });

      await expect(provider.generateCompletion('test prompt', requestConfig)).rejects.toThrow(
        RateLimitError
      );
    });
  });

  describe('schema conversion', () => {
    it('should convert JSON Schema to Gemini format in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(validPTNoteResponse) }] },
                finishReason: 'STOP',
              },
            ],
          }),
      });

      await provider.generatePTNote('test prompt', requestConfig);

      const [, options] = mockFetch.mock.calls[0]!;
      const body = JSON.parse((options as { body: string }).body);
      const schema = body.generationConfig.responseSchema;

      // Verify type conversion (lowercase to uppercase)
      expect(schema.type).toBe('OBJECT');
    });
  });
});
