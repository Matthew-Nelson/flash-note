/**
 * Factory for creating LLM providers based on configuration.
 *
 * Provider selection happens at startup based on environment configuration.
 * Switching providers requires a restart.
 */

import type { LLMProvider } from './provider.js';
import type { LLMProviderType } from './types.js';
import { GeminiProvider } from './gemini-provider.js';
import { ClaudeProvider } from './claude-provider.js';

/**
 * Configuration for provider factory.
 */
export interface LLMFactoryConfig {
  provider: LLMProviderType;

  // Gemini config
  geminiApiKey?: string;
  geminiModel?: string;

  // Claude config
  claudeApiKey?: string;
  claudeModel?: string;
}

/**
 * Create an LLM provider based on the specified type.
 *
 * @param type - The provider type to create
 * @param config - Configuration for the provider
 * @returns Configured LLM provider instance
 * @throws Error if required configuration is missing
 */
export function createLLMProvider(
  type: LLMProviderType,
  config: LLMFactoryConfig
): LLMProvider {
  switch (type) {
    case 'gemini': {
      if (!config.geminiApiKey) {
        throw new Error('GEMINI_API_KEY is required when LLM_PROVIDER=gemini');
      }
      if (!config.geminiModel) {
        throw new Error('GEMINI_MODEL is required when LLM_PROVIDER=gemini');
      }
      return new GeminiProvider({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
      });
    }

    case 'claude': {
      if (!config.claudeApiKey) {
        throw new Error('ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude');
      }
      if (!config.claudeModel) {
        throw new Error('ANTHROPIC_MODEL is required when LLM_PROVIDER=claude');
      }
      return new ClaudeProvider({
        apiKey: config.claudeApiKey,
        model: config.claudeModel,
      });
    }

    default:
      throw new Error(`Unknown LLM provider: ${type as string}`);
  }
}

/**
 * Create the configured LLM provider from environment config.
 *
 * This is the main entry point for getting a provider instance.
 * Uses the LLM_PROVIDER environment variable to determine which provider to use.
 *
 * @param config - Full configuration object
 * @returns Configured LLM provider instance
 */
export function getConfiguredProvider(config: LLMFactoryConfig): LLMProvider {
  return createLLMProvider(config.provider, config);
}
