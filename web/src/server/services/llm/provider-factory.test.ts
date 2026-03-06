/**
 * Tests for LLM provider factory.
 *
 * Tests provider creation, configuration validation, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLLMProvider, getConfiguredProvider } from './provider-factory';
import { GeminiProvider } from './gemini-provider';
import { ClaudeProvider } from './claude-provider';

describe('LLM Provider Factory', () => {
  describe('createLLMProvider', () => {
    describe('Gemini provider', () => {
      it('should create a GeminiProvider with valid config', () => {
        const provider = createLLMProvider('gemini', {
          provider: 'gemini',
          geminiApiKey: 'test-api-key',
          geminiModel: 'gemini-2.5-flash',
          geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        });

        expect(provider).toBeInstanceOf(GeminiProvider);
        expect(provider.name).toBe('gemini');
        expect(provider.model).toBe('gemini-2.5-flash');
      });

      it('should throw error when geminiApiKey is missing and ADC is not enabled', () => {
        expect(() =>
          createLLMProvider('gemini', {
            provider: 'gemini',
            geminiModel: 'gemini-2.5-flash',
          }),
        ).toThrow('GEMINI_API_KEY is required when LLM_PROVIDER=gemini');
      });

      it('should create GeminiProvider with ADC and no API key', () => {
        const provider = createLLMProvider('gemini', {
          provider: 'gemini',
          geminiModel: 'gemini-2.5-flash',
          geminiApiUrl: 'https://us-central1-aiplatform.googleapis.com/v1/projects/test/locations/us-central1/publishers/google',
          geminiUseADC: true,
        });

        expect(provider).toBeInstanceOf(GeminiProvider);
        expect(provider.name).toBe('gemini');
      });

      it('should throw error when geminiModel is missing', () => {
        expect(() =>
          createLLMProvider('gemini', {
            provider: 'gemini',
            geminiApiKey: 'test-api-key',
          }),
        ).toThrow('GEMINI_MODEL is required when LLM_PROVIDER=gemini');
      });

      it('should throw error when geminiApiUrl is missing', () => {
        expect(() =>
          createLLMProvider('gemini', {
            provider: 'gemini',
            geminiApiKey: 'test-api-key',
            geminiModel: 'gemini-2.5-flash',
          }),
        ).toThrow('GEMINI_API_URL is required when LLM_PROVIDER=gemini');
      });

      it('should throw error when geminiApiKey is empty string', () => {
        expect(() =>
          createLLMProvider('gemini', {
            provider: 'gemini',
            geminiApiKey: '',
            geminiModel: 'gemini-2.5-flash',
            geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
          }),
        ).toThrow('GEMINI_API_KEY is required when LLM_PROVIDER=gemini');
      });

      it('should throw error when geminiModel is empty string', () => {
        expect(() =>
          createLLMProvider('gemini', {
            provider: 'gemini',
            geminiApiKey: 'test-api-key',
            geminiModel: '',
            geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
          }),
        ).toThrow('GEMINI_MODEL is required when LLM_PROVIDER=gemini');
      });
    });

    describe('Claude provider', () => {
      it('should create a ClaudeProvider with valid config', () => {
        const provider = createLLMProvider('claude', {
          provider: 'claude',
          claudeApiKey: 'test-api-key',
          claudeModel: 'claude-sonnet-4-20250514',
        });

        expect(provider).toBeInstanceOf(ClaudeProvider);
        expect(provider.name).toBe('claude');
        expect(provider.model).toBe('claude-sonnet-4-20250514');
      });

      it('should throw error when claudeApiKey is missing', () => {
        expect(() =>
          createLLMProvider('claude', {
            provider: 'claude',
            claudeModel: 'claude-sonnet-4-20250514',
          }),
        ).toThrow('ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude');
      });

      it('should throw error when claudeModel is missing', () => {
        expect(() =>
          createLLMProvider('claude', {
            provider: 'claude',
            claudeApiKey: 'test-api-key',
          }),
        ).toThrow('ANTHROPIC_MODEL is required when LLM_PROVIDER=claude');
      });

      it('should throw error when claudeApiKey is empty string', () => {
        expect(() =>
          createLLMProvider('claude', {
            provider: 'claude',
            claudeApiKey: '',
            claudeModel: 'claude-sonnet-4-20250514',
          }),
        ).toThrow('ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude');
      });

      it('should throw error when claudeModel is empty string', () => {
        expect(() =>
          createLLMProvider('claude', {
            provider: 'claude',
            claudeApiKey: 'test-api-key',
            claudeModel: '',
          }),
        ).toThrow('ANTHROPIC_MODEL is required when LLM_PROVIDER=claude');
      });
    });

    describe('unknown provider', () => {
      it('should throw error for unknown provider type', () => {
        expect(() =>
          createLLMProvider('unknown' as 'gemini', {
            provider: 'unknown' as 'gemini',
          }),
        ).toThrow('Unknown LLM provider: unknown');
      });
    });
  });

  describe('getConfiguredProvider', () => {
    it('should create Gemini provider from config', () => {
      const provider = getConfiguredProvider({
        provider: 'gemini',
        geminiApiKey: 'test-api-key',
        geminiModel: 'gemini-2.5-flash',
        geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
      });

      expect(provider).toBeInstanceOf(GeminiProvider);
      expect(provider.name).toBe('gemini');
    });

    it('should create Claude provider from config', () => {
      const provider = getConfiguredProvider({
        provider: 'claude',
        claudeApiKey: 'test-api-key',
        claudeModel: 'claude-sonnet-4-20250514',
      });

      expect(provider).toBeInstanceOf(ClaudeProvider);
      expect(provider.name).toBe('claude');
    });

    it('should pass through error from createLLMProvider', () => {
      expect(() =>
        getConfiguredProvider({
          provider: 'gemini',
        }),
      ).toThrow('GEMINI_API_KEY is required');
    });

    it('should work with all provider-specific config options', () => {
      const geminiProvider = getConfiguredProvider({
        provider: 'gemini',
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-2.5-flash',
        geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        claudeApiKey: 'claude-key',
        claudeModel: 'claude-model',
      });

      expect(geminiProvider.name).toBe('gemini');

      const claudeProvider = getConfiguredProvider({
        provider: 'claude',
        geminiApiKey: 'gemini-key',
        geminiModel: 'gemini-model',
        geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        claudeApiKey: 'claude-key',
        claudeModel: 'claude-sonnet-4-20250514',
      });

      expect(claudeProvider.name).toBe('claude');
    });
  });

  describe('getConfiguredProvider caching', () => {
    let freshGetConfiguredProvider: typeof getConfiguredProvider;

    beforeEach(async () => {
      vi.resetModules();
      const mod = await import('./provider-factory');
      freshGetConfiguredProvider = mod.getConfiguredProvider;
    });

    const geminiConfig = {
      provider: 'gemini' as const,
      geminiApiKey: 'cache-test-key',
      geminiModel: 'gemini-2.5-flash',
      geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
    };

    it('should return the same instance for identical config', () => {
      const first = freshGetConfiguredProvider(geminiConfig);
      const second = freshGetConfiguredProvider(geminiConfig);

      expect(second).toBe(first);
    });

    it('should return a new instance when config changes', () => {
      const first = freshGetConfiguredProvider(geminiConfig);
      const second = freshGetConfiguredProvider({
        provider: 'claude',
        claudeApiKey: 'cache-test-key',
        claudeModel: 'claude-sonnet-4-20250514',
      });

      expect(second).not.toBe(first);
      expect(second.name).toBe('claude');
    });

    it('should invalidate cache when model changes', () => {
      const first = freshGetConfiguredProvider(geminiConfig);
      const second = freshGetConfiguredProvider({
        ...geminiConfig,
        geminiModel: 'gemini-2.0-flash',
      });

      expect(second).not.toBe(first);
      expect(second.model).toBe('gemini-2.0-flash');
    });
  });
});
