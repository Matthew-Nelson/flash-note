import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import { getAuth, setAuth, clearAuth } from './storage';
import { createMockStoredAuth } from '@/test/helpers';

describe('Web Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuth', () => {
    it('should return null when storage is empty', () => {
      expect(getAuth()).toBeNull();
    });

    it('should return stored auth data', () => {
      const mockAuth = createMockStoredAuth();
      sessionStorage.setItem('flashnote:auth', JSON.stringify(mockAuth));
      const result = getAuth();
      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe(mockAuth.accessToken);
      expect(result!.user.email).toBe(mockAuth.user.email);
    });

    it('should return null for data missing accessToken', () => {
      sessionStorage.setItem(
        'flashnote:auth',
        JSON.stringify({ user: { id: '1' }, refreshToken: 'r' })
      );
      expect(getAuth()).toBeNull();
    });

    it('should return null for data missing refreshToken', () => {
      sessionStorage.setItem(
        'flashnote:auth',
        JSON.stringify({ user: { id: '1' }, accessToken: 'a' })
      );
      expect(getAuth()).toBeNull();
    });

    it('should return null for data missing user', () => {
      sessionStorage.setItem(
        'flashnote:auth',
        JSON.stringify({ accessToken: 'a', refreshToken: 'r' })
      );
      expect(getAuth()).toBeNull();
    });

    it('should return null and clear storage for corrupted JSON', () => {
      sessionStorage.setItem('flashnote:auth', 'not-json{{{');
      expect(getAuth()).toBeNull();
      expect(sessionStorage.getItem('flashnote:auth')).toBeNull();
    });

    it('should return null in SSR (no window)', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - simulating SSR
      delete globalThis.window;
      try {
        expect(getAuth()).toBeNull();
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });

  describe('setAuth', () => {
    it('should store auth data', () => {
      const mockAuth = createMockStoredAuth();
      setAuth(mockAuth);
      const stored = sessionStorage.getItem('flashnote:auth');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.accessToken).toBe(mockAuth.accessToken);
    });

    it('should capture Sentry exception on storage error', () => {
      const error = new Error('QuotaExceededError');
      vi.mocked(sessionStorage.setItem).mockImplementationOnce(() => {
        throw error;
      });
      setAuth(createMockStoredAuth());
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        extra: { source: 'session_storage' },
      });
    });

    it('should not crash on storage error', () => {
      vi.mocked(sessionStorage.setItem).mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => setAuth(createMockStoredAuth())).not.toThrow();
    });
  });

  describe('clearAuth', () => {
    it('should remove auth from storage', () => {
      sessionStorage.setItem('flashnote:auth', JSON.stringify(createMockStoredAuth()));
      clearAuth();
      expect(sessionStorage.getItem('flashnote:auth')).toBeNull();
    });

    it('should not throw when storage is empty', () => {
      expect(() => clearAuth()).not.toThrow();
    });

    it('should not throw on storage error', () => {
      vi.mocked(sessionStorage.removeItem).mockImplementationOnce(() => {
        throw new Error('Storage error');
      });
      expect(() => clearAuth()).not.toThrow();
    });
  });
});
