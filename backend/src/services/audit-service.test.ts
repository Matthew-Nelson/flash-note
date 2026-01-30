import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuditAction } from '../types/index.js';

// Create a separate mock for db that we can control in this test
const mockDbQuery = vi.fn();

vi.mock('../db/index.js', () => ({
  db: {
    query: (...args: unknown[]) => mockDbQuery(...args),
  },
}));

// Import after mocking
const { auditService } = await import('./audit-service.js');

describe('AuditService', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockDbQuery.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('log', () => {
    it('should insert audit log entry into database', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await auditService.log({
        userId: 'user-123',
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
      });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.any(Array)
      );
    });

    it('should include all required fields in INSERT', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await auditService.log({
        userId: 'user-123',
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
        metadata: { device: 'mobile' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('user_id, action, status, metadata, ip_address, user_agent'),
        ['user-123', AuditAction.LOGIN, 'SUCCESS', '{"device":"mobile"}', '192.168.1.1', 'Mozilla/5.0']
      );
    });

    it('should handle null userId for unauthenticated events', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await auditService.log({
        userId: null,
        action: AuditAction.LOGIN_FAILED,
        status: 'FAILURE',
      });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null])
      );
    });

    it('should serialize metadata to JSON', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await auditService.log({
        userId: 'user-123',
        action: AuditAction.NOTE_GENERATED,
        status: 'SUCCESS',
        metadata: {
          noteType: 'daily_note',
          tokensUsed: 150,
          nested: { key: 'value' },
        },
      });

      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      const metadataParam = params[3];

      expect(metadataParam).toBe(
        '{"noteType":"daily_note","tokensUsed":150,"nested":{"key":"value"}}'
      );
    });

    it('should use empty object when metadata is undefined', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await auditService.log({
        userId: 'user-123',
        action: AuditAction.LOGOUT,
        status: 'SUCCESS',
      });

      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      const metadataParam = params[3];

      expect(metadataParam).toBe('{}');
    });

    it('should handle null ipAddress and userAgent', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await auditService.log({
        userId: 'user-123',
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
      });

      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];

      expect(params[4]).toBeNull(); // ipAddress
      expect(params[5]).toBeNull(); // userAgent
    });

    it('should not throw when database query fails (fail-safe)', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      // Should not throw
      await expect(
        auditService.log({
          userId: 'user-123',
          action: AuditAction.LOGIN,
          status: 'SUCCESS',
        })
      ).resolves.not.toThrow();
    });

    it('should log error to console when database query fails', async () => {
      const dbError = new Error('Database connection failed');
      mockDbQuery.mockRejectedValueOnce(dbError);

      await auditService.log({
        userId: 'user-123',
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Audit log failed:', dbError);
    });

    it('should not break application flow when audit fails', async () => {
      // Simulate multiple failures - app should continue working
      mockDbQuery.mockRejectedValue(new Error('Persistent failure'));

      const logPromises = [
        auditService.log({ userId: 'user-1', action: AuditAction.LOGIN, status: 'SUCCESS' }),
        auditService.log({ userId: 'user-2', action: AuditAction.LOGOUT, status: 'SUCCESS' }),
        auditService.log({ userId: null, action: AuditAction.LOGIN_FAILED, status: 'FAILURE' }),
      ];

      // All should resolve without throwing
      await expect(Promise.all(logPromises)).resolves.not.toThrow();
    });
  });

  describe('HIPAA compliance properties', () => {
    it('should include user-agent for complete audit trail', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await auditService.log({
        userId: 'user-123',
        action: AuditAction.NOTE_GENERATED,
        status: 'SUCCESS',
        userAgent: 'Chrome/120.0.0.0',
      });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('user_agent'),
        expect.arrayContaining(['Chrome/120.0.0.0'])
      );
    });

    it('should include IP address for security auditing', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await auditService.log({
        userId: 'user-123',
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
        ipAddress: '203.0.113.42',
      });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('ip_address'),
        expect.arrayContaining(['203.0.113.42'])
      );
    });

    it('should support all audit action types', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });

      const allActions = Object.values(AuditAction);

      for (const action of allActions) {
        await auditService.log({
          userId: 'user-123',
          action,
          status: 'SUCCESS',
        });
      }

      expect(mockDbQuery).toHaveBeenCalledTimes(allActions.length);
    });

    it('should support SUCCESS and FAILURE status values', async () => {
      mockDbQuery.mockResolvedValue({ rows: [] });

      await auditService.log({
        userId: 'user-123',
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
      });

      await auditService.log({
        userId: null,
        action: AuditAction.LOGIN_FAILED,
        status: 'FAILURE',
      });

      const calls = mockDbQuery.mock.calls;
      expect(calls[0]![1]).toContain('SUCCESS');
      expect(calls[1]![1]).toContain('FAILURE');
    });

    it('should use parameterized queries to prevent SQL injection', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await auditService.log({
        userId: "user-123'; DROP TABLE audit_logs; --",
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
        metadata: { injection: "'; DROP TABLE users; --" },
      });

      // The malicious values should be passed as parameters, not concatenated
      const [query, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];

      // Query should use placeholders
      expect(query).toContain('$1');
      expect(query).toContain('$2');

      // Query should NOT contain the malicious strings directly
      expect(query).not.toContain('DROP TABLE');

      // Malicious values should be safely in the params array
      expect(params[0]).toContain('DROP TABLE');
    });
  });

  describe('error handling resilience', () => {
    it('should handle timeout errors gracefully', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('Query timeout'));

      await expect(
        auditService.log({
          userId: 'user-123',
          action: AuditAction.LOGIN,
          status: 'SUCCESS',
        })
      ).resolves.not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle connection pool exhaustion gracefully', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('Connection pool exhausted'));

      await expect(
        auditService.log({
          userId: 'user-123',
          action: AuditAction.LOGIN,
          status: 'SUCCESS',
        })
      ).resolves.not.toThrow();
    });

    it('should handle constraint violation errors gracefully', async () => {
      mockDbQuery.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint')
      );

      await expect(
        auditService.log({
          userId: 'user-123',
          action: AuditAction.LOGIN,
          status: 'SUCCESS',
        })
      ).resolves.not.toThrow();
    });
  });
});
