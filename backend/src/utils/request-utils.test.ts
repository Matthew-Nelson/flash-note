import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Request } from 'express';
import { getRequestMetadata, safeAuditLog, sanitizeIpAddress } from './request-utils.js';

describe('request-utils', () => {
  describe('getRequestMetadata', () => {
    it('should extract IP from req.ip when available', () => {
      const mockReq = {
        ip: '192.168.1.1',
        socket: { remoteAddress: '10.0.0.1' },
        get: vi.fn().mockReturnValue('Mozilla/5.0'),
      } as unknown as Request;

      const result = getRequestMetadata(mockReq);

      expect(result.ipAddress).toBe('192.168.1.1');
    });

    it('should fallback to socket.remoteAddress when req.ip is undefined', () => {
      const mockReq = {
        ip: undefined,
        socket: { remoteAddress: '10.0.0.1' },
        get: vi.fn().mockReturnValue('Mozilla/5.0'),
      } as unknown as Request;

      const result = getRequestMetadata(mockReq);

      expect(result.ipAddress).toBe('10.0.0.1');
    });

    it('should extract user-agent from headers', () => {
      const mockGet = vi.fn().mockImplementation((header: string) => {
        if (header === 'user-agent') return 'Chrome/120.0';
        return undefined;
      });

      const mockReq = {
        ip: '192.168.1.1',
        socket: { remoteAddress: '10.0.0.1' },
        get: mockGet,
      } as unknown as Request;

      const result = getRequestMetadata(mockReq);

      expect(result.userAgent).toBe('Chrome/120.0');
      expect(mockGet).toHaveBeenCalledWith('user-agent');
    });

    it('should return undefined for missing user-agent', () => {
      const mockReq = {
        ip: '192.168.1.1',
        socket: { remoteAddress: '10.0.0.1' },
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as Request;

      const result = getRequestMetadata(mockReq);

      expect(result.userAgent).toBeUndefined();
    });

    it('should handle empty string IP', () => {
      const mockReq = {
        ip: '',
        socket: { remoteAddress: '10.0.0.1' },
        get: vi.fn().mockReturnValue('Mozilla/5.0'),
      } as unknown as Request;

      const result = getRequestMetadata(mockReq);

      // Empty string is falsy, so should fallback to socket
      expect(result.ipAddress).toBe('10.0.0.1');
    });

    it('should handle both IP and socket being undefined', () => {
      const mockReq = {
        ip: undefined,
        socket: { remoteAddress: undefined },
        get: vi.fn().mockReturnValue('Mozilla/5.0'),
      } as unknown as Request;

      const result = getRequestMetadata(mockReq);

      expect(result.ipAddress).toBeUndefined();
    });
  });

  describe('sanitizeIpAddress', () => {
    it('should return valid IPv4 address', () => {
      expect(sanitizeIpAddress('192.168.1.1')).toBe('192.168.1.1');
    });

    it('should return valid IPv6 address', () => {
      expect(sanitizeIpAddress('::1')).toBe('::1');
      expect(sanitizeIpAddress('2001:db8::1')).toBe('2001:db8::1');
    });

    it('should return null for malformed IP', () => {
      expect(sanitizeIpAddress('not-an-ip')).toBeNull();
      expect(sanitizeIpAddress('999.999.999.999')).toBeNull();
      expect(sanitizeIpAddress('192.168.1')).toBeNull();
    });

    it('should return null for null or undefined', () => {
      expect(sanitizeIpAddress(null)).toBeNull();
      expect(sanitizeIpAddress(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(sanitizeIpAddress('')).toBeNull();
    });

    it('should return valid loopback addresses', () => {
      expect(sanitizeIpAddress('127.0.0.1')).toBe('127.0.0.1');
      expect(sanitizeIpAddress('::1')).toBe('::1');
    });
  });

  describe('safeAuditLog', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    afterEach(() => {
      consoleErrorSpy?.mockRestore();
    });

    it('should not throw when audit promise resolves', async () => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const successfulPromise = Promise.resolve();

      // Should not throw
      expect(() => safeAuditLog(successfulPromise, 'test-context')).not.toThrow();

      // Wait for promise to settle
      await successfulPromise;

      // Should not log error
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should catch and log errors from audit promise', async () => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('Audit database error');
      const failedPromise = Promise.reject(error);

      // Should not throw synchronously
      expect(() => safeAuditLog(failedPromise, 'login-audit')).not.toThrow();

      // Wait for the catch handler to run
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should log the error with context
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Audit log failed (login-audit):',
        error
      );
    });

    it('should include context in error message', async () => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const failedPromise = Promise.reject(new Error('DB error'));

      safeAuditLog(failedPromise, 'subscription-update');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('subscription-update'),
        expect.any(Error)
      );
    });

    it('should not block the caller (fire and forget)', () => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create a promise that takes time to reject
      let rejectFn: (err: Error) => void;
      const slowPromise = new Promise<void>((_, reject) => {
        rejectFn = reject;
      });

      const startTime = Date.now();
      safeAuditLog(slowPromise, 'slow-audit');
      const elapsed = Date.now() - startTime;

      // Should return immediately (not block)
      expect(elapsed).toBeLessThan(10);

      // Clean up
      rejectFn!(new Error('Cleanup'));
    });
  });
});
