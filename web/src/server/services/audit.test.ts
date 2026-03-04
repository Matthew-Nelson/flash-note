import { describe, it, expect, beforeEach, vi, afterEach, beforeAll } from 'vitest';
import { AuditAction } from '@/server/types';

// Create a typed mock for the db query function
const mockDbQuery = vi.fn<(...args: unknown[]) => Promise<{ rows: unknown[] }>>();

// Mock only the db module — we'll test the real audit service against this mock
vi.mock('@/server/db', () => ({
  db: {
    query: (...args: unknown[]) => mockDbQuery(...args),
  },
  getPoolClient: vi.fn(),
}));

// Dynamically import after mocks are set up
let auditService: typeof import('./audit').auditService;

describe('AuditService', () => {
  beforeAll(async () => {
    vi.resetModules();
    const module = await import('./audit');
    auditService = module.auditService;
  });

  beforeEach(() => {
    mockDbQuery.mockReset();
    mockDbQuery.mockResolvedValue({ rows: [] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log', () => {
    it('should insert audit log entry into database', async () => {
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
      await auditService.log({
        userId: 'user-123',
        action: AuditAction.NOTE_GENERATED,
        status: 'SUCCESS',
        metadata: {
          noteType: 'daily_note',
          inputTokens: 100,
          outputTokens: 50,
          nested: { key: 'value' },
        },
      });

      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      const metadataParam = params[3];

      expect(metadataParam).toBe(
        '{"noteType":"daily_note","inputTokens":100,"outputTokens":50,"nested":{"key":"value"}}'
      );
    });

    it('should use empty object when metadata is undefined', async () => {
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
      await auditService.log({
        userId: 'user-123',
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
      });

      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];

      expect(params[4]).toBeNull();
      expect(params[5]).toBeNull();
    });

    it('should sanitize ipAddress before inserting into INET column', async () => {
      await auditService.log({
        userId: 'user-123',
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
        ipAddress: '192.168.1.1',
      });

      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(params[4]).toBe('192.168.1.1');
    });

    it('should sanitize invalid ipAddress to null', async () => {
      await auditService.log({
        userId: 'user-123',
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
        ipAddress: 'not-a-valid-ip',
      });

      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(params[4]).toBeNull();
    });

    it('should not throw when database query fails (fail-safe)', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        auditService.log({
          userId: 'user-123',
          action: AuditAction.LOGIN,
          status: 'SUCCESS',
        })
      ).resolves.not.toThrow();
    });

    it('should log error to console with structured context when database query fails', async () => {
      const dbError = new Error('Database connection failed');
      mockDbQuery.mockRejectedValueOnce(dbError);

      await auditService.log({
        userId: 'user-123',
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
      });

      expect(console.error).toHaveBeenCalledWith('Audit log failed:', dbError, {
        source: 'service_audit',
        errorType: 'audit_write_failed',
        userId: 'user-123',
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
      });
    });

    it('should not break application flow when audit fails', async () => {
      mockDbQuery.mockRejectedValue(new Error('Persistent failure'));

      const logPromises = [
        auditService.log({ userId: 'user-1', action: AuditAction.LOGIN, status: 'SUCCESS' }),
        auditService.log({ userId: 'user-2', action: AuditAction.LOGOUT, status: 'SUCCESS' }),
        auditService.log({ userId: null, action: AuditAction.LOGIN_FAILED, status: 'FAILURE' }),
      ];

      await expect(Promise.all(logPromises)).resolves.not.toThrow();
    });
  });

  describe('logWithClient (Rule 9: transactional audit)', () => {
    it('should use the provided PoolClient for transactional writes', async () => {
      const mockClientQuery = vi.fn().mockResolvedValueOnce({ rows: [] });
      const mockClient = { query: mockClientQuery } as never;

      await auditService.logWithClient(mockClient, {
        userId: 'user-123',
        action: AuditAction.PASSWORD_RESET_SUCCESS,
        status: 'SUCCESS',
      });

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.any(Array)
      );
      // Pool should NOT be used
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    it('should propagate errors to the caller (not swallow them)', async () => {
      const dbError = new Error('FK violation');
      const mockClientQuery = vi.fn().mockRejectedValueOnce(dbError);
      const mockClient = { query: mockClientQuery } as never;

      await expect(
        auditService.logWithClient(mockClient, {
          userId: 'user-123',
          action: AuditAction.LOGIN,
          status: 'SUCCESS',
        })
      ).rejects.toThrow('FK violation');
    });

    it('should sanitize ipAddress before inserting', async () => {
      const mockClientQuery = vi.fn().mockResolvedValueOnce({ rows: [] });
      const mockClient = { query: mockClientQuery } as never;

      await auditService.logWithClient(mockClient, {
        userId: 'user-123',
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
        ipAddress: 'not-an-ip',
      });

      const [, params] = mockClientQuery.mock.calls[0] as [string, unknown[]];
      expect(params[4]).toBeNull();
    });

    it('should include all fields in the INSERT', async () => {
      const mockClientQuery = vi.fn().mockResolvedValueOnce({ rows: [] });
      const mockClient = { query: mockClientQuery } as never;

      await auditService.logWithClient(mockClient, {
        userId: 'user-123',
        action: AuditAction.REGISTER,
        status: 'SUCCESS',
        metadata: { method: 'invite' },
        ipAddress: '10.0.0.1',
        userAgent: 'TestAgent',
      });

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('user_id, action, status, metadata, ip_address, user_agent'),
        ['user-123', AuditAction.REGISTER, 'SUCCESS', '{"method":"invite"}', '10.0.0.1', 'TestAgent']
      );
    });
  });

  describe('HIPAA compliance properties', () => {
    it('should include user-agent for complete audit trail', async () => {
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
      expect(calls[0][1]).toContain('SUCCESS');
      expect(calls[1][1]).toContain('FAILURE');
    });

    it('should use parameterized queries', async () => {
      await auditService.log({
        userId: "user-123'; DROP TABLE audit_logs; --",
        action: AuditAction.LOGIN,
        status: 'SUCCESS',
        metadata: { injection: "'; DROP TABLE users; --" },
      });

      const [query, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];

      expect(query).toContain('$1');
      expect(query).toContain('$2');
      expect(query).not.toContain('DROP TABLE');
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

      expect(console.error).toHaveBeenCalled();
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
