import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
}));

vi.mock('@/server/lib/logger', () => ({
  logger: mockLogger,
}));

describe('instrumentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('onRequestError', () => {
    it('logs the error through Pino with source, err, routePath, and method', async () => {
      const { onRequestError } = await import('./instrumentation');

      const err = new Error('Test server error');
      const request = { method: 'GET', path: '/dashboard', headers: {} };
      const context = { routeType: 'page' as const, routePath: '/dashboard' };

      await onRequestError(err, request as never, context as never);

      expect(mockLogger.error).toHaveBeenCalledOnce();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err,
          source: 'next_server',
          errorType: 'page',
          routePath: '/dashboard',
          method: 'GET',
          url: '/dashboard',
        }),
        expect.stringContaining('Test server error')
      );
    });

    it('includes routeType in the log message prefix', async () => {
      const { onRequestError } = await import('./instrumentation');

      const err = new Error('API failure');
      const request = { method: 'POST', path: '/api/notes', headers: {} };
      const context = { routeType: 'app-route' as const, routePath: '/api/notes' };

      await onRequestError(err, request as never, context as never);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Object),
        '[app-route] API failure'
      );
    });
  });
});
