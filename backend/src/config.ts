import { z } from 'zod';

// Environment variables are loaded by env-loader.ts (imported first in index.ts)
// This file only validates and exports the typed config object.

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('4000'),

  // Database
  DATABASE_URL: z.string().url(),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),

  // LLM Provider Selection
  // Determines which LLM provider to use: 'gemini' or 'claude'
  LLM_PROVIDER: z.enum(['gemini', 'claude']).default('gemini'),

  // Gemini AI (required when LLM_PROVIDER=gemini)
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_MAX_TOKENS: z.string().transform(Number).default('4000'),
  GEMINI_TEMPERATURE: z.string().transform(Number).default('0.7'),
  GEMINI_TIMEOUT_MS: z.string().transform(Number).default('30000'),

  // Anthropic Claude (required when LLM_PROVIDER=claude)
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  ANTHROPIC_MAX_TOKENS: z.string().transform(Number).default('2000'),
  ANTHROPIC_TEMPERATURE: z.string().transform(Number).default('0.7'),
  ANTHROPIC_TIMEOUT_MS: z.string().transform(Number).default('30000'),

  // Registration gating (see docs/planning/APP_GATING_STRATEGY.md)
  REGISTRATION_MODE: z.enum(['open', 'closed', 'invite']).default('open'),

  // Development
  USE_MOCK_AI: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ANNUAL: z.string().optional(),

  // URLs
  WEB_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),

  // CORS Configuration
  // Comma-separated list of allowed origins (URLs or chrome-extension:// URIs)
  ALLOWED_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((origin) => origin.trim()).filter(Boolean))
    .refine(
      (origins) => origins.every((origin) =>
        /^https?:\/\/.+/.test(origin) || /^chrome-extension:\/\/[a-z]{32}$/.test(origin)
      ),
      {
        message:
          'Each origin must be a valid http(s):// URL or chrome-extension:// URI (32 lowercase letters)',
      }
    )
    .default('http://localhost:3000,http://localhost:5173'),

  // GCP (for production HIPAA compliance)
  GCP_PROJECT_ID: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM_ADDRESS: z.string().email().default('noreply@flashnote.co'),
  EMAIL_FROM_NAME: z.string().default('FlashNote'),
  EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS: z.string().transform(Number).default('24'),
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: z.string().transform(Number).default('15'),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  // SECURITY: Ensure ALLOWED_ORIGINS is configured in production
  // Empty origins would silently block all CORS requests
  if (parsed.data.NODE_ENV === 'production' && parsed.data.ALLOWED_ORIGINS.length === 0) {
    console.error('SECURITY ERROR: ALLOWED_ORIGINS cannot be empty in production.');
    console.error('Set ALLOWED_ORIGINS to your web app URL and extension ID.');
    process.exit(1);
  }

  // Validate that the selected LLM provider's API key is configured
  if (parsed.data.LLM_PROVIDER === 'gemini' && !parsed.data.GEMINI_API_KEY) {
    console.error('Configuration error: GEMINI_API_KEY is required when LLM_PROVIDER=gemini');
    process.exit(1);
  }
  if (parsed.data.LLM_PROVIDER === 'claude' && !parsed.data.ANTHROPIC_API_KEY) {
    console.error('Configuration error: ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude');
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
// Increasing to 13+ would double hash time; adjust only if hardware improves significantly
export const BCRYPT_ROUNDS = 12;

// Legal document versions - bump independently when each document is updated
// Recorded in legal_acceptances for audit trail
export const LEGAL_DOCUMENT_VERSIONS = {
  baa: '0.1',
  terms_of_service: '0.1',
  privacy_policy: '0.1',
} as const;

export type LegalDocumentType = keyof typeof LEGAL_DOCUMENT_VERSIONS;
