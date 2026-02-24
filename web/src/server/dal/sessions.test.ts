import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbQuery, mockClientQuery, resetMocks } from '@/test/dal-helpers';
import { deleteSessionsByUserId } from './sessions';

// Note: Session creation, lookup, and validation functions are added in Phase 1.2.
// This module currently only contains deleteSessionsByUserId.

describe('Session Queries', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('deleteSessionsByUserId', () => {
    it('should delete all sessions for a user', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await deleteSessionsByUserId('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE user_id = $1',
        ['user-123']
      );
    });

    it('should use parameterized query', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await deleteSessionsByUserId("'; DROP TABLE sessions; --");

      expect(mockDbQuery).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE user_id = $1',
        ["'; DROP TABLE sessions; --"]
      );
    });

    it('should use PoolClient when provided for transaction composition', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = { query: mockClientQuery } as never;
      await deleteSessionsByUserId('user-123', mockClient);

      expect(mockClientQuery).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE user_id = $1',
        ['user-123']
      );
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    it('should propagate database errors to the caller', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('connection refused'));

      await expect(
        deleteSessionsByUserId('user-123')
      ).rejects.toThrow('connection refused');
    });
  });
});
