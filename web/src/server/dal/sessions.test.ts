import crypto from 'node:crypto';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock config before importing sessions (config.ts calls process.exit without DATABASE_URL)
vi.mock('@/server/db/config', () => ({
  MAX_SESSIONS_PER_USER: 5,
  SESSION_IDLE_TTL_MS: 24 * 60 * 60 * 1000,
}));

import {
  mockDbQuery,
  mockClientQuery,
  mockGetPoolClient,
  resetMocks,
  createMockSessionWithUserRow,
} from '@/test/dal-helpers';
import {
  createSession,
  findSessionByTokenHash,
  refreshSessionExpiry,
  deleteSession,
  deleteSessionsByUserId,
  enforceSessionLimit,
  checkDeviceBinding,
  cleanupExpiredSessions,
} from './sessions';

// Mock audit service
vi.mock('@/server/services/audit', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
    logWithClient: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock crypto.randomUUID for deterministic tests
vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid-token' as `${string}-${string}-${string}-${string}-${string}`);

const { auditService } = await import('@/server/services/audit');

describe('Session DAL', () => {
  beforeEach(() => {
    resetMocks();
    vi.mocked(auditService.log).mockClear();
    vi.mocked(auditService.logWithClient).mockClear();
  });

  // --- createSession ---

  describe('createSession', () => {
    it('should create a session with correct params in own transaction', async () => {
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      // enforceSessionLimit COUNT query
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // INSERT RETURNING
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'new-session-id' }] });
      // COMMIT
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const mockClient = {
        query: mockClientQuery,
        release: vi.fn(),
      };
      mockGetPoolClient.mockResolvedValueOnce(mockClient);

      const result = await createSession('user-123', {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(result.id).toBe('new-session-id');
      expect(result.userId).toBe('user-123');
      expect(result.token).toBe('test-uuid-token');
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify BEGIN/COMMIT
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();

      // Verify INSERT uses SHA-256 hash, not raw token
      const insertCall = mockClientQuery.mock.calls.find(
        (call) => typeof call[0] === 'string' && String(call[0]).includes('INSERT INTO sessions')
      );
      expect(insertCall).toBeDefined();
      const tokenHash = crypto.createHash('sha256').update('test-uuid-token').digest('hex');
      expect(insertCall![1]).toEqual(
        expect.arrayContaining([tokenHash])
      );
    });

    it('should return raw token for cookie (not hash)', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'sess-id' }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT
      mockGetPoolClient.mockResolvedValueOnce({
        query: mockClientQuery,
        release: vi.fn(),
      });

      const result = await createSession('user-123');
      expect(result.token).toBe('test-uuid-token');
      // Token should NOT be a hash
      expect(result.token).not.toMatch(/^[a-f0-9]{64}$/);
    });

    it('should sanitize IP address before INSERT', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'sess-id' }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT
      mockGetPoolClient.mockResolvedValueOnce({
        query: mockClientQuery,
        release: vi.fn(),
      });

      await createSession('user-123', { ipAddress: 'not-an-ip' });

      // sanitizeIpAddress returns null for invalid IPs
      const insertCall = mockClientQuery.mock.calls.find(
        (call) => typeof call[0] === 'string' && String(call[0]).includes('INSERT INTO sessions')
      );
      expect((insertCall![1] as unknown[])[3]).toBeNull(); // ip_address param
    });

    it('should use external client when provided (no own transaction)', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'sess-id' }] });

      const externalClient = { query: mockClientQuery, release: vi.fn() } as never;
      const result = await createSession('user-123', {}, externalClient);

      expect(result.id).toBe('sess-id');
      // Should NOT call BEGIN/COMMIT — caller manages transaction
      const beginCalls = mockClientQuery.mock.calls.filter(
        (call) => call[0] === 'BEGIN'
      );
      expect(beginCalls).toHaveLength(0);
      // Should NOT call getPoolClient
      expect(mockGetPoolClient).not.toHaveBeenCalled();
    });

    it('should enforce session limit within transaction', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      // Session count at limit
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      // Delete oldest
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'old-sess' }] });
      // INSERT
      mockClientQuery.mockResolvedValueOnce({ rows: [{ id: 'new-sess' }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT

      mockGetPoolClient.mockResolvedValueOnce({
        query: mockClientQuery,
        release: vi.fn(),
      });

      await createSession('user-123');

      // Verify delete query was called
      const deleteCall = mockClientQuery.mock.calls.find(
        (call) => typeof call[0] === 'string' && String(call[0]).includes('DELETE FROM sessions')
      );
      expect(deleteCall).toBeDefined();
    });

    it('should throw when INSERT returns no rows (Rule 10)', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // Empty RETURNING (INSERT)
      // ROLLBACK will also be called
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      mockGetPoolClient.mockResolvedValueOnce({
        query: mockClientQuery,
        release: vi.fn(),
      });

      await expect(
        createSession('user-123')
      ).rejects.toThrow('Session insert returned no rows');
    });

    it('should ROLLBACK on error and release client', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // COUNT
      mockClientQuery.mockRejectedValueOnce(new Error('DB error')); // INSERT fails
      mockClientQuery.mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const mockRelease = vi.fn();
      mockGetPoolClient.mockResolvedValueOnce({
        query: mockClientQuery,
        release: mockRelease,
      });

      await expect(createSession('user-123')).rejects.toThrow('DB error');
      expect(mockRelease).toHaveBeenCalled();
    });
  });

  // --- findSessionByTokenHash ---

  describe('findSessionByTokenHash', () => {
    it('should return session+user data for valid token hash', async () => {
      const mockRow = createMockSessionWithUserRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await findSessionByTokenHash('some-hash');

      expect(result).toEqual(mockRow);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM sessions s'),
        ['some-hash']
      );
    });

    it('should return null when no session found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await findSessionByTokenHash('nonexistent-hash');
      expect(result).toBeNull();
    });

    it('should exclude expired sessions (handled by SQL WHERE clause)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await findSessionByTokenHash('expired-hash');
      expect(result).toBeNull();

      // Verify SQL includes expiry check
      const query = mockDbQuery.mock.calls[0][0] as string;
      expect(query).toContain('s.expires_at > NOW()');
    });

    it('returns null for expired sessions (SQL enforces expiry filter)', async () => {
      // Simulate: DB filters out the expired session (returns empty rows, as it would for
      // a session where expires_at < NOW()). Application code MUST NOT re-check expiry
      // on returned rows — the SQL WHERE clause is the single enforcement point.
      // A real DB integration test would verify the SQL engine actually enforces this.
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await findSessionByTokenHash('expired-hash');

      expect(result).toBeNull();

      // Verify the SQL includes the expiry check — this is the actual security enforcement
      const query = mockDbQuery.mock.calls[0][0] as string;
      expect(query).toContain('s.expires_at > NOW()');
    });

    it('should exclude soft-deleted users', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await findSessionByTokenHash('hash-for-deleted-user');

      const query = mockDbQuery.mock.calls[0][0] as string;
      expect(query).toContain('NOT u.is_deleted');
    });

    it('should JOIN users and select authorization-relevant fields only', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await findSessionByTokenHash('any-hash');

      const query = mockDbQuery.mock.calls[0][0] as string;
      // Should include auth fields
      expect(query).toContain('u.email');
      expect(query).toContain('u.subscription_status');
      expect(query).toContain('u.trial_ends_at');
      expect(query).toContain('u.email_verified');
      expect(query).toContain('u.organization_id');
      // Should NOT include lockout fields
      expect(query).not.toContain('u.failed_login_attempts');
      expect(query).not.toContain('u.locked_until');
    });
  });

  // --- refreshSessionExpiry ---

  describe('refreshSessionExpiry', () => {
    it('should update expires_at for the given session', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const newExpiry = new Date('2026-03-01T00:00:00Z');
      await refreshSessionExpiry('session-123', newExpiry);

      expect(mockDbQuery).toHaveBeenCalledWith(
        'UPDATE sessions SET expires_at = $1 WHERE id = $2',
        [newExpiry, 'session-123']
      );
    });

    it('should propagate database errors', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('connection lost'));

      await expect(
        refreshSessionExpiry('session-123', new Date())
      ).rejects.toThrow('connection lost');
    });
  });

  // --- deleteSession ---

  describe('deleteSession', () => {
    it('should delete a session by ID', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await deleteSession('session-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE id = $1',
        ['session-123']
      );
    });

    it('should use parameterized query', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await deleteSession("'; DROP TABLE sessions; --");

      expect(mockDbQuery).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE id = $1',
        ["'; DROP TABLE sessions; --"]
      );
    });
  });

  // --- deleteSessionsByUserId ---

  describe('deleteSessionsByUserId', () => {
    it('should delete all sessions for a user', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await deleteSessionsByUserId('user-123');

      expect(mockDbQuery).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE user_id = $1',
        ['user-123']
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

    it('should propagate database errors', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('connection refused'));

      await expect(
        deleteSessionsByUserId('user-123')
      ).rejects.toThrow('connection refused');
    });
  });

  // --- enforceSessionLimit ---

  describe('enforceSessionLimit', () => {
    it('should do nothing when under the limit', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '3' }] });

      const client = { query: mockClientQuery } as never;
      await enforceSessionLimit('user-123', {}, client);

      // Only the COUNT query should fire
      expect(mockClientQuery).toHaveBeenCalledTimes(1);
      expect(auditService.logWithClient).not.toHaveBeenCalled();
    });

    it('should delete oldest sessions when at limit', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: 'old-1' }],
      });

      const client = { query: mockClientQuery } as never;
      await enforceSessionLimit('user-123', { ipAddress: '1.2.3.4' }, client);

      // COUNT + DELETE
      expect(mockClientQuery).toHaveBeenCalledTimes(2);

      // Verify delete query deletes 1 session (5 - 5 + 1)
      const deleteCall = mockClientQuery.mock.calls[1];
      expect(deleteCall[0]).toContain('DELETE FROM sessions');
      expect(deleteCall[1]).toEqual(['user-123', 1]);
    });

    it('should delete multiple sessions when well over limit', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '7' }] });
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: 'old-1' }, { id: 'old-2' }, { id: 'old-3' }],
      });

      const client = { query: mockClientQuery } as never;
      await enforceSessionLimit('user-123', {}, client);

      // Should delete 3 (7 - 5 + 1)
      const deleteCall = mockClientQuery.mock.calls[1];
      expect(deleteCall[1]).toEqual(['user-123', 3]);
    });

    it('should write transactional audit log with session info (Rule 9)', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ id: 'deleted-1' }],
      });

      const client = { query: mockClientQuery } as never;
      await enforceSessionLimit(
        'user-123',
        { ipAddress: '10.0.0.1', userAgent: 'TestBrowser' },
        client
      );

      expect(auditService.logWithClient).toHaveBeenCalledWith(
        client,
        {
          userId: 'user-123',
          action: 'SESSION_LIMIT_EXCEEDED',
          status: 'SUCCESS',
          metadata: {
            sessionsDeleted: 1,
            deletedSessionIds: ['deleted-1'],
            maxSessions: 5,
          },
          ipAddress: '10.0.0.1',
          userAgent: 'TestBrowser',
        }
      );
    });
  });

  // --- checkDeviceBinding ---

  describe('checkDeviceBinding', () => {
    it('should not log when IP and UA match', async () => {
      await checkDeviceBinding(
        'user-123',
        'session-123',
        { ip_address: '1.2.3.4', user_agent: 'Chrome' },
        { ipAddress: '1.2.3.4', userAgent: 'Chrome' }
      );

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should log when IP changes', async () => {
      await checkDeviceBinding(
        'user-123',
        'session-123',
        { ip_address: '1.2.3.4', user_agent: 'Chrome' },
        { ipAddress: '5.6.7.8', userAgent: 'Chrome' }
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_DEVICE_CHANGE',
          status: 'WARNING',
          metadata: expect.objectContaining({
            ipChanged: true,
            uaChanged: false,
            originalIp: '1.2.3.4',
            newIp: '5.6.7.8',
          }),
        })
      );
    });

    it('should log when user agent changes', async () => {
      await checkDeviceBinding(
        'user-123',
        'session-123',
        { ip_address: '1.2.3.4', user_agent: 'Chrome' },
        { ipAddress: '1.2.3.4', userAgent: 'Firefox' }
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            ipChanged: false,
            uaChanged: true,
            userAgentChanged: true,
          }),
        })
      );
    });

    it('should not log when original IP is null', async () => {
      await checkDeviceBinding(
        'user-123',
        'session-123',
        { ip_address: null, user_agent: 'Chrome' },
        { ipAddress: '5.6.7.8', userAgent: 'Chrome' }
      );

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should not log when original UA is null', async () => {
      await checkDeviceBinding(
        'user-123',
        'session-123',
        { ip_address: '1.2.3.4', user_agent: null },
        { ipAddress: '1.2.3.4', userAgent: 'Firefox' }
      );

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should not log when context IP is undefined', async () => {
      await checkDeviceBinding(
        'user-123',
        'session-123',
        { ip_address: '1.2.3.4', user_agent: 'Chrome' },
        { userAgent: 'Chrome' } // no ipAddress
      );

      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  // --- cleanupExpiredSessions ---

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions and return count', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ id: 'exp-1' }, { id: 'exp-2' }],
      });

      const count = await cleanupExpiredSessions();

      expect(count).toBe(2);
      expect(mockDbQuery).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE expires_at < NOW() RETURNING id'
      );
    });

    it('should return 0 when no expired sessions', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const count = await cleanupExpiredSessions();
      expect(count).toBe(0);
    });

    it('should propagate database errors', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('timeout'));

      await expect(cleanupExpiredSessions()).rejects.toThrow('timeout');
    });
  });
});
