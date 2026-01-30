import crypto from 'crypto';
import { db } from '../db/index.js';
import { config } from '../config.js';
import type { TokenUserIdRow } from '../types/database.js';

/**
 * Token types for email verification and password reset
 */
export type TokenType = 'email_verification' | 'password_reset';

/**
 * Token generation result containing both plain token and hash
 */
interface TokenResult {
  token: string;
  tokenHash: string;
}

/**
 * TokenService handles secure token generation and validation for
 * email verification and password reset flows.
 *
 * SECURITY:
 * - Tokens use 32 bytes (256 bits) of cryptographic randomness
 * - Tokens are stored as SHA-256 hashes (appropriate for high-entropy tokens)
 * - Single-use enforcement prevents replay attacks
 * - Strict expiry limits reduce window of vulnerability
 * - Existing tokens invalidated when new ones are created
 */
class TokenService {
  /**
   * Generate a cryptographically secure token
   * Returns both the plain token (for emailing) and hash (for storage)
   */
  generateToken(): TokenResult {
    // Generate 32 bytes of random data (256 bits of entropy)
    const randomBytes = crypto.randomBytes(32);

    // Encode as URL-safe base64
    const token = randomBytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Hash for storage
    const tokenHash = this.hashToken(token);

    return { token, tokenHash };
  }

  /**
   * Hash a token using SHA-256
   * SECURITY: SHA-256 is appropriate for high-entropy tokens (256 bits)
   * Unlike passwords, these tokens don't need bcrypt because they're
   * already cryptographically random and computationally expensive to brute force
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create and store a new token for a user
   * Invalidates any existing tokens of the same type
   * Returns the plain token for emailing to user
   */
  async createToken(userId: string, type: TokenType): Promise<string> {
    const { token, tokenHash } = this.generateToken();
    const expiresAt = this.calculateExpiry(type);

    // SECURITY: Invalidate existing unused tokens of the same type
    // This prevents multiple valid tokens from existing simultaneously
    await db.query(
      `UPDATE email_tokens
       SET used_at = NOW()
       WHERE user_id = $1 AND token_type = $2 AND used_at IS NULL`,
      [userId, type]
    );

    // Insert new token
    await db.query(
      `INSERT INTO email_tokens (user_id, token_hash, token_type, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, tokenHash, type, expiresAt]
    );

    return token;
  }

  /**
   * Validate a token and mark it as used in a single atomic operation
   * Returns the user ID if valid, null otherwise
   *
   * SECURITY: Atomic operation prevents race conditions where a token
   * could be validated twice in concurrent requests
   */
  async validateAndConsumeToken(
    token: string,
    type: TokenType
  ): Promise<string | null> {
    const tokenHash = this.hashToken(token);

    // Atomic: find valid token and mark as used in one query
    const result = await db.query<TokenUserIdRow>(
      `UPDATE email_tokens
       SET used_at = NOW()
       WHERE token_hash = $1
         AND token_type = $2
         AND used_at IS NULL
         AND expires_at > NOW()
       RETURNING user_id`,
      [tokenHash, type]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0]!.user_id;
  }

  /**
   * Check if a token is valid without consuming it
   * Used for UI validation (e.g., checking if reset link is valid before showing form)
   */
  async isTokenValid(token: string, type: TokenType): Promise<boolean> {
    const tokenHash = this.hashToken(token);

    const result = await db.query(
      `SELECT 1 FROM email_tokens
       WHERE token_hash = $1
         AND token_type = $2
         AND used_at IS NULL
         AND expires_at > NOW()`,
      [tokenHash, type]
    );

    return result.rows.length > 0;
  }

  /**
   * Find user ID from a token regardless of validity
   * Used to check if user is already verified when token fails
   */
  async findUserIdFromToken(token: string, type: TokenType): Promise<string | null> {
    const tokenHash = this.hashToken(token);

    const result = await db.query<TokenUserIdRow>(
      `SELECT user_id FROM email_tokens
       WHERE token_hash = $1 AND token_type = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash, type]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0]!.user_id;
  }

  /**
   * Clean up expired tokens (maintenance task)
   * Returns number of tokens deleted
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await db.query(
      `DELETE FROM email_tokens
       WHERE expires_at < NOW() - INTERVAL '7 days'
       RETURNING id`
    );

    return result.rowCount ?? 0;
  }

  /**
   * Calculate expiry timestamp based on token type
   */
  private calculateExpiry(type: TokenType): Date {
    const now = new Date();

    if (type === 'email_verification') {
      const hours = config.EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS;
      return new Date(now.getTime() + hours * 60 * 60 * 1000);
    }

    // password_reset
    const minutes = config.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES;
    return new Date(now.getTime() + minutes * 60 * 1000);
  }
}

export const tokenService = new TokenService();
