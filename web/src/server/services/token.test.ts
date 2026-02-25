import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock config before importing token service (config.ts calls process.exit without DATABASE_URL)
vi.mock('@/server/db/config', () => ({
  EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS: 24,
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: 15,
}));

import {
  mockDbQuery,
  mockClientQuery,
  mockGetPoolClient,
  resetMocks,
} from '@/test/dal-helpers';

import {
  generateToken,
  hashToken,
  createToken,
  validateAndConsumeToken,
  isTokenValid,
  findUserIdFromToken,
  cleanupExpiredTokens,
} from './token';

// Helper to set up the mock pool client
function setupMockClient() {
  const mockClient = {
    query: mockClientQuery,
    release: () => {},
  };
  mockGetPoolClient.mockResolvedValue(mockClient);
  return mockClient;
}

describe('token service', () => {
  beforeEach(() => {
    resetMocks();
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
    it('invalidates existing tokens and inserts new one in a transaction', async () => {
      setupMockClient();
      // BEGIN, UPDATE (invalidate), INSERT, COMMIT
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] })  // UPDATE invalidate
        .mockResolvedValueOnce({ rows: [] })  // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const token = await createToken('user-1', 'email_verification');

      expect(token.length).toBeGreaterThan(0);
      expect(mockClientQuery).toHaveBeenCalledTimes(4);

      // Verify BEGIN
      expect(mockClientQuery.mock.calls[0][0]).toBe('BEGIN');

      // Verify invalidation UPDATE
      expect(mockClientQuery.mock.calls[1][0]).toContain('UPDATE email_tokens');
      expect(mockClientQuery.mock.calls[1][0]).toContain('SET used_at = NOW()');
      expect(mockClientQuery.mock.calls[1][1]).toEqual(['user-1', 'email_verification']);

      // Verify INSERT
      expect(mockClientQuery.mock.calls[2][0]).toContain('INSERT INTO email_tokens');

      // Verify COMMIT
      expect(mockClientQuery.mock.calls[3][0]).toBe('COMMIT');
    });

    it('rolls back on INSERT failure', async () => {
      setupMockClient();
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] })  // UPDATE invalidate
        .mockRejectedValueOnce(new Error('insert failed'))  // INSERT fails
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(createToken('user-1', 'password_reset'))
        .rejects.toThrow('insert failed');
    });
  });

  describe('validateAndConsumeToken', () => {
    it('returns userId for a valid unconsumed token', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ user_id: 'user-1' }],
      });

      const userId = await validateAndConsumeToken('valid-token', 'email_verification');

      expect(userId).toBe('user-1');
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE email_tokens'),
        [hashToken('valid-token'), 'email_verification']
      );
    });

    it('returns null for an expired/used/invalid token', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const userId = await validateAndConsumeToken('expired-token', 'email_verification');

      expect(userId).toBeNull();
    });

    it('enforces single-use (atomic UPDATE prevents consuming twice)', async () => {
      // First call succeeds
      mockDbQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] });
      // Second call returns empty (token already used)
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const first = await validateAndConsumeToken('token', 'password_reset');
      const second = await validateAndConsumeToken('token', 'password_reset');

      expect(first).toBe('user-1');
      expect(second).toBeNull();
    });
  });

  describe('isTokenValid', () => {
    it('returns true for a valid token', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{}] });

      const valid = await isTokenValid('token', 'password_reset');

      expect(valid).toBe(true);
    });

    it('returns false for an invalid token', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const valid = await isTokenValid('bad-token', 'password_reset');

      expect(valid).toBe(false);
    });
  });

  describe('findUserIdFromToken', () => {
    it('returns userId regardless of token validity', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] });

      const userId = await findUserIdFromToken('any-token', 'email_verification');

      expect(userId).toBe('user-1');
    });

    it('returns null when no token found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const userId = await findUserIdFromToken('nonexistent', 'email_verification');

      expect(userId).toBeNull();
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('returns count of deleted tokens', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{}, {}, {}], rowCount: 3 });

      const count = await cleanupExpiredTokens();

      expect(count).toBe(3);
    });

    it('returns 0 when no expired tokens', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const count = await cleanupExpiredTokens();

      expect(count).toBe(0);
    });
  });
});
