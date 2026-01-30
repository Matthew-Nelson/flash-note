import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { mockDbQuery, mockAuditLog, resetMocks } from '../test/setup.js';
import { requireActiveSubscription } from './subscription.js';
import { AuditAction, type AuthenticatedRequest } from '../types/index.js';

describe('Subscription Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetMocks();
    vi.useFakeTimers();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      path: '/api/notes/generate',
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('TestAgent/1.0'),
      user: { userId: 'user-123', email: 'test@example.com', tokenVersion: 1 },
    };
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('authentication check', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined;

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'unauthorized', message: 'Authentication required' },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log ACCESS_DENIED audit event for unauthenticated request', async () => {
      mockReq.user = undefined;

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          action: AuditAction.ACCESS_DENIED,
          status: 'FAILURE',
          metadata: expect.objectContaining({ reason: 'unauthorized' }),
        })
      );
    });

    it('should return 401 when userId is missing from user object', async () => {
      mockReq.user = { userId: '', email: 'test@example.com', tokenVersion: 1 };

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
    });
  });

  describe('user not found', () => {
    it('should return 401 when user does not exist in database', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'user_not_found', message: 'User not found' },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log ACCESS_DENIED audit event when user not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: AuditAction.ACCESS_DENIED,
          status: 'FAILURE',
          metadata: expect.objectContaining({ reason: 'user_not_found' }),
        })
      );
    });
  });

  describe('trial subscription', () => {
    it('should call next() when trial is active', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ subscription_status: 'trialing', trial_ends_at: futureDate }],
      });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 402 when trial has expired', async () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ subscription_status: 'trialing', trial_ends_at: pastDate }],
      });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(402);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'trial_expired',
          message: 'Your trial has ended. Please subscribe to continue.',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log ACCESS_DENIED audit event when trial expired', async () => {
      const pastDate = new Date(Date.now() - 1000);
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ subscription_status: 'trialing', trial_ends_at: pastDate }],
      });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: AuditAction.ACCESS_DENIED,
          status: 'FAILURE',
          metadata: expect.objectContaining({ reason: 'trial_expired' }),
        })
      );
    });

    it('should handle trial expiring exactly now (boundary condition)', async () => {
      const exactlyNow = new Date();
      vi.setSystemTime(exactlyNow);
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ subscription_status: 'trialing', trial_ends_at: exactlyNow }],
      });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      // Exactly equal should be considered expired (< not <=)
      expect(statusMock).toHaveBeenCalledWith(402);
    });
  });

  describe('active subscription', () => {
    it('should call next() when subscription is active', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ subscription_status: 'active', trial_ends_at: null }],
      });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('inactive subscription states', () => {
    const inactiveStates = ['canceled', 'past_due', 'unpaid'];

    inactiveStates.forEach((status) => {
      it(`should return 402 when subscription status is ${status}`, async () => {
        mockDbQuery.mockResolvedValueOnce({
          rows: [{ subscription_status: status, trial_ends_at: null }],
        });

        await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(402);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'subscription_required',
            message: 'Please subscribe to use FlashNote.',
          },
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it(`should log ACCESS_DENIED with subscription status ${status}`, async () => {
        mockDbQuery.mockResolvedValueOnce({
          rows: [{ subscription_status: status, trial_ends_at: null }],
        });

        await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

        expect(mockAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-123',
            action: AuditAction.ACCESS_DENIED,
            status: 'FAILURE',
            metadata: expect.objectContaining({
              reason: 'subscription_required',
              subscriptionStatus: status,
            }),
          })
        );
      });
    });
  });

  describe('error handling', () => {
    it('should call next(error) when database query fails', async () => {
      const dbError = new Error('Database connection failed');
      mockDbQuery.mockRejectedValueOnce(dbError);

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('audit logging metadata', () => {
    it('should include request path in audit metadata', async () => {
      mockReq.path = '/api/notes/generate';
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ path: '/api/notes/generate' }),
        })
      );
    });

    it('should include IP address in audit log', async () => {
      mockReq.ip = '203.0.113.42';
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '203.0.113.42',
        })
      );
    });

    it('should include user agent in audit log', async () => {
      (mockReq.get as ReturnType<typeof vi.fn>).mockImplementation((header: string) => {
        if (header === 'user-agent') return 'Mozilla/5.0 Chrome/120';
        return undefined;
      });
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Mozilla/5.0 Chrome/120',
        })
      );
    });
  });

  describe('database query', () => {
    it('should query only subscription_status and trial_ends_at (minimal data)', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ subscription_status: 'active', trial_ends_at: null }],
      });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT subscription_status, trial_ends_at FROM users'),
        ['user-123']
      );
    });

    it('should use parameterized query to prevent SQL injection', async () => {
      mockReq.user = {
        userId: "'; DROP TABLE users; --",
        email: 'test@example.com',
        tokenVersion: 1,
      };
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      const [query, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];

      // Query should use placeholder
      expect(query).toContain('$1');
      expect(query).not.toContain('DROP TABLE');

      // Malicious value should be in params
      expect(params[0]).toContain('DROP TABLE');
    });
  });

  describe('security: fail-secure behavior', () => {
    it('should deny access when subscription_status is null', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ subscription_status: null, trial_ends_at: null }],
      });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(402);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for unknown subscription status', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ subscription_status: 'unknown_status', trial_ends_at: null }],
      });

      await requireActiveSubscription(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(402);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
