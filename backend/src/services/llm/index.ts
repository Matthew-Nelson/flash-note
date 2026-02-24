/**
 * LLM Abstraction Layer
 *
 * Provides a unified interface for LLM providers (Gemini, Claude) with:
 * - Consistent response types
 * - Automatic retry with exponential backoff
 * - Structured output via JSON mode / tool use
 * - HIPAA-compliant error handling
 *
 * @example
 * ```typescript
 * import { getConfiguredProvider, type LLMRequestConfig } from './llm/index.js';
 *
 * const provider = getConfiguredProvider(config);
 *
 * const requestConfig: LLMRequestConfig = {
 *   maxTokens: 2000,
 *   temperature: 0.2,
 *   timeoutMs: 30000,
 * };
 *
 * const note = await provider.generatePTNote(systemPrompt, userPrompt, requestConfig);
 * ```
 */

// Types
export type {
  LLMProviderType,
  LLMFinishReason,
  LLMUsage,
  LLMCompletionResult,
  LLMRequestConfig,
  LLMRetryConfig,
  LLMErrorCode,
  PTNoteResult,
} from './types.js';

export { DEFAULT_RETRY_CONFIG } from './types.js';

// Errors
export {
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

// Schemas
export type {
  BillingCharge,
  GoalStatus,
  BillingSummary,
  GoalsTracking,
  PTNoteOutput,
  ClinicalSetting,
} from './schemas.js';

export {
  BillingChargeSchema,
  GoalStatusSchema,
  BillingSummarySchema,
  GoalsTrackingSchema,
  PTNoteOutputSchema,
  getPTNoteJsonSchema,
  validatePTNoteOutput,
  safeParsePTNoteOutput,
} from './schemas.js';

// Provider interface
export type { LLMProvider } from './provider.js';
export { BaseLLMProvider } from './provider.js';

// Provider implementations
export { GeminiProvider, type GeminiProviderConfig } from './gemini-provider.js';
export { ClaudeProvider, type ClaudeProviderConfig } from './claude-provider.js';

// Factory
export { createLLMProvider, getConfiguredProvider, type LLMFactoryConfig } from './provider-factory.js';
