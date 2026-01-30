import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load .env file, override any existing env vars to ensure local .env takes precedence
dotenvConfig({ override: true });

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

  // Gemini AI
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_MAX_TOKENS: z.string().transform(Number).default('2000'),
  GEMINI_TEMPERATURE: z.string().transform(Number).default('0.7'),
  GEMINI_TIMEOUT_MS: z.string().transform(Number).default('30000'),

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
    .default('http://localhost:3000,http://localhost:5173'),

  // GCP (for production HIPAA compliance)
  GCP_PROJECT_ID: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM_ADDRESS: z.string().email().default('noreply@flashnote.app'),
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
