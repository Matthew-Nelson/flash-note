import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock config before importing token service (config.ts calls process.exit without DATABASE_URL)
vi.mock('@/server/db/config', () => ({
  EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS: 24,
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: 15,
}));

// Mock DAL functions
const mockCreateEmailToken = vi.hoisted(() => vi.fn());
const mockConsumeToken = vi.hoisted(() => vi.fn());
const mockCheckTokenExists = vi.hoisted(() => vi.fn());
const mockFindUserIdByTokenHash = vi.hoisted(() => vi.fn());
const mockDeleteExpiredTokens = vi.hoisted(() => vi.fn());

vi.mock('@/server/dal/email-tokens', () => ({
  createEmailToken: mockCreateEmailToken,
  consumeToken: mockConsumeToken,
  checkTokenExists: mockCheckTokenExists,
  findUserIdByTokenHash: mockFindUserIdByTokenHash,
  deleteExpiredTokens: mockDeleteExpiredTokens,
}));

import {
  generateToken,
  hashToken,
  createToken,
  validateAndConsumeToken,
  isTokenValid,
  findUserIdFromToken,
  cleanupExpiredTokens,
} from './token';

describe('token service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateToken', () => {
    it('generates a token with URL-safe characters', () => {
      const { token } = generateToken();

      expect(token.length).toBeGreaterThan(0);
      // URL-safe base64: no +, /, or =
      expect(token).not.toMatch(/[+/=]/);
    });

    it('generates different tokens on each call', () => {
      const { token: t1 } = generateToken();
      const { token: t2 } = generateToken();

      expect(t1).not.toBe(t2);
    });

    it('returns a matching hash for the generated token', () => {
      const { token, tokenHash } = generateToken();

      expect(tokenHash).toBe(hashToken(token));
    });
  });

  describe('hashToken', () => {
    it('produces deterministic output', () => {
      const token = 'test-token-value';
      expect(hashToken(token)).toBe(hashToken(token));
    });

    it('produces different hashes for different tokens', () => {
      expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
    });
  });

  describe('createToken', () => {
    it('calls DAL createEmailToken with correct args', async () => {
      mockCreateEmailToken.mockResolvedValueOnce(undefined);

      const token = await createToken('user-1', 'email_verification');

      expect(token.length).toBeGreaterThan(0);
      expect(mockCreateEmailToken).toHaveBeenCalledTimes(1);
      expect(mockCreateEmailToken).toHaveBeenCalledWith(
        'user-1',
        expect.any(String), // tokenHash
        'email_verification',
        expect.any(Date) // expiresAt
      );
    });

    it('propagates DAL errors', async () => {
      mockCreateEmailToken.mockRejectedValueOnce(new Error('insert failed'));

      await expect(createToken('user-1', 'password_reset'))
        .rejects.toThrow('insert failed');
    });

    it('calculates email_verification expiry as 24 hours', async () => {
      mockCreateEmailToken.mockResolvedValueOnce(undefined);
      const before = Date.now();

      await createToken('user-1', 'email_verification');

      const after = Date.now();
      const expiresAt = mockCreateEmailToken.mock.calls[0][3] as Date;
      const expectedMs = 24 * 60 * 60 * 1000;
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs);
    });

    it('calculates password_reset expiry as 15 minutes', async () => {
      mockCreateEmailToken.mockResolvedValueOnce(undefined);
      const before = Date.now();

      await createToken('user-1', 'password_reset');

      const after = Date.now();
      const expiresAt = mockCreateEmailToken.mock.calls[0][3] as Date;
      const expectedMs = 15 * 60 * 1000;
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs);
    });
  });

  describe('validateAndConsumeToken', () => {
    it('returns userId for a valid unconsumed token', async () => {
      mockConsumeToken.mockResolvedValueOnce('user-1');

      const userId = await validateAndConsumeToken('valid-token', 'email_verification');

      expect(userId).toBe('user-1');
      expect(mockConsumeToken).toHaveBeenCalledWith(
        hashToken('valid-token'),
        'email_verification'
      );
    });

    it('returns null for an expired/used/invalid token', async () => {
      mockConsumeToken.mockResolvedValueOnce(null);

      const userId = await validateAndConsumeToken('expired-token', 'email_verification');

      expect(userId).toBeNull();
    });

    it('enforces single-use (atomic UPDATE prevents consuming twice)', async () => {
      // First call succeeds
      mockConsumeToken.mockResolvedValueOnce('user-1');
      // Second call returns null (token already used)
      mockConsumeToken.mockResolvedValueOnce(null);

      const first = await validateAndConsumeToken('token', 'password_reset');
      const second = await validateAndConsumeToken('token', 'password_reset');

      expect(first).toBe('user-1');
      expect(second).toBeNull();
    });
  });

  describe('isTokenValid', () => {
    it('returns true for a valid token', async () => {
      mockCheckTokenExists.mockResolvedValueOnce(true);

      const valid = await isTokenValid('token', 'password_reset');

      expect(valid).toBe(true);
      expect(mockCheckTokenExists).toHaveBeenCalledWith(
        hashToken('token'),
        'password_reset'
      );
    });

    it('returns false for an invalid token', async () => {
      mockCheckTokenExists.mockResolvedValueOnce(false);

      const valid = await isTokenValid('bad-token', 'password_reset');

      expect(valid).toBe(false);
    });
  });

  describe('findUserIdFromToken', () => {
    it('returns userId regardless of token validity', async () => {
      mockFindUserIdByTokenHash.mockResolvedValueOnce('user-1');

      const userId = await findUserIdFromToken('any-token', 'email_verification');

      expect(userId).toBe('user-1');
      expect(mockFindUserIdByTokenHash).toHaveBeenCalledWith(
        hashToken('any-token'),
        'email_verification'
      );
    });

    it('returns null when no token found', async () => {
      mockFindUserIdByTokenHash.mockResolvedValueOnce(null);

      const userId = await findUserIdFromToken('nonexistent', 'email_verification');

      expect(userId).toBeNull();
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('returns count of deleted tokens', async () => {
      mockDeleteExpiredTokens.mockResolvedValueOnce(3);

      const count = await cleanupExpiredTokens();

      expect(count).toBe(3);
      expect(mockDeleteExpiredTokens).toHaveBeenCalledTimes(1);
    });

    it('returns 0 when no expired tokens', async () => {
      mockDeleteExpiredTokens.mockResolvedValueOnce(0);

      const count = await cleanupExpiredTokens();

      expect(count).toBe(0);
    });
  });
});
