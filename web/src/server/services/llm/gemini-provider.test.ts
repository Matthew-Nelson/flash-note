import { describe, it, expect, beforeEach, vi, afterEach, type MockInstance } from 'vitest';
import { GeminiProvider } from './gemini-provider';
import {
  RateLimitError,
  AuthenticationError,
  ContentBlockedError,
  TimeoutError,
  ParseError,
  InvalidRequestError,
  ProviderError,
  OutputTruncatedError,
  NetworkError,
} from './errors';
import type { LLMRequestConfig, LLMRetryConfig } from './types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Fast retry config for tests
const FAST_RETRY_CONFIG: LLMRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 10,
  maxDelayMs: 50,
  retryableErrors: ['rate_limited', 'overloaded', 'network_error', 'timeout', 'provider_error'] as const,
};

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let consoleErrorSpy: MockInstance;
  let consoleWarnSpy: MockInstance;

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
    mockFetch.mockReset();
    provider = new GeminiProvider({
      apiKey: 'test-api-key',
      model: 'gemini-2.5-flash',
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
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

      const result = await provider.generatePTNote('test system prompt', 'test user prompt', requestConfig);

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

      const result = await provider.generatePTNote('test system prompt', 'test user prompt', requestConfig);

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

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        ParseError,
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

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        ParseError,
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

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        ContentBlockedError,
      );
    });

    it('should throw RateLimitError for 429 response after retries exhausted', async () => {
      const errorResponse = {
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: { status: 'RESOURCE_EXHAUSTED' } }),
      };
      mockFetch.mockResolvedValue(errorResponse);

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        RateLimitError,
      );
    });

    it('should throw AuthenticationError for 401 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { status: 'UNAUTHENTICATED' } }),
      });

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        AuthenticationError,
      );
    });

    it('should throw ProviderError for 503 response after retries exhausted', async () => {
      const errorResponse = {
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: { status: 'SERVICE_UNAVAILABLE' } }),
      };
      mockFetch.mockResolvedValue(errorResponse);

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        ProviderError,
      );
    });

    it('should throw TimeoutError on abort after retries exhausted', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        TimeoutError,
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

      await provider.generatePTNote('test system prompt', 'test user prompt', requestConfig);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).not.toContain('test-api-key');
      expect((options as { headers: Record<string, string> }).headers['x-goog-api-key']).toBe(
        'test-api-key',
      );
    });

    it('should include systemInstruction in request body', async () => {
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

      await provider.generatePTNote('test system prompt', 'test user prompt', requestConfig);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse((options as { body: string }).body);
      expect(body.systemInstruction).toEqual({
        parts: [{ text: 'test system prompt' }],
      });
      expect(body.contents[0].parts[0].text).toBe('test user prompt');
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

      await provider.generatePTNote('test system prompt', 'test user prompt', requestConfig);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse((options as { body: string }).body);
      expect(body.generationConfig.responseMimeType).toBe('application/json');
      expect(body.generationConfig.responseSchema).toBeDefined();
    });

    it('should not log PHI in error messages', async () => {
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
        await provider.generatePTNote('test system prompt', 'sensitive patient data', requestConfig);
      } catch {
        // Expected
      }

      const logCall = consoleErrorSpy.mock.calls[0];
      expect(logCall).toBeDefined();
      expect(logCall[0]).toBe('Gemini API HTTP error:');
      expect(logCall[1]).toEqual({ status: 500 });
    });
  });

  describe('retry logic', () => {
    it('should retry on rate limit error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: { status: 'RESOURCE_EXHAUSTED' } }),
      });

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

      const result = await provider.generatePTNote('test system prompt', 'test user prompt', requestConfig);

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

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        AuthenticationError,
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

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        InvalidRequestError,
      );
    });

    it('should throw AuthenticationError for 403 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: { status: 'PERMISSION_DENIED' } }),
      });

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        AuthenticationError,
      );
    });

    it('should throw ProviderError for 500 response after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: { status: 'INTERNAL' } }),
      });

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        ProviderError,
      );
    });

    it('should throw ProviderError for 502 response after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: { status: 'BAD_GATEWAY' } }),
      });

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        ProviderError,
      );
    });

    it('should throw ProviderError for unexpected status codes after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 418,
        json: () => Promise.resolve({ error: { status: 'TEAPOT' } }),
      });

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        ProviderError,
      );
    });
  });

  describe('API error in response body', () => {
    it('should handle RESOURCE_EXHAUSTED error in response body after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            error: { status: 'RESOURCE_EXHAUSTED' },
          }),
      });

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        RateLimitError,
      );
    });

    it('should handle error code 400 in response body (non-retryable)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            error: { code: 400, status: 'INVALID_ARGUMENT' },
          }),
      });

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        InvalidRequestError,
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

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        ProviderError,
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

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        OutputTruncatedError,
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

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        OutputTruncatedError,
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

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        OutputTruncatedError,
      );
    });
  });

  describe('network error handling', () => {
    it('should throw NetworkError for generic fetch errors after retries exhausted', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        NetworkError,
      );
    });

    it('should throw NetworkError for non-Error objects after retries exhausted', async () => {
      mockFetch.mockRejectedValue('some string error');

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        NetworkError,
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

      await expect(provider.generatePTNote('test system prompt', 'test user prompt', requestConfig)).rejects.toThrow(
        ParseError,
      );
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

      const result = await provider.generatePTNote('test system prompt', 'test user prompt', requestConfig);

      expect(result.usage.inputTokens).toBe(0);
      expect(result.usage.outputTokens).toBe(0);
    });
  });

  describe('finish reason validation', () => {
    it('should throw ContentBlockedError for RECITATION finish reason', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(validPTNoteResponse) }] },
                finishReason: 'RECITATION',
              },
            ],
          }),
      });

      await expect(
        provider.generatePTNote('test system prompt', 'test user prompt', requestConfig),
      ).rejects.toThrow(ContentBlockedError);
    });

    it('should throw ContentBlockedError for OTHER finish reason', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(validPTNoteResponse) }] },
                finishReason: 'OTHER',
              },
            ],
          }),
      });

      await expect(
        provider.generatePTNote('test system prompt', 'test user prompt', requestConfig),
      ).rejects.toThrow(ContentBlockedError);
    });

    it('should throw ContentBlockedError for FINISH_REASON_UNSPECIFIED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(validPTNoteResponse) }] },
                finishReason: 'FINISH_REASON_UNSPECIFIED',
              },
            ],
          }),
      });

      await expect(
        provider.generatePTNote('test system prompt', 'test user prompt', requestConfig),
      ).rejects.toThrow(ContentBlockedError);
    });
  });

  describe('response validation', () => {
    it('should throw ParseError for malformed API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve('not an object'),
      });

      await expect(
        provider.generatePTNote('test system prompt', 'test user prompt', requestConfig),
      ).rejects.toThrow(ParseError);
    });

    it('should throw ParseError for response with wrong structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ unexpected: 'shape', candidates: 'not-array' }),
      });

      await expect(
        provider.generatePTNote('test system prompt', 'test user prompt', requestConfig),
      ).rejects.toThrow(ParseError);
    });
  });

  describe('ADC authentication', () => {
    it('should use bearer token when useADC is true', async () => {
      const adcProvider = new GeminiProvider({
        model: 'gemini-2.5-flash',
        apiUrl: 'https://us-central1-aiplatform.googleapis.com/v1/projects/test/locations/us-central1/publishers/google',
        useADC: true,
        retryConfig: FAST_RETRY_CONFIG,
      });

      // Mock the metadata server token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-adc-token', expires_in: 3600 }),
      });

      // Mock the actual API call
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

      await adcProvider.generatePTNote('test system', 'test user', requestConfig);

      // First call: metadata server
      const [metadataUrl, metadataOpts] = mockFetch.mock.calls[0];
      expect(metadataUrl).toBe(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      );
      expect((metadataOpts as { headers: Record<string, string> }).headers['Metadata-Flavor']).toBe('Google');

      // Second call: API with bearer token
      const [, apiOpts] = mockFetch.mock.calls[1];
      expect((apiOpts as { headers: Record<string, string> }).headers['Authorization']).toBe('Bearer test-adc-token');
      expect((apiOpts as { headers: Record<string, string> }).headers['x-goog-api-key']).toBeUndefined();
    });

    it('should throw error when neither apiKey nor useADC is provided', () => {
      expect(
        () =>
          new GeminiProvider({
            model: 'gemini-2.5-flash',
            apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
            retryConfig: FAST_RETRY_CONFIG,
          }),
      ).toThrow('GeminiProvider requires either apiKey or useADC=true');
    });

    it('should cache ADC token across requests', async () => {
      const adcProvider = new GeminiProvider({
        model: 'gemini-2.5-flash',
        apiUrl: 'https://us-central1-aiplatform.googleapis.com/v1/projects/test/locations/us-central1/publishers/google',
        useADC: true,
        retryConfig: FAST_RETRY_CONFIG,
      });

      // Mock token fetch (called once)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'cached-token', expires_in: 3600 }),
      });

      // Mock two API calls
      const apiResponse = {
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
      };
      mockFetch.mockResolvedValueOnce(apiResponse);
      mockFetch.mockResolvedValueOnce(apiResponse);

      await adcProvider.generatePTNote('test system', 'test user', requestConfig);
      await adcProvider.generatePTNote('test system', 'test user', requestConfig);

      // Token fetched once, API called twice = 3 total fetch calls
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw AuthenticationError when metadata server returns error', async () => {
      const adcProvider = new GeminiProvider({
        model: 'gemini-2.5-flash',
        apiUrl: 'https://us-central1-aiplatform.googleapis.com/v1/projects/test/locations/us-central1/publishers/google',
        useADC: true,
        retryConfig: { ...FAST_RETRY_CONFIG, maxRetries: 0 },
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      });

      await expect(
        adcProvider.generatePTNote('test system', 'test user', requestConfig),
      ).rejects.toThrow(AuthenticationError);
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

      await provider.generatePTNote('test system prompt', 'test user prompt', requestConfig);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse((options as { body: string }).body);
      const schema = body.generationConfig.responseSchema;

      expect(schema.type).toBe('OBJECT');
    });
  });
});
