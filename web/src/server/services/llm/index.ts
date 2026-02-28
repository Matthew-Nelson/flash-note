import 'server-only';

/**
 * LLM Abstraction Layer
 *
 * Provides a unified interface for LLM providers (Gemini, Claude) with:
 * - Consistent response types
 * - Automatic retry with exponential backoff
 * - Structured output via JSON mode / tool use
 * - HIPAA-compliant error handling
 */

// Types
export type {
  LLMProviderType,
  LLMUsage,
  LLMRequestConfig,
  LLMRetryConfig,
  LLMErrorCode,
  PTNoteResult,
} from './types';

export { DEFAULT_RETRY_CONFIG } from './types';

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
} from './errors';

// Schemas
export type {
  BillingCharge,
  GoalStatus,
  BillingSummary,
  GoalsTracking,
  PTNoteOutput,
  ClinicalSetting,
} from './schemas';

export {
  BillingChargeSchema,
  GoalStatusSchema,
  BillingSummarySchema,
  GoalsTrackingSchema,
  PTNoteOutputSchema,
  getPTNoteJsonSchema,
  validatePTNoteOutput,
  safeParsePTNoteOutput,
} from './schemas';

// Provider interface
export type { LLMProvider } from './provider';
export { BaseLLMProvider } from './provider';

// Provider implementations
export { GeminiProvider, type GeminiProviderConfig } from './gemini-provider';
export { ClaudeProvider, type ClaudeProviderConfig } from './claude-provider';

// Factory
export { createLLMProvider, getConfiguredProvider, type LLMFactoryConfig } from './provider-factory';
