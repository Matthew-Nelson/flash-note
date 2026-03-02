import 'server-only';

import { z } from 'zod';

/**
 * Parse a string env var as a boolean.
 *
 * z.coerce.boolean() uses Boolean(value), which treats ANY non-empty string
 * as true — including "false". Env vars are always strings, so "false" would
 * be coerced to true. This helper only treats "true" (case-insensitive) and
 * "1" as true; everything else (including "false", "0", undefined) is false.
 */
const envBoolean = z
  .string()
  .optional()
  .transform((val) => val?.toLowerCase() === 'true' || val === '1')
  .pipe(z.boolean());

/**
 * Server configuration — Zod-validated environment variables.
 *
 * Only includes variables needed by the DAL and database layer.
 * Expand in later phases as services are ported.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // L-7 fix: Validate DATABASE_URL starts with postgres:// or postgresql://
  DATABASE_URL: z
    .string()
    .refine(
      (url) => url.startsWith('postgres://') || url.startsWith('postgresql://'),
      { message: 'DATABASE_URL must start with postgres:// or postgresql://' }
    ),

  // Upstash Redis — optional in dev/test, required in production (enforced in redis.ts)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // Email (Resend) — optional in dev/test (emails logged to console)
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM_NAME: z.string().min(1).default('FlashNote'),
  EMAIL_FROM_ADDRESS: z.string().email().default('noreply@flashnote.app'),

  // Web URL — used to construct email links (verification, password reset)
  WEB_URL: z.string().url().default('http://localhost:3000'),

  // Registration mode — controls who can sign up
  REGISTRATION_MODE: z.enum(['open', 'closed', 'invite']).default('open'),

  // LLM provider configuration
  LLM_PROVIDER: z.enum(['gemini', 'claude']).default('gemini'),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_API_URL: z.string().url().default('https://generativelanguage.googleapis.com/v1beta'),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_MAX_TOKENS: z.coerce.number().default(4000),
  GEMINI_TEMPERATURE: z.coerce.number().default(0.2),
  GEMINI_TIMEOUT_MS: z.coerce.number().default(30000),
  // Use Application Default Credentials (service account) instead of API key.
  // Required for Vertex AI on Cloud Run. When true, GEMINI_API_KEY is not needed.
  GEMINI_USE_ADC: envBoolean,
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().default(2000),
  ANTHROPIC_TEMPERATURE: z.coerce.number().default(0.2),
  ANTHROPIC_TIMEOUT_MS: z.coerce.number().default(30000),
  USE_MOCK_AI: envBoolean,

  // Stripe billing — optional in dev/test, required in production
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_MONTHLY: z.string().startsWith('price_').optional(),
  STRIPE_PRICE_ANNUAL: z.string().startsWith('price_').optional(),
  // Cleanup job auth (webhook event cleanup Route Handler called by Cloud Scheduler)
  CLEANUP_SECRET: z.string().min(32).optional(),
}).superRefine((data, ctx) => {
  // Block USE_MOCK_AI in production
  if (data.USE_MOCK_AI && data.NODE_ENV === 'production') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'USE_MOCK_AI cannot be enabled in production',
      path: ['USE_MOCK_AI'],
    });
  }
  // Block direct Gemini API in production — must use Vertex AI for BAA coverage.
  // Vertex AI URLs follow the pattern: https://{region}-aiplatform.googleapis.com/...
  if (data.NODE_ENV === 'production' && data.LLM_PROVIDER === 'gemini' &&
      data.GEMINI_API_URL.includes('generativelanguage.googleapis.com')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Direct Gemini API is not permitted in production. Use Vertex AI endpoint (GEMINI_API_URL must point to aiplatform.googleapis.com).',
      path: ['GEMINI_API_URL'],
    });
  }
  // Block Claude in production — no BAA exists with Anthropic.
  // Claude is available for development/testing only. Vertex AI (Gemini) is the
  // production provider because it's covered under the Google Cloud BAA.
  if (data.LLM_PROVIDER === 'claude' && data.NODE_ENV === 'production') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'LLM_PROVIDER=claude is not permitted in production (no Anthropic BAA). Use gemini with Vertex AI.',
      path: ['LLM_PROVIDER'],
    });
  }
  // Require Stripe keys in production
  if (data.NODE_ENV === 'production') {
    if (!data.STRIPE_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'STRIPE_SECRET_KEY is required in production',
        path: ['STRIPE_SECRET_KEY'],
      });
    }
    if (!data.STRIPE_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'STRIPE_WEBHOOK_SECRET is required in production',
        path: ['STRIPE_WEBHOOK_SECRET'],
      });
    }
    if (!data.CLEANUP_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CLEANUP_SECRET is required in production (minimum 32 characters)',
        path: ['CLEANUP_SECRET'],
      });
    }
  }
  // Skip API key validation when mock AI is enabled
  if (data.USE_MOCK_AI) return;
  // Require API key for Gemini unless ADC is enabled (Vertex AI on Cloud Run)
  if (data.LLM_PROVIDER === 'gemini' && !data.GEMINI_API_KEY && !data.GEMINI_USE_ADC) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'GEMINI_API_KEY is required when LLM_PROVIDER=gemini (unless GEMINI_USE_ADC=true)',
      path: ['GEMINI_API_KEY'],
    });
  }
  if (data.LLM_PROVIDER === 'claude' && !data.ANTHROPIC_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude',
      path: ['ANTHROPIC_API_KEY'],
    });
  }
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  return parsed.data;
}

export const config = loadConfig();

export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';

// Security constants
// SECURITY: 12 rounds provides ~250ms hash time, balancing security and UX
export const BCRYPT_ROUNDS = 12;

// Session timing
export const SESSION_IDLE_TTL_MS = 24 * 60 * 60 * 1000;        // 24 hours
export const SESSION_ABSOLUTE_MAX_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_REFRESH_THRESHOLD = 0.5; // Refresh when >50% of idle TTL elapsed
export const MAX_SESSIONS_PER_USER = 5;
export const SESSION_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Token expiry
export const EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
export const PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = 15;

// Legal document versions - bump independently when each document is updated
// Recorded in legal_acceptances for audit trail
export const LEGAL_DOCUMENT_VERSIONS = {
  baa: '0.1',
  terms_of_service: '0.1',
  privacy_policy: '0.1',
} as const;

export type LegalDocumentType = keyof typeof LEGAL_DOCUMENT_VERSIONS;
