import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockAuditLog, resetMocks } from '../test/setup.js';
import { requireAuth } from './auth.js';
import { AuditAction } from '../types/index.js';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// Mock getTokenVersion from users queries
const mockGetTokenVersion = vi.fn();
vi.mock('../db/queries/users.js', () => ({
  getTokenVersion: (...args: unknown[]) => mockGetTokenVersion(...args),
}));

describe('requireAuth middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  const createValidToken = (payload: { userId: string; email: string; tokenVersion: number }) => {
    return jwt.sign(payload, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  };

  beforeEach(() => {
    resetMocks();
    mockGetTokenVersion.mockReset();
    mockAuditLog.mockResolvedValue(undefined);

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      headers: {},
      ip: '127.0.0.1',
      path: '/api/notes',
      get: vi.fn().mockReturnValue('test-user-agent'),
    };
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = vi.fn();
  });

  describe('token presence validation', () => {
    it('should return 401 if no authorization header', async () => {
      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'missing_token', message: 'Authorization header required' },
      });
    });

    it('should return 401 if authorization header does not start with Bearer', async () => {
      mockReq.headers = { authorization: 'Basic abc123' };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'missing_token', message: 'Authorization header required' },
      });
    });

    it('should log AUTH_FAILED for missing token', async () => {
      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          action: AuditAction.AUTH_FAILED,
          status: 'FAILURE',
          metadata: expect.objectContaining({ reason: 'missing_token' }),
        })
      );
    });
  });

  describe('token signature validation', () => {
    it('should return 401 for invalid/malformed token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'invalid_token', message: 'Invalid or expired token' },
      });
    });

    it('should return 401 for token signed with wrong secret', async () => {
      const wrongSecretToken = jwt.sign(
        { userId: 'test-user', email: 'test@example.com', tokenVersion: 1 },
        'wrong-secret',
        { algorithm: 'HS256' }
      );
      mockReq.headers = { authorization: `Bearer ${wrongSecretToken}` };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return 401 for expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test-user', email: 'test@example.com', tokenVersion: 1 },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '-1h' }
      );
      mockReq.headers = { authorization: `Bearer ${expiredToken}` };

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });
  });

  describe('token version validation', () => {
    it('should allow request when token version matches', async () => {
      const token = createValidToken({
        userId: 'test-user-id',
        email: 'test@example.com',
        tokenVersion: 1,
      });
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockGetTokenVersion.mockResolvedValueOnce(1);

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 401 when token version does not match (password was reset)', async () => {
      // Token has version 1, but user's current version is 2 (password was reset)
      const token = createValidToken({
        userId: 'test-user-id',
        email: 'test@example.com',
        tokenVersion: 1,
      });
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockGetTokenVersion.mockResolvedValueOnce(2);

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'invalid_token', message: 'Invalid or expired token' },
      });
    });

    it('should log token_version_mismatch with details', async () => {
      const token = createValidToken({
        userId: 'test-user-id',
        email: 'test@example.com',
        tokenVersion: 1,
      });
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockGetTokenVersion.mockResolvedValueOnce(3);

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-id',
          action: AuditAction.AUTH_FAILED,
          status: 'FAILURE',
          metadata: expect.objectContaining({
            reason: 'token_version_mismatch',
            tokenVersion: 1,
            currentVersion: 3,
          }),
        })
      );
    });

    it('should return 401 when user no longer exists', async () => {
      const token = createValidToken({
        userId: 'deleted-user-id',
        email: 'deleted@example.com',
        tokenVersion: 1,
      });
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockGetTokenVersion.mockResolvedValueOnce(null);

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should log user_not_found when user does not exist', async () => {
      const token = createValidToken({
        userId: 'deleted-user-id',
        email: 'deleted@example.com',
        tokenVersion: 1,
      });
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockGetTokenVersion.mockResolvedValueOnce(null);

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'deleted-user-id',
          action: AuditAction.AUTH_FAILED,
          status: 'FAILURE',
          metadata: expect.objectContaining({ reason: 'user_not_found' }),
        })
      );
    });
  });

  describe('security edge cases', () => {
    it('should reject token with future version (tampered token)', async () => {
      // If someone tries to tamper with the token to use a higher version
      const token = createValidToken({
        userId: 'test-user-id',
        email: 'test@example.com',
        tokenVersion: 99,
      });
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockGetTokenVersion.mockResolvedValueOnce(1);

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should set user payload on request when authentication succeeds', async () => {
      const token = createValidToken({
        userId: 'test-user-id',
        email: 'test@example.com',
        tokenVersion: 1,
      });
      mockReq.headers = { authorization: `Bearer ${token}` };
      mockGetTokenVersion.mockResolvedValueOnce(1);

      await requireAuth(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as { user?: unknown }).user).toEqual(
        expect.objectContaining({
          userId: 'test-user-id',
          email: 'test@example.com',
          tokenVersion: 1,
        })
      );
    });
  });
});
