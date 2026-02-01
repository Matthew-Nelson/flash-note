import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClaudeProvider } from './claude-provider.js';
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

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  const requestConfig: LLMRequestConfig = {
    maxTokens: 2000,
    temperature: 0.7,
    timeoutMs: 30000,
  };

  const validPTNoteInput = {
    subjective: 'Patient reports pain 4/10.',
    objective: 'ROM: Knee flexion 110 degrees.',
    assessment: 'Good progress.',
    plan: 'Continue PT 2x/week.',
  };

  const createToolUseResponse = (input: unknown) => ({
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'generate_pt_note',
        input,
      },
    ],
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'tool_use',
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
  });

  beforeEach(() => {
    mockFetch.mockReset(); // Reset mock implementations, not just call history
    provider = new ClaudeProvider({
      apiKey: 'test-api-key',
      model: 'claude-sonnet-4-20250514',
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
        headers: new Headers(),
        json: () => Promise.resolve(createToolUseResponse(validPTNoteInput)),
      });

      const result = await provider.generatePTNote('test prompt', requestConfig);

      expect(result.note.subjective).toBe(validPTNoteInput.subjective);
      expect(result.note.objective).toBe(validPTNoteInput.objective);
      expect(result.note.assessment).toBe(validPTNoteInput.assessment);
      expect(result.note.plan).toBe(validPTNoteInput.plan);
      expect(result.usage.totalTokens).toBe(150);
    });

    it('should include billing information when provided', async () => {
      const inputWithBilling = {
        ...validPTNoteInput,
        billing: {
          charges: [{ cptCode: '97110', description: 'Therapeutic Exercise', minutes: 23, units: 2 }],
          totalTimedMinutes: 23,
          totalUnits: 2,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(createToolUseResponse(inputWithBilling)),
      });

      const result = await provider.generatePTNote('test prompt', requestConfig);

      expect(result.note.billing).toBeDefined();
      expect(result.note.billing!.charges).toHaveLength(1);
    });

    it('should throw ParseError when no tool_use block in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            content: [{ type: 'text', text: 'Some text response' }],
            stop_reason: 'end_turn',
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ParseError
      );
    });

    it('should throw ParseError for tool input not matching schema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(createToolUseResponse({ invalid: 'schema' })),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ParseError
      );
    });

    it('should throw ContentBlockedError for refusal stop reason', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            content: [],
            stop_reason: 'refusal',
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ContentBlockedError
      );
    });

    it('should throw RateLimitError for 429 response after retries exhausted', async () => {
      // Mock persistent error to exhaust all retries
      const errorResponse = {
        ok: false,
        status: 429,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { type: 'rate_limit_error', message: 'Rate limited' } }),
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
        headers: new Headers(),
        json: () =>
          Promise.resolve({ error: { type: 'authentication_error', message: 'Invalid API key' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should throw OverloadedError for 529 response after retries exhausted', async () => {
      // Mock persistent error to exhaust all retries
      const errorResponse = {
        ok: false,
        status: 529,
        headers: new Headers(),
        json: () =>
          Promise.resolve({ error: { type: 'overloaded_error', message: 'Overloaded' } }),
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

    it('should use correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(createToolUseResponse(validPTNoteInput)),
      });

      await provider.generatePTNote('test prompt', requestConfig);

      const [, options] = mockFetch.mock.calls[0]!;
      const headers = (options as { headers: Record<string, string> }).headers;
      expect(headers['x-api-key']).toBe('test-api-key');
      expect(headers['anthropic-version']).toBe('2023-06-01');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should include tool definition in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(createToolUseResponse(validPTNoteInput)),
      });

      await provider.generatePTNote('test prompt', requestConfig);

      const [, options] = mockFetch.mock.calls[0]!;
      const body = JSON.parse((options as { body: string }).body);
      expect(body.tools).toHaveLength(1);
      expect(body.tools[0].name).toBe('generate_pt_note');
      expect(body.tool_choice).toEqual({ type: 'tool', name: 'generate_pt_note' });
    });

    it('should not log PHI in error messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            error: { type: 'api_error', message: 'Error with patient data: John Doe' },
          }),
      });

      try {
        await provider.generatePTNote('sensitive patient data', requestConfig);
      } catch {
        // Expected
      }

      // Verify that logged error does not contain the error message (which might have PHI)
      const logCall = consoleErrorSpy.mock.calls[0];
      expect(logCall).toBeDefined();
      expect(logCall![0]).toBe('Claude API HTTP error:');
      expect(logCall![1]).toEqual({ status: 500 });
    });
  });

  describe('generateCompletion', () => {
    it('should return raw text completion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            content: [{ type: 'text', text: 'Raw text response' }],
            stop_reason: 'end_turn',
            usage: {
              input_tokens: 50,
              output_tokens: 20,
            },
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.content).toBe('Raw text response');
      expect(result.finishReason).toBe('complete');
      expect(result.usage.inputTokens).toBe(50);
      expect(result.usage.outputTokens).toBe(20);
      expect(result.usage.totalTokens).toBe(70);
      expect(result.provider).toBe('claude');
    });

    it('should map max_tokens stop reason to length', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            content: [{ type: 'text', text: 'Truncated...' }],
            stop_reason: 'max_tokens',
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.finishReason).toBe('length');
    });

    it('should handle empty content gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            content: [],
            stop_reason: 'end_turn',
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.content).toBe('');
    });
  });

  describe('healthCheck', () => {
    it('should return true for successful API response', async () => {
      mockFetch.mockResolvedValueOnce({ status: 200 });

      const result = await provider.healthCheck();

      expect(result).toBe(true);
    });

    it('should return true for 400 response (valid key, bad request)', async () => {
      mockFetch.mockResolvedValueOnce({ status: 400 });

      const result = await provider.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false for 401 response', async () => {
      mockFetch.mockResolvedValueOnce({ status: 401 });

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
        headers: new Headers(),
        json: () => Promise.resolve({ error: { type: 'rate_limit_error' } }),
      });

      // Second call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(createToolUseResponse(validPTNoteInput)),
      });

      const result = await provider.generatePTNote('test prompt', requestConfig);

      expect(result.note.subjective).toBe(validPTNoteInput.subjective);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith('LLM retry attempt:', expect.any(Object));
    });

    it('should respect retry-after header', async () => {
      const headers = new Headers();
      headers.set('retry-after', '2');

      // First call: rate limited with retry-after
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers,
        json: () => Promise.resolve({ error: { type: 'rate_limit_error' } }),
      });

      // Second call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(createToolUseResponse(validPTNoteInput)),
      });

      const result = await provider.generatePTNote('test prompt', requestConfig);

      expect(result.note.subjective).toBe(validPTNoteInput.subjective);
      // Check that retry was logged with correct delay
      const warnCall = consoleWarnSpy.mock.calls.find(
        (call: unknown[]) => call[0] === 'LLM retry attempt:'
      );
      expect(warnCall).toBeDefined();
      expect(warnCall![1]).toHaveProperty('delayMs');
    });

    it('should not retry on auth error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { type: 'authentication_error' } }),
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
        headers: new Headers(),
        json: () => Promise.resolve({ error: { type: 'invalid_request_error', message: 'Bad request' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        InvalidRequestError
      );
    });

    it('should throw AuthenticationError for 403 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { type: 'permission_error', message: 'Forbidden' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should throw ProviderError for 500 response after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { type: 'api_error', message: 'Internal error' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ProviderError
      );
    });

    it('should throw ProviderError for 502 response after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { type: 'api_error', message: 'Bad gateway' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ProviderError
      );
    });

    it('should throw ProviderError for 503 response after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { type: 'api_error', message: 'Service unavailable' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ProviderError
      );
    });

    it('should throw ProviderError for unexpected status codes after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 418,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { type: 'unknown', message: 'Teapot' } }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ProviderError
      );
    });
  });

  describe('API error handling', () => {
    it('should handle invalid_request_error in response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            error: { type: 'invalid_request_error', message: 'Invalid request' },
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        InvalidRequestError
      );
    });

    it('should handle authentication_error in response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            error: { type: 'authentication_error', message: 'Invalid API key' },
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should handle rate_limit_error in response body after retries exhausted', async () => {
      // Rate limit error is retryable, so use persistent mock
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            error: { type: 'rate_limit_error', message: 'Rate limited' },
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        RateLimitError
      );
    });

    it('should handle overloaded_error in response body after retries exhausted', async () => {
      // Overloaded error is retryable, so use persistent mock
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            error: { type: 'overloaded_error', message: 'Overloaded' },
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        OverloadedError
      );
    });

    it('should handle api_error in response body after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            error: { type: 'api_error', message: 'Server error' },
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ProviderError
      );
    });

    it('should handle unknown error type in response body after retries exhausted', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            error: { type: 'unknown_error_type', message: 'Unknown' },
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        ProviderError
      );
    });
  });

  describe('stop reason handling', () => {
    it('should throw OutputTruncatedError for max_tokens with no tool_use block', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            content: [{ type: 'text', text: 'Truncated text' }],
            stop_reason: 'max_tokens',
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        OutputTruncatedError
      );
    });

    it('should throw OutputTruncatedError for max_tokens when schema validation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            content: [
              {
                type: 'tool_use',
                id: 'toolu_123',
                name: 'generate_pt_note',
                input: { subjective: 'only' }, // Invalid - missing required fields
              },
            ],
            stop_reason: 'max_tokens',
          }),
      });

      await expect(provider.generatePTNote('test prompt', requestConfig)).rejects.toThrow(
        OutputTruncatedError
      );
    });

    it('should map stop_sequence stop reason to complete', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            content: [{ type: 'text', text: 'Some content' }],
            stop_reason: 'stop_sequence',
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.finishReason).toBe('complete');
    });

    it('should map tool_use stop reason to complete', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            content: [{ type: 'text', text: 'Some content' }],
            stop_reason: 'tool_use',
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.finishReason).toBe('complete');
    });

    it('should map pause_turn stop reason to complete', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            content: [{ type: 'text', text: 'Some content' }],
            stop_reason: 'pause_turn',
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.finishReason).toBe('complete');
    });

    it('should map refusal stop reason to content_filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            content: [{ type: 'text', text: 'Some content' }],
            stop_reason: 'refusal',
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.finishReason).toBe('content_filter');
    });

    it('should map undefined stop reason to error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            content: [{ type: 'text', text: 'Some content' }],
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

  describe('usage metadata handling', () => {
    it('should handle missing usage metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            content: [
              {
                type: 'tool_use',
                id: 'toolu_123',
                name: 'generate_pt_note',
                input: validPTNoteInput,
              },
            ],
            stop_reason: 'tool_use',
          }),
      });

      const result = await provider.generatePTNote('test prompt', requestConfig);

      expect(result.usage.inputTokens).toBe(0);
      expect(result.usage.outputTokens).toBe(0);
      expect(result.usage.totalTokens).toBe(0);
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
        headers: new Headers(),
        json: () => Promise.resolve({ error: { type: 'authentication_error' } }),
      });

      await expect(provider.generateCompletion('test prompt', requestConfig)).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should handle API errors in generateCompletion', async () => {
      // Rate limit error is retryable, so use persistent mock
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            error: { type: 'rate_limit_error' },
          }),
      });

      await expect(provider.generateCompletion('test prompt', requestConfig)).rejects.toThrow(
        RateLimitError
      );
    });

    it('should handle missing content in generateCompletion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            stop_reason: 'end_turn',
          }),
      });

      const result = await provider.generateCompletion('test prompt', requestConfig);

      expect(result.content).toBe('');
    });
  });

  describe('custom configuration', () => {
    it('should use custom API URL when provided', async () => {
      const customProvider = new ClaudeProvider({
        apiKey: 'test-key',
        model: 'claude-3-5-sonnet-20241022',
        apiUrl: 'https://custom.api.com',
        retryConfig: FAST_RETRY_CONFIG,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(createToolUseResponse(validPTNoteInput)),
      });

      await customProvider.generatePTNote('test', requestConfig);

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toBe('https://custom.api.com/v1/messages');
    });

    it('should use custom API version when provided', async () => {
      const customProvider = new ClaudeProvider({
        apiKey: 'test-key',
        model: 'claude-3-5-sonnet-20241022',
        apiVersion: '2024-01-01',
        retryConfig: FAST_RETRY_CONFIG,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: () => Promise.resolve(createToolUseResponse(validPTNoteInput)),
      });

      await customProvider.generatePTNote('test', requestConfig);

      const [, options] = mockFetch.mock.calls[0]!;
      const headers = (options as { headers: Record<string, string> }).headers;
      expect(headers['anthropic-version']).toBe('2024-01-01');
    });
  });
});
