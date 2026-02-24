import 'server-only';

import { z } from 'zod';

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

// Legal document versions - bump independently when each document is updated
// Recorded in legal_acceptances for audit trail
export const LEGAL_DOCUMENT_VERSIONS = {
  baa: '0.1',
  terms_of_service: '0.1',
  privacy_policy: '0.1',
} as const;

export type LegalDocumentType = keyof typeof LEGAL_DOCUMENT_VERSIONS;
