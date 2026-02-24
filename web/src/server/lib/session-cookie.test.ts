import crypto from 'node:crypto';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock next/headers cookies()
const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: (...args: unknown[]): unknown => mockSet(...args),
    get: (...args: unknown[]): unknown => mockGet(...args),
    delete: (...args: unknown[]): unknown => mockDelete(...args),
  }),
}));

// Mock config to control isProduction
vi.mock('@/server/db/config', () => ({
  isProduction: false,
  SESSION_COOKIE_MAX_AGE_SECONDS: 7 * 24 * 60 * 60,
}));

const { setSessionCookie, getSessionToken, clearSessionCookie, hashSessionToken } =
  await import('./session-cookie');

describe('session-cookie', () => {
  beforeEach(() => {
    mockSet.mockReset();
    mockGet.mockReset();
    mockDelete.mockReset();
  });

  describe('setSessionCookie', () => {
    it('should set the cookie with correct options', async () => {
      await setSessionCookie('test-token-123');

      expect(mockSet).toHaveBeenCalledWith('session_id', 'test-token-123', {
        httpOnly: true,
        secure: false, // isProduction is mocked to false
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    });

    it('should use httpOnly to prevent XSS access', async () => {
      await setSessionCookie('token');

      const options = mockSet.mock.calls[0][2];
      expect(options.httpOnly).toBe(true);
    });

    it('should set sameSite to lax for CSRF protection', async () => {
      await setSessionCookie('token');

      const options = mockSet.mock.calls[0][2];
      expect(options.sameSite).toBe('lax');
    });

    it('should set path to root', async () => {
      await setSessionCookie('token');

      const options = mockSet.mock.calls[0][2];
      expect(options.path).toBe('/');
    });
  });

  describe('getSessionToken', () => {
    it('should return the cookie value when it exists', async () => {
      mockGet.mockReturnValueOnce({ value: 'my-session-token' });

      const token = await getSessionToken();
      expect(token).toBe('my-session-token');
      expect(mockGet).toHaveBeenCalledWith('session_id');
    });

    it('should return null when cookie does not exist', async () => {
      mockGet.mockReturnValueOnce(undefined);

      const token = await getSessionToken();
      expect(token).toBeNull();
    });
  });

  describe('clearSessionCookie', () => {
    it('should delete the session cookie', async () => {
      await clearSessionCookie();

      expect(mockDelete).toHaveBeenCalledWith('session_id');
    });
  });

  describe('hashSessionToken', () => {
    it('should produce a SHA-256 hex hash', () => {
      const hash = hashSessionToken('test-token');
      const expected = crypto.createHash('sha256').update('test-token').digest('hex');

      expect(hash).toBe(expected);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be deterministic', () => {
      const hash1 = hashSessionToken('same-input');
      const hash2 = hashSessionToken('same-input');

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashSessionToken('token-a');
      const hash2 = hashSessionToken('token-b');

      expect(hash1).not.toBe(hash2);
    });
  });
});
