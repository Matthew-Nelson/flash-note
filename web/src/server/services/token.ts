import 'server-only';

import crypto from 'node:crypto';

import {
  EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS,
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES,
} from '@/server/db/config';
import {
  createEmailToken,
  consumeToken,
  checkTokenExists,
  findUserIdByTokenHash,
  deleteExpiredTokens,
} from '@/server/dal/email-tokens';

import type { TokenType } from '@/server/types';

interface TokenResult {
  token: string;
  tokenHash: string;
}

/**
 * Generate a cryptographically secure token.
 * Returns both the plain token (for emailing) and its SHA-256 hash (for storage).
 */
export function generateToken(): TokenResult {
  const randomBytes = crypto.randomBytes(32);
  const token = randomBytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

/**
 * Hash a token using SHA-256.
 * Appropriate for high-entropy tokens (256 bits) — unlike passwords,
 * these don't need bcrypt because they're already cryptographically random.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create and store a new token for a user.
 * H-7: Invalidates existing tokens of the same type in a transaction
 * to prevent orphaned invalidation if the INSERT fails.
 * Returns the plain token for emailing.
 */
export async function createToken(userId: string, type: TokenType): Promise<string> {
  const { token, tokenHash } = generateToken();
  const expiresAt = calculateExpiry(type);

  await createEmailToken(userId, tokenHash, type, expiresAt);

  return token;
}

/**
 * Validate a token and mark it as used in a single atomic operation.
 * Prevents replay attacks via single-use enforcement.
 * Returns the user ID if valid, null otherwise.
 */
export async function validateAndConsumeToken(
  token: string,
  type: TokenType
): Promise<string | null> {
  const tokenHash = hashToken(token);
  return consumeToken(tokenHash, type);
}

/**
 * Check if a token is valid without consuming it.
 * Used for UI pre-validation (e.g., checking if reset link is valid before showing form).
 */
export async function isTokenValid(token: string, type: TokenType): Promise<boolean> {
  const tokenHash = hashToken(token);
  return checkTokenExists(tokenHash, type);
}

/**
 * Find user ID from a token regardless of validity.
 * Used to check if user is already verified when a consumed/expired token is presented.
 */
export async function findUserIdFromToken(
  token: string,
  type: TokenType
): Promise<string | null> {
  const tokenHash = hashToken(token);
  return findUserIdByTokenHash(tokenHash, type);
}

/**
 * Clean up expired tokens (maintenance task).
 * Deletes tokens that expired more than 7 days ago.
 */
export async function cleanupExpiredTokens(): Promise<number> {
  return deleteExpiredTokens();
}

function calculateExpiry(type: TokenType): Date {
  const now = new Date();
  if (type === 'email_verification') {
    return new Date(now.getTime() + EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  }
  return new Date(now.getTime() + PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);
}
