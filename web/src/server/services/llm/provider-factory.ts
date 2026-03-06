import 'server-only';

/**
 * Factory for creating LLM providers based on configuration.
 *
 * Uses dependency injection — config is passed as a parameter, not read at module scope.
 * This improves testability and keeps config sourcing in the caller (AI service).
 */

import type { LLMProvider } from './provider';
import type { LLMProviderType } from './types';
import { GeminiProvider } from './gemini-provider';
import { ClaudeProvider } from './claude-provider';

export interface LLMFactoryConfig {
  provider: LLMProviderType;

  // Gemini config
  geminiApiKey?: string;
  geminiModel?: string;
  geminiApiUrl?: string;
  /** Use ADC (service account) auth instead of API key. Required for Vertex AI on Cloud Run. */
  geminiUseADC?: boolean;

  // Claude config
  claudeApiKey?: string;
  claudeModel?: string;
}

/**
 * Create an LLM provider based on the specified type.
 *
 * @throws Error if required configuration is missing
 */
export function createLLMProvider(
  type: LLMProviderType,
  config: LLMFactoryConfig,
): LLMProvider {
  switch (type) {
    case 'gemini': {
      if (!config.geminiUseADC && !config.geminiApiKey) {
        throw new Error('GEMINI_API_KEY is required when LLM_PROVIDER=gemini (unless GEMINI_USE_ADC=true)');
      }
      if (!config.geminiModel) {
        throw new Error('GEMINI_MODEL is required when LLM_PROVIDER=gemini');
      }
      if (!config.geminiApiUrl) {
        throw new Error('GEMINI_API_URL is required when LLM_PROVIDER=gemini');
      }
      return new GeminiProvider({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        apiUrl: config.geminiApiUrl,
        useADC: config.geminiUseADC,
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
 * Module-level singleton cache for the configured LLM provider.
 *
 * The provider instance holds an ADC token cache (GeminiProvider) that avoids
 * re-fetching short-lived OAuth2 tokens from the metadata server on every request.
 * Creating a new instance per request means the token cache is always cold.
 *
 * The provider is stateless beyond the token cache — safe for concurrent use.
 * Config values come from env vars which are static for the lifetime of the process.
 */
let cachedProvider: LLMProvider | null = null;
let cachedConfigKey: string | null = null;

/**
 * Create the configured LLM provider from a config object.
 *
 * Returns a cached singleton when called with the same config. The cache is
 * invalidated if config values change (shouldn't happen in production, but
 * handles test scenarios and config reloads gracefully).
 */
export function getConfiguredProvider(config: LLMFactoryConfig): LLMProvider {
  // Build a stable key from config values that affect provider construction
  const configKey = JSON.stringify([
    config.provider,
    config.geminiApiKey,
    config.geminiModel,
    config.geminiApiUrl,
    config.geminiUseADC,
    config.claudeApiKey,
    config.claudeModel,
  ]);

  if (cachedProvider && cachedConfigKey === configKey) {
    return cachedProvider;
  }

  cachedProvider = createLLMProvider(config.provider, config);
  cachedConfigKey = configKey;
  return cachedProvider;
}
