/**
 * Tests for LLM abstraction layer exports.
 *
 * Verifies that all public exports are accessible and correctly typed.
 */
import { describe, it, expect } from 'vitest';

// Import all exports to verify they're accessible
import {
  // Types (existence verified through usage)
  DEFAULT_RETRY_CONFIG,

  // Errors
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

  // Schemas
  BillingChargeSchema,
  GoalStatusSchema,
  BillingSummarySchema,
  GoalsTrackingSchema,
  PTNoteOutputSchema,
  getPTNoteJsonSchema,
  validatePTNoteOutput,
  safeParsePTNoteOutput,

  // Provider base class
  BaseLLMProvider,

  // Provider implementations
  GeminiProvider,
  ClaudeProvider,

  // Factory
  createLLMProvider,
  getConfiguredProvider,
} from './index.js';

describe('LLM Index Exports', () => {
  describe('types', () => {
    it('should export DEFAULT_RETRY_CONFIG with expected properties', () => {
      expect(DEFAULT_RETRY_CONFIG).toBeDefined();
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBeDefined();
      expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBeDefined();
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBeDefined();
      expect(DEFAULT_RETRY_CONFIG.retryableErrors).toBeInstanceOf(Array);
    });
  });

  describe('error classes', () => {
    it('should export LLMError base class', () => {
      expect(LLMError).toBeDefined();
      const error = new LLMError('rate_limited', 'Test error', 'gemini', true);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(LLMError);
      expect(error.code).toBe('rate_limited');
      expect(error.provider).toBe('gemini');
    });

    it('should export RateLimitError', () => {
      expect(RateLimitError).toBeDefined();
      const error = new RateLimitError('gemini', 5000);
      expect(error).toBeInstanceOf(LLMError);
      expect(error.code).toBe('rate_limited');
      expect(error.retryable).toBe(true);
      expect(error.retryAfterMs).toBe(5000);
    });

    it('should export OverloadedError', () => {
      expect(OverloadedError).toBeDefined();
      const error = new OverloadedError('claude');
      expect(error).toBeInstanceOf(LLMError);
      expect(error.code).toBe('overloaded');
    });

    it('should export AuthenticationError', () => {
      expect(AuthenticationError).toBeDefined();
      const error = new AuthenticationError('gemini');
      expect(error).toBeInstanceOf(LLMError);
      expect(error.code).toBe('auth_error');
      expect(error.retryable).toBe(false);
    });

    it('should export InvalidRequestError', () => {
      expect(InvalidRequestError).toBeDefined();
      const error = new InvalidRequestError('claude', 'bad request');
      expect(error).toBeInstanceOf(LLMError);
      expect(error.code).toBe('invalid_request');
    });

    it('should export ContentBlockedError', () => {
      expect(ContentBlockedError).toBeDefined();
      const error = new ContentBlockedError('gemini');
      expect(error).toBeInstanceOf(LLMError);
      expect(error.code).toBe('content_blocked');
    });

    it('should export OutputTruncatedError', () => {
      expect(OutputTruncatedError).toBeDefined();
      const error = new OutputTruncatedError('claude');
      expect(error).toBeInstanceOf(LLMError);
      expect(error.code).toBe('output_truncated');
    });

    it('should export TimeoutError', () => {
      expect(TimeoutError).toBeDefined();
      const error = new TimeoutError('gemini', 30000);
      expect(error).toBeInstanceOf(LLMError);
      expect(error.code).toBe('timeout');
      expect(error.retryable).toBe(true);
    });

    it('should export NetworkError', () => {
      expect(NetworkError).toBeDefined();
      const error = new NetworkError('claude');
      expect(error).toBeInstanceOf(LLMError);
      expect(error.code).toBe('network_error');
      expect(error.retryable).toBe(true);
    });

    it('should export ProviderError', () => {
      expect(ProviderError).toBeDefined();
      const error = new ProviderError('gemini', 500);
      expect(error).toBeInstanceOf(LLMError);
      expect(error.code).toBe('provider_error');
    });

    it('should export ParseError', () => {
      expect(ParseError).toBeDefined();
      const error = new ParseError('claude', 'invalid JSON');
      expect(error).toBeInstanceOf(LLMError);
      expect(error.code).toBe('parse_error');
      expect(error.retryable).toBe(false);
    });
  });

  describe('schema exports', () => {
    it('should export BillingChargeSchema', () => {
      expect(BillingChargeSchema).toBeDefined();
      const result = BillingChargeSchema.safeParse({
        cptCode: '97110',
        description: 'Therapeutic Exercise',
        minutes: 23,
        units: 2,
      });
      expect(result.success).toBe(true);
    });

    it('should export GoalStatusSchema', () => {
      expect(GoalStatusSchema).toBeDefined();
      const result = GoalStatusSchema.safeParse({
        description: 'Increase ROM to 90 degrees',
        status: 'progressing',
        percentComplete: 75,
      });
      expect(result.success).toBe(true);
    });

    it('should export BillingSummarySchema', () => {
      expect(BillingSummarySchema).toBeDefined();
      const result = BillingSummarySchema.safeParse({
        charges: [
          { cptCode: '97110', description: 'Therapeutic Exercise', minutes: 23, units: 2 },
        ],
        totalTimedMinutes: 23,
        totalUnits: 2,
      });
      expect(result.success).toBe(true);
    });

    it('should export GoalsTrackingSchema', () => {
      expect(GoalsTrackingSchema).toBeDefined();
      const result = GoalsTrackingSchema.safeParse({
        shortTerm: [{ description: 'Increase ROM to 90 degrees', status: 'progressing' }],
        longTerm: [],
      });
      expect(result.success).toBe(true);
    });

    it('should export PTNoteOutputSchema', () => {
      expect(PTNoteOutputSchema).toBeDefined();
      const result = PTNoteOutputSchema.safeParse({
        subjective: 'Patient reports pain',
        objective: 'ROM: 90 degrees',
        assessment: 'Making progress',
        plan: 'Continue therapy',
      });
      expect(result.success).toBe(true);
    });

    it('should export getPTNoteJsonSchema function', () => {
      expect(getPTNoteJsonSchema).toBeDefined();
      expect(typeof getPTNoteJsonSchema).toBe('function');
      const schema = getPTNoteJsonSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
    });

    it('should export validatePTNoteOutput function', () => {
      expect(validatePTNoteOutput).toBeDefined();
      expect(typeof validatePTNoteOutput).toBe('function');

      const validNote = {
        subjective: 'Patient reports pain',
        objective: 'ROM: 90 degrees',
        assessment: 'Making progress',
        plan: 'Continue therapy',
      };

      const result = validatePTNoteOutput(validNote);
      expect(result.subjective).toBe(validNote.subjective);
    });

    it('should export safeParsePTNoteOutput function', () => {
      expect(safeParsePTNoteOutput).toBeDefined();
      expect(typeof safeParsePTNoteOutput).toBe('function');

      // safeParsePTNoteOutput returns null on invalid input
      const result = safeParsePTNoteOutput({ invalid: 'data' });
      expect(result).toBeNull();
    });
  });

  describe('provider classes', () => {
    it('should export BaseLLMProvider abstract class', () => {
      expect(BaseLLMProvider).toBeDefined();
    });

    it('should export GeminiProvider class', () => {
      expect(GeminiProvider).toBeDefined();
      const provider = new GeminiProvider({
        apiKey: 'test-key',
        model: 'gemini-2.5-flash',
      });
      expect(provider.name).toBe('gemini');
      expect(provider.model).toBe('gemini-2.5-flash');
    });

    it('should export ClaudeProvider class', () => {
      expect(ClaudeProvider).toBeDefined();
      const provider = new ClaudeProvider({
        apiKey: 'test-key',
        model: 'claude-3-5-sonnet-20241022',
      });
      expect(provider.name).toBe('claude');
      expect(provider.model).toBe('claude-3-5-sonnet-20241022');
    });
  });

  describe('factory functions', () => {
    it('should export createLLMProvider function', () => {
      expect(createLLMProvider).toBeDefined();
      expect(typeof createLLMProvider).toBe('function');

      const provider = createLLMProvider('gemini', {
        provider: 'gemini',
        geminiApiKey: 'test-key',
        geminiModel: 'gemini-2.5-flash',
      });
      expect(provider.name).toBe('gemini');
    });

    it('should export getConfiguredProvider function', () => {
      expect(getConfiguredProvider).toBeDefined();
      expect(typeof getConfiguredProvider).toBe('function');

      const provider = getConfiguredProvider({
        provider: 'claude',
        claudeApiKey: 'test-key',
        claudeModel: 'claude-3-5-sonnet-20241022',
      });
      expect(provider.name).toBe('claude');
    });
  });
});
