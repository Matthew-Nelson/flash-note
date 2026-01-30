import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockAuditLog, resetMocks } from '../test/setup.js';
import { requireEmailVerification } from './email-verification.js';
import { AuditAction, type AuthenticatedRequest } from '../types/index.js';
import type { Request, Response, NextFunction } from 'express';

// Mock findUserById
const mockFindUserById = vi.fn();
vi.mock('../db/queries/users.js', () => ({
  findUserById: (...args: unknown[]) => mockFindUserById(...args),
}));

describe('requireEmailVerification middleware', () => {
  let mockReq: AuthenticatedRequest;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetMocks();
    mockFindUserById.mockReset();
    // Ensure auditService.log returns a Promise for safeAuditLog
    mockAuditLog.mockResolvedValue(undefined);

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      ip: '127.0.0.1',
      path: '/notes/generate',
      method: 'POST',
      get: vi.fn().mockReturnValue('test-user-agent'),
      user: { userId: 'test-user-id', email: 'test@example.com', tokenVersion: 1 },
    } as unknown as AuthenticatedRequest;
    mockRes = {
      status: statusMock as unknown as Response['status'],
      json: jsonMock as unknown as Response['json'],
    };
    mockNext = vi.fn() as unknown as NextFunction;
  });

  it('should allow verified users through', async () => {
    mockFindUserById.mockResolvedValueOnce({
      id: 'test-user-id',
      email: 'test@example.com',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    await requireEmailVerification(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockNext).toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('should block unverified users with 403', async () => {
    mockFindUserById.mockResolvedValueOnce({
      id: 'test-user-id',
      email: 'test@example.com',
      emailVerified: false,
      emailVerifiedAt: null,
    });

    await requireEmailVerification(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockNext).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'email_not_verified',
        message: 'Please verify your email address to access this feature',
      },
    });
  });

  it('should log ACCESS_DENIED audit event for unverified users', async () => {
    mockFindUserById.mockResolvedValueOnce({
      id: 'test-user-id',
      email: 'test@example.com',
      emailVerified: false,
      emailVerifiedAt: null,
    });

    await requireEmailVerification(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'test-user-id',
        action: AuditAction.ACCESS_DENIED,
        status: 'FAILURE',
        metadata: expect.objectContaining({
          reason: 'email_not_verified',
          path: '/notes/generate',
          method: 'POST',
        }),
      })
    );
  });

  it('should return 401 if userId is missing (fail-secure)', async () => {
    (mockReq as { user?: unknown }).user = undefined;

    await requireEmailVerification(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockNext).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: { code: 'unauthorized', message: 'Authentication required' },
    });
  });

  it('should return 401 if user not found (fail-secure)', async () => {
    mockFindUserById.mockResolvedValueOnce(null);

    await requireEmailVerification(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockNext).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: { code: 'user_not_found', message: 'User not found' },
    });
  });

  it('should return 500 on database errors (fail-secure)', async () => {
    mockFindUserById.mockRejectedValueOnce(new Error('Database connection failed'));

    // Mock console.error to suppress output during test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await requireEmailVerification(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockNext).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: { code: 'internal_error', message: 'An error occurred' },
    });

    consoleErrorSpy.mockRestore();
  });

  it('should not leak database errors to client', async () => {
    const sensitiveError = new Error('Connection to postgres://user:password@host failed');
    mockFindUserById.mockRejectedValueOnce(sensitiveError);

    // Mock console.error to suppress output during test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await requireEmailVerification(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    // Verify generic error returned, not the sensitive database error
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: { code: 'internal_error', message: 'An error occurred' },
    });
    // Error should be logged internally (but not returned to client)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Email verification check failed:',
      sensitiveError
    );

    consoleErrorSpy.mockRestore();
  });
});
