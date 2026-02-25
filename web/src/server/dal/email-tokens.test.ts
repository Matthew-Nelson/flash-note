import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  mockDbQuery,
  mockClientQuery,
  mockGetPoolClient,
  resetMocks,
} from '@/test/dal-helpers';

import {
  createEmailToken,
  consumeToken,
  checkTokenExists,
  findUserIdByTokenHash,
  deleteExpiredTokens,
} from './email-tokens';

function setupMockClient() {
  const mockClient = {
    query: mockClientQuery,
    release: vi.fn(),
  };
  mockGetPoolClient.mockResolvedValue(mockClient);
  return mockClient;
}

describe('dal/email-tokens', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('createEmailToken', () => {
    it('invalidates existing tokens and inserts new one in a transaction', async () => {
      const mockClient = setupMockClient();
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] })  // UPDATE invalidate
        .mockResolvedValueOnce({ rows: [] })  // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await createEmailToken('user-1', 'hash123', 'email_verification', expiresAt);

      expect(mockClientQuery).toHaveBeenCalledTimes(4);
      expect(mockClientQuery.mock.calls[0][0]).toBe('BEGIN');

      // Verify invalidation UPDATE
      expect(mockClientQuery.mock.calls[1][0]).toContain('UPDATE email_tokens');
      expect(mockClientQuery.mock.calls[1][0]).toContain('SET used_at = NOW()');
      expect(mockClientQuery.mock.calls[1][1]).toEqual(['user-1', 'email_verification']);

      // Verify INSERT
      expect(mockClientQuery.mock.calls[2][0]).toContain('INSERT INTO email_tokens');
      expect(mockClientQuery.mock.calls[2][1]).toEqual(['user-1', 'hash123', 'email_verification', expiresAt]);

      expect(mockClientQuery.mock.calls[3][0]).toBe('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('rolls back on INSERT failure', async () => {
      const mockClient = setupMockClient();
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] })  // UPDATE invalidate
        .mockRejectedValueOnce(new Error('insert failed'))  // INSERT fails
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(
        createEmailToken('user-1', 'hash123', 'password_reset', new Date())
      ).rejects.toThrow('insert failed');

      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('releases client even when ROLLBACK fails', async () => {
      const mockClient = setupMockClient();
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockRejectedValueOnce(new Error('update failed'))  // UPDATE fails
        .mockRejectedValueOnce(new Error('rollback failed')); // ROLLBACK also fails

      await expect(
        createEmailToken('user-1', 'hash123', 'email_verification', new Date())
      ).rejects.toThrow('update failed');

      expect(mockClientQuery).toHaveBeenNthCalledWith(3, 'ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('consumeToken', () => {
    it('returns userId for a valid unconsumed token', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ user_id: 'user-1' }],
      });

      const userId = await consumeToken('hash123', 'email_verification');

      expect(userId).toBe('user-1');
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE email_tokens'),
        ['hash123', 'email_verification']
      );
    });

    it('returns null for an expired/used/invalid token', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const userId = await consumeToken('badhash', 'email_verification');

      expect(userId).toBeNull();
    });
  });

  describe('checkTokenExists', () => {
    it('returns true for a valid token', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{}] });

      const exists = await checkTokenExists('hash123', 'password_reset');

      expect(exists).toBe(true);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT 1 FROM email_tokens'),
        ['hash123', 'password_reset']
      );
    });

    it('returns false for an invalid token', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const exists = await checkTokenExists('badhash', 'password_reset');

      expect(exists).toBe(false);
    });
  });

  describe('findUserIdByTokenHash', () => {
    it('returns userId regardless of token validity', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }] });

      const userId = await findUserIdByTokenHash('hash123', 'email_verification');

      expect(userId).toBe('user-1');
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT user_id FROM email_tokens'),
        ['hash123', 'email_verification']
      );
    });

    it('returns null when no token found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const userId = await findUserIdByTokenHash('nonexistent', 'email_verification');

      expect(userId).toBeNull();
    });
  });

  describe('deleteExpiredTokens', () => {
    it('returns count of deleted tokens', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 3 });

      const count = await deleteExpiredTokens();

      expect(count).toBe(3);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM email_tokens')
      );
    });

    it('returns 0 when no expired tokens', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const count = await deleteExpiredTokens();

      expect(count).toBe(0);
    });
  });
});
