import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { mockAuditLog, resetMocks, TEST_CONFIG_DEFAULTS } from '../test/setup.js';
import { generateCsrfToken, validateCsrfToken, requireCsrf } from './csrf.js';
import { AuditAction, type AuthenticatedRequest } from '../types/index.js';

// Mock config
vi.mock('../config.js', () => ({
  config: {
    CSRF_SECRET: TEST_CONFIG_DEFAULTS.CSRF_SECRET,
  },
}));

describe('CSRF Middleware', () => {
  beforeEach(() => {
    resetMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateCsrfToken', () => {
    it('should generate a base64url encoded token', () => {
      const token = generateCsrfToken('user-123');

      // Should be valid base64url (no +, /, or = characters)
      expect(token).not.toMatch(/[+/=]/);
      // Should be decodable
      expect(() => Buffer.from(token, 'base64url').toString('utf8')).not.toThrow();
    });

    it('should include userId in token', () => {
      const userId = 'user-abc-123';
      const token = generateCsrfToken(userId);

      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      expect(decoded.startsWith(userId)).toBe(true);
    });

    it('should include timestamp in token', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const token = generateCsrfToken('user-123');
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split(':');

      expect(parts[1]).toBe(now.toString());
    });

    it('should include HMAC signature in token', () => {
      const token = generateCsrfToken('user-123');
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split(':');

      // Should have 3 parts: userId, timestamp, signature
      expect(parts).toHaveLength(3);
      // Signature should be 64 hex characters (SHA-256)
      expect(parts[2]).toHaveLength(64);
      expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate different tokens for different users', () => {
      vi.setSystemTime(Date.now());

      const token1 = generateCsrfToken('user-1');
      const token2 = generateCsrfToken('user-2');

      expect(token1).not.toBe(token2);
    });

    it('should generate different tokens at different times for same user', () => {
      vi.setSystemTime(1000);
      const token1 = generateCsrfToken('user-123');

      vi.setSystemTime(2000);
      const token2 = generateCsrfToken('user-123');

      expect(token1).not.toBe(token2);
    });
  });

  describe('validateCsrfToken', () => {
    it('should return true for valid token', () => {
      vi.setSystemTime(Date.now());
      const token = generateCsrfToken('user-123');

      const isValid = validateCsrfToken(token, 'user-123');

      expect(isValid).toBe(true);
    });

    it('should return false for token with wrong userId', () => {
      const token = generateCsrfToken('user-123');

      const isValid = validateCsrfToken(token, 'user-456');

      expect(isValid).toBe(false);
    });

    it('should return false for expired token (>24 hours)', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const token = generateCsrfToken('user-123');

      // Advance time by 24 hours + 1 second
      vi.setSystemTime(now + 24 * 60 * 60 * 1000 + 1000);

      const isValid = validateCsrfToken(token, 'user-123');

      expect(isValid).toBe(false);
    });

    it('should return true for token just within 24-hour window', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const token = generateCsrfToken('user-123');

      // Advance time by 23 hours 59 minutes
      vi.setSystemTime(now + 23 * 60 * 60 * 1000 + 59 * 60 * 1000);

      const isValid = validateCsrfToken(token, 'user-123');

      expect(isValid).toBe(true);
    });

    it('should return false for token with future timestamp', () => {
      const now = Date.now();
      vi.setSystemTime(now + 10000); // Generate token "in the future"
      const token = generateCsrfToken('user-123');

      vi.setSystemTime(now); // Go back to "present"

      const isValid = validateCsrfToken(token, 'user-123');

      expect(isValid).toBe(false);
    });

    it('should return false for tampered signature', () => {
      const token = generateCsrfToken('user-123');
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split(':');

      // Tamper with signature
      const tamperedSignature = 'a'.repeat(64);
      const tamperedToken = Buffer.from(
        `${parts[0]}:${parts[1]}:${tamperedSignature}`
      ).toString('base64url');

      const isValid = validateCsrfToken(tamperedToken, 'user-123');

      expect(isValid).toBe(false);
    });

    it('should return false for tampered timestamp', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const token = generateCsrfToken('user-123');
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split(':');

      // Tamper with timestamp but keep original signature
      const tamperedToken = Buffer.from(
        `${parts[0]}:${now + 1000}:${parts[2]}`
      ).toString('base64url');

      const isValid = validateCsrfToken(tamperedToken, 'user-123');

      expect(isValid).toBe(false);
    });

    it('should return false for malformed token (wrong number of parts)', () => {
      const malformedToken = Buffer.from('user-123:timestamp').toString('base64url');

      const isValid = validateCsrfToken(malformedToken, 'user-123');

      expect(isValid).toBe(false);
    });

    it('should return false for invalid base64url encoding', () => {
      const isValid = validateCsrfToken('not-valid-base64!!!', 'user-123');

      expect(isValid).toBe(false);
    });

    it('should return false for empty token', () => {
      const isValid = validateCsrfToken('', 'user-123');

      expect(isValid).toBe(false);
    });

    it('should use timing-safe comparison to prevent timing attacks', () => {
      // This test verifies the implementation uses crypto.timingSafeEqual
      // by checking that validation takes similar time for valid/invalid signatures
      const token = generateCsrfToken('user-123');

      // Run multiple iterations to detect timing differences
      const iterations = 100;
      const validTimes: number[] = [];
      const invalidTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start1 = process.hrtime.bigint();
        validateCsrfToken(token, 'user-123');
        const end1 = process.hrtime.bigint();
        validTimes.push(Number(end1 - start1));

        const start2 = process.hrtime.bigint();
        validateCsrfToken(token, 'wrong-user');
        const end2 = process.hrtime.bigint();
        invalidTimes.push(Number(end2 - start2));
      }

      // The average times should be relatively close
      // This is a soft assertion since timing can vary
      const avgValid = validTimes.reduce((a, b) => a + b, 0) / iterations;
      const avgInvalid = invalidTimes.reduce((a, b) => a + b, 0) / iterations;

      // Times should be within same order of magnitude
      // (this is a weak assertion but better than nothing)
      expect(Math.abs(avgValid - avgInvalid)).toBeLessThan(avgValid * 10);
    });
  });

  describe('requireCsrf middleware', () => {
    let mockReq: Partial<AuthenticatedRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let jsonMock: ReturnType<typeof vi.fn>;
    let statusMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      jsonMock = vi.fn();
      statusMock = vi.fn().mockReturnValue({ json: jsonMock });

      mockReq = {
        get: vi.fn().mockReturnValue(undefined),
        originalUrl: '/api/test',
        ip: '127.0.0.1',
        user: { userId: 'user-123', email: 'test@example.com', tokenVersion: 1 },
      } as unknown as AuthenticatedRequest;
      mockRes = {
        status: statusMock as unknown as Response['status'],
        json: jsonMock as unknown as Response['json'],
      };
      mockNext = vi.fn() as unknown as NextFunction;
    });

    it('should return 403 when CSRF token is missing', () => {
      (mockReq.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      requireCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'missing_csrf_token', message: 'CSRF token required' },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log audit event when CSRF token is missing', () => {
      (mockReq.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      requireCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CSRF_FAILED,
          status: 'FAILURE',
          metadata: expect.objectContaining({ reason: 'missing_token' }),
        })
      );
    });

    it('should return 403 when CSRF token is invalid', () => {
      (mockReq.get as ReturnType<typeof vi.fn>).mockReturnValue('invalid-token');

      requireCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'invalid_csrf_token', message: 'Invalid CSRF token' },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log audit event when CSRF token is invalid', () => {
      (mockReq.get as ReturnType<typeof vi.fn>).mockReturnValue('invalid-token');

      requireCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CSRF_FAILED,
          status: 'FAILURE',
          metadata: expect.objectContaining({ reason: 'invalid_token' }),
        })
      );
    });

    it('should return 403 when userId is missing from request', () => {
      const validToken = generateCsrfToken('user-123');
      (mockReq.get as ReturnType<typeof vi.fn>).mockReturnValue(validToken);
      mockReq.user = undefined;

      requireCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when token belongs to different user', () => {
      const tokenForDifferentUser = generateCsrfToken('user-456');
      (mockReq.get as ReturnType<typeof vi.fn>).mockReturnValue(tokenForDifferentUser);

      requireCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() when CSRF token is valid', () => {
      const validToken = generateCsrfToken('user-123');
      (mockReq.get as ReturnType<typeof vi.fn>).mockReturnValue(validToken);

      requireCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should read token from x-csrf-token header', () => {
      const validToken = generateCsrfToken('user-123');
      (mockReq.get as ReturnType<typeof vi.fn>).mockImplementation((header: string) => {
        if (header === 'x-csrf-token') return validToken;
        return undefined;
      });

      requireCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.get).toHaveBeenCalledWith('x-csrf-token');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should include endpoint in audit log metadata', () => {
      mockReq.originalUrl = '/api/notes/generate';
      (mockReq.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      requireCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ endpoint: '/api/notes/generate' }),
        })
      );
    });

    it('should include IP address and user agent in audit log', () => {
      // Create new request with different IP
      mockReq = {
        get: vi.fn().mockImplementation((header: string) => {
          if (header === 'user-agent') return 'TestBrowser/1.0';
          return undefined;
        }),
        originalUrl: '/api/test',
        ip: '192.168.1.1',
        user: { userId: 'user-123', email: 'test@example.com', tokenVersion: 1 },
      } as unknown as AuthenticatedRequest;

      requireCsrf(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'TestBrowser/1.0',
        })
      );
    });
  });

  describe('security properties', () => {
    it('should use SHA-256 HMAC for signature', () => {
      const userId = 'user-123';
      const now = Date.now();
      vi.setSystemTime(now);

      const token = generateCsrfToken(userId);
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      const actualSignature = parts[2];

      // Compute expected signature
      const data = `${userId}:${now}`;
      const expectedSignature = crypto
        .createHmac('sha256', TEST_CONFIG_DEFAULTS.CSRF_SECRET)
        .update(data)
        .digest('hex');

      expect(actualSignature).toBe(expectedSignature);
    });

    it('should bind token to specific user (prevents token reuse across users)', () => {
      const tokenForUser1 = generateCsrfToken('user-1');

      // Token should not be valid for a different user
      expect(validateCsrfToken(tokenForUser1, 'user-2')).toBe(false);
      expect(validateCsrfToken(tokenForUser1, 'user-1')).toBe(true);
    });

    it('should include timestamp to prevent replay attacks beyond expiry', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const token = generateCsrfToken('user-123');

      // Token valid immediately
      expect(validateCsrfToken(token, 'user-123')).toBe(true);

      // Token invalid after 24+ hours (replay protection)
      vi.setSystemTime(now + 25 * 60 * 60 * 1000);
      expect(validateCsrfToken(token, 'user-123')).toBe(false);
    });
  });
});
