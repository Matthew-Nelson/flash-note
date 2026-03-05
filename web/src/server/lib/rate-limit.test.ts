import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock redis to return null (no Redis in test)
vi.mock('./redis', () => ({
  redis: null,
}));

const {
  checkRateLimit,
  rateLimitKey,
  loginRateLimit,
  registerRateLimit,
  verificationResendRateLimit,
  verificationCompleteRateLimit,
  passwordResetRequestRateLimit,
  passwordResetCompleteRateLimit,
  inviteCodeValidateRateLimit,
  orgJoinRateLimit,
  generateRateLimit,
  checkoutRateLimit,
  apiRateLimit,
} = await import('./rate-limit');

describe('rate-limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should return success when limiter is null (no Redis)', async () => {
      const result = await checkRateLimit(null, 'test-key');

      expect(result).toEqual({
        success: true,
        limit: 0,
        remaining: 0,
        reset: 0,
      });
    });

    it('should call limiter.limit and return result when limiter exists', async () => {
      const mockLimiter = {
        limit: vi.fn().mockResolvedValueOnce({
          success: true,
          limit: 10,
          remaining: 9,
          reset: 1700000000000,
          pending: Promise.resolve(),
        }),
      };

      const result = await checkRateLimit(mockLimiter as never, 'user:123');

      expect(mockLimiter.limit).toHaveBeenCalledWith('user:123');
      expect(result).toEqual({
        success: true,
        limit: 10,
        remaining: 9,
        reset: 1700000000000,
      });
    });

    it('should return blocked result when limiter rejects', async () => {
      const mockLimiter = {
        limit: vi.fn().mockResolvedValueOnce({
          success: false,
          limit: 5,
          remaining: 0,
          reset: 1700000000000,
          pending: Promise.resolve(),
        }),
      };

      const result = await checkRateLimit(mockLimiter as never, 'attacker-ip');

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('rateLimitKey', () => {
    it('should return IP only when no identifier', () => {
      expect(rateLimitKey('192.168.1.1')).toBe('192.168.1.1');
    });

    it('should build compound key with IP:identifier', () => {
      expect(rateLimitKey('192.168.1.1', 'test@example.com')).toBe('192.168.1.1:test@example.com');
    });

    it('should handle IPv6 addresses', () => {
      expect(rateLimitKey('::1', 'user-id')).toBe('::1:user-id');
    });

    it('should return IP when identifier is undefined', () => {
      expect(rateLimitKey('10.0.0.1', undefined)).toBe('10.0.0.1');
    });
  });

  describe('limiter instances', () => {
    it('should all be null when Redis is unavailable', () => {
      // All limiters should be null since redis mock returns null
      expect(loginRateLimit).toBeNull();
      expect(registerRateLimit).toBeNull();
      expect(verificationResendRateLimit).toBeNull();
      expect(verificationCompleteRateLimit).toBeNull();
      expect(passwordResetRequestRateLimit).toBeNull();
      expect(passwordResetCompleteRateLimit).toBeNull();
      expect(inviteCodeValidateRateLimit).toBeNull();
      expect(orgJoinRateLimit).toBeNull();
      expect(generateRateLimit).toBeNull();
      expect(checkoutRateLimit).toBeNull();
      expect(apiRateLimit).toBeNull();
    });
  });
});
