import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbQuery, resetMocks } from '../../test/setup.js';
import { deleteSessionsByUserId } from './sessions.js';

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

    it('should use parameterized query to prevent SQL injection', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await deleteSessionsByUserId("'; DROP TABLE sessions; --");

      expect(mockDbQuery).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE user_id = $1',
        ["'; DROP TABLE sessions; --"]
      );
    });
  });
});
