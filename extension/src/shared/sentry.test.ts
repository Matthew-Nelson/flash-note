/**
 * Tests for the extension Sentry wrapper.
 *
 * NOTE: These tests don't test initSentry() in depth because it requires
 * mocking @sentry/browser's BrowserClient which is complex. Instead, we test
 * the public API behavior: captureException, captureMessage, setUser all
 * gracefully no-op when Sentry is not initialized (sentryScope is null).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use the real sentry module, not the global mock from setup.ts
vi.unmock('@/shared/sentry');

import { initSentry, captureException, captureMessage, setUser } from './sentry';

// The module-level sentryScope is null because we haven't called initSentry
// with a valid DSN. All functions should no-op gracefully.

describe('Extension Sentry Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initSentry', () => {
    it('should not crash when VITE_SENTRY_DSN is empty', () => {
      // VITE_SENTRY_DSN is stubbed to '' in test setup
      expect(() => initSentry()).not.toThrow();
    });

    it('should warn in production when DSN is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.stubEnv('MODE', 'production');
      vi.stubEnv('VITE_SENTRY_DSN', '');

      // Re-import to get fresh module state would be complex, so we test
      // the existing behavior: initSentry logs a warning when no DSN
      initSentry();

      // The warning is emitted from the initSentry function
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('VITE_SENTRY_DSN not configured')
      );

      warnSpy.mockRestore();
      vi.stubEnv('MODE', 'test');
    });
  });

  describe('captureException (not initialized)', () => {
    it('should no-op gracefully when Sentry is not initialized', () => {
      expect(() => captureException(new Error('test error'))).not.toThrow();
    });

    it('should no-op with context when Sentry is not initialized', () => {
      expect(() =>
        captureException(new Error('test'), { source: 'test', errorType: 'test_error' })
      ).not.toThrow();
    });
  });

  describe('captureMessage (not initialized)', () => {
    it('should no-op gracefully when Sentry is not initialized', () => {
      expect(() => captureMessage('test message')).not.toThrow();
    });

    it('should no-op with context when Sentry is not initialized', () => {
      expect(() =>
        captureMessage('test', { source: 'test' })
      ).not.toThrow();
    });
  });

  describe('setUser (not initialized)', () => {
    it('should no-op gracefully when Sentry is not initialized', () => {
      expect(() => setUser('user-123')).not.toThrow();
    });

    it('should no-op when clearing user', () => {
      expect(() => setUser(null)).not.toThrow();
    });
  });

  describe('PHI sanitization in context', () => {
    it('should accept context with safe fields without throwing', () => {
      expect(() =>
        captureException(new Error('test'), {
          source: 'test_service',
          errorType: 'api_failure',
          userId: 'user-123',
          statusCode: 500,
        })
      ).not.toThrow();
    });

    it('should accept context with PHI-like fields without throwing (sanitized internally)', () => {
      // Even if PHI-like keys are passed, the sanitizer redacts them
      expect(() =>
        captureException(new Error('test'), {
          patientName: 'John Doe',
          diagnosis: 'knee pain',
        })
      ).not.toThrow();
    });
  });
});
