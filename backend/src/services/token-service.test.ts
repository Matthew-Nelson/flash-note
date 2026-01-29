import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDbQuery, resetMocks } from '../test/setup.js';
import { tokenService } from './token-service.js';
import crypto from 'crypto';

// Mock config
vi.mock('../config.js', () => ({
  config: {
    EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS: 24,
    PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: 15,
  },
}));

describe('TokenService', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('generateToken', () => {
    it('should generate a token with 256 bits of entropy', () => {
      const { token, tokenHash } = tokenService.generateToken();

      // URL-safe base64 encoded 32 bytes should be ~43 characters
      expect(token.length).toBeGreaterThanOrEqual(40);
      // Should not contain unsafe URL characters
      expect(token).not.toMatch(/[+/=]/);
    });

    it('should generate unique tokens each time', () => {
      const tokens = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const { token } = tokenService.generateToken();
        expect(tokens.has(token)).toBe(false);
        tokens.add(token);
      }
    });

    it('should generate different hash for each token', () => {
      const { tokenHash: hash1 } = tokenService.generateToken();
      const { tokenHash: hash2 } = tokenService.generateToken();

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashToken', () => {
    it('should produce consistent SHA-256 hash for same input', () => {
      const token = 'test-token-12345';

      const hash1 = tokenService.hashToken(token);
      const hash2 = tokenService.hashToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce 64-character hex string (SHA-256)', () => {
      const hash = tokenService.hashToken('any-token');

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = tokenService.hashToken('token-a');
      const hash2 = tokenService.hashToken('token-b');

      expect(hash1).not.toBe(hash2);
    });

    it('should match Node.js crypto SHA-256', () => {
      const token = 'verification-token-xyz';
      const expected = crypto.createHash('sha256').update(token).digest('hex');

      const hash = tokenService.hashToken(token);

      expect(hash).toBe(expected);
    });
  });

  describe('createToken', () => {
    it('should invalidate existing tokens of same type before creating new one', async () => {
      // Mock invalidation query
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // Mock insert query
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await tokenService.createToken('user-123', 'email_verification');

      // First call should be UPDATE to invalidate existing tokens
      expect(mockDbQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('UPDATE email_tokens'),
        expect.arrayContaining(['user-123', 'email_verification'])
      );
      expect(mockDbQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SET used_at = NOW()'),
        expect.any(Array)
      );
    });

    it('should insert new token with correct parameters', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // invalidation
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // insert

      const token = await tokenService.createToken('user-123', 'password_reset');

      // Second call should be INSERT
      expect(mockDbQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO email_tokens'),
        expect.arrayContaining(['user-123', 'password_reset'])
      );

      // Should return the plain token (not hash)
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(40);
    });

    it('should set correct expiry for email verification (24 hours)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const beforeCreate = new Date();
      await tokenService.createToken('user-123', 'email_verification');
      const afterCreate = new Date();

      // Extract expires_at from the INSERT call
      const insertArgs = mockDbQuery.mock.calls[1];
      const expiresAt = insertArgs[1][3] as Date;

      // Should be approximately 24 hours in the future
      const expectedMin = new Date(beforeCreate.getTime() + 24 * 60 * 60 * 1000 - 1000);
      const expectedMax = new Date(afterCreate.getTime() + 24 * 60 * 60 * 1000 + 1000);

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    it('should set correct expiry for password reset (15 minutes)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const beforeCreate = new Date();
      await tokenService.createToken('user-123', 'password_reset');
      const afterCreate = new Date();

      const insertArgs = mockDbQuery.mock.calls[1];
      const expiresAt = insertArgs[1][3] as Date;

      // Should be approximately 15 minutes in the future
      const expectedMin = new Date(beforeCreate.getTime() + 15 * 60 * 1000 - 1000);
      const expectedMax = new Date(afterCreate.getTime() + 15 * 60 * 1000 + 1000);

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });
  });

  describe('validateAndConsumeToken', () => {
    it('should return user ID for valid token', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ user_id: 'user-123' }],
      });

      const userId = await tokenService.validateAndConsumeToken(
        'valid-token',
        'email_verification'
      );

      expect(userId).toBe('user-123');
    });

    it('should return null for invalid token', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const userId = await tokenService.validateAndConsumeToken(
        'invalid-token',
        'email_verification'
      );

      expect(userId).toBeNull();
    });

    it('should use atomic UPDATE to prevent race conditions', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ user_id: 'user-123' }],
      });

      await tokenService.validateAndConsumeToken('token', 'password_reset');

      // Should be a single UPDATE query that finds AND marks as used
      expect(mockDbQuery).toHaveBeenCalledTimes(1);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE email_tokens'),
        expect.any(Array)
      );
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET used_at = NOW()'),
        expect.any(Array)
      );
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE token_hash = $1'),
        expect.any(Array)
      );
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND used_at IS NULL'),
        expect.any(Array)
      );
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND expires_at > NOW()'),
        expect.any(Array)
      );
    });

    it('should hash token before querying database', async () => {
      const token = 'plain-text-token';
      const expectedHash = tokenService.hashToken(token);

      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await tokenService.validateAndConsumeToken(token, 'email_verification');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expectedHash])
      );
    });

    it('should filter by token type', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await tokenService.validateAndConsumeToken('token', 'password_reset');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND token_type = $2'),
        expect.arrayContaining(['password_reset'])
      );
    });
  });

  describe('isTokenValid', () => {
    it('should return true for valid token', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{}] });

      const isValid = await tokenService.isTokenValid('valid-token', 'email_verification');

      expect(isValid).toBe(true);
    });

    it('should return false for invalid/expired/used token', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const isValid = await tokenService.isTokenValid('invalid-token', 'email_verification');

      expect(isValid).toBe(false);
    });

    it('should NOT consume the token (SELECT only)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{}] });

      await tokenService.isTokenValid('token', 'password_reset');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT 1 FROM email_tokens'),
        expect.any(Array)
      );
      // Should NOT contain UPDATE
      expect(mockDbQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.any(Array)
      );
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete tokens expired more than 7 days ago', async () => {
      mockDbQuery.mockResolvedValueOnce({ rowCount: 5 });

      const deletedCount = await tokenService.cleanupExpiredTokens();

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM email_tokens')
      );
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("expires_at < NOW() - INTERVAL '7 days'")
      );
      expect(deletedCount).toBe(5);
    });

    it('should return 0 when no tokens to cleanup', async () => {
      mockDbQuery.mockResolvedValueOnce({ rowCount: 0 });

      const deletedCount = await tokenService.cleanupExpiredTokens();

      expect(deletedCount).toBe(0);
    });

    it('should handle null rowCount gracefully', async () => {
      mockDbQuery.mockResolvedValueOnce({ rowCount: null });

      const deletedCount = await tokenService.cleanupExpiredTokens();

      expect(deletedCount).toBe(0);
    });
  });

  describe('security properties', () => {
    it('should not store plain tokens in database', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const token = await tokenService.createToken('user-123', 'email_verification');

      // The INSERT query should contain a hash, not the plain token
      const insertCall = mockDbQuery.mock.calls[1];
      const storedValue = insertCall[1][1]; // token_hash parameter

      expect(storedValue).not.toBe(token);
      expect(storedValue).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate cryptographically random tokens', () => {
      // Run multiple times and check uniqueness
      const tokens = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        const { token } = tokenService.generateToken();
        expect(tokens.has(token)).toBe(false);
        tokens.add(token);
      }
    });
  });
});
