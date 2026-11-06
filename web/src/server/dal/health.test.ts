import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockDbQuery, resetMocks } from '@/test/dal-helpers';
import { checkDbHealth } from './health';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
}));

vi.mock('@/server/lib/logger', () => ({ logger: mockLogger }));

describe('checkDbHealth', () => {
  beforeEach(() => {
    resetMocks();
    mockLogger.error.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when the database answers SELECT 1', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    await expect(checkDbHealth()).resolves.toBe(true);

    expect(mockDbQuery).toHaveBeenCalledExactlyOnceWith('SELECT 1');
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('returns false and logs at error level when the query rejects', async () => {
    const connErr = new Error('ECONNREFUSED');
    mockDbQuery.mockRejectedValueOnce(connErr);

    await expect(checkDbHealth()).resolves.toBe(false);

    expect(mockLogger.error).toHaveBeenCalledExactlyOnceWith(
      { err: connErr, source: 'dal_health', errorType: 'health_check_failed' },
      'DB health check failed',
    );
  });

  it('wraps a non-Error rejection in an Error before logging', async () => {
    mockDbQuery.mockRejectedValueOnce('socket hang up');

    await expect(checkDbHealth()).resolves.toBe(false);

    const [context] = mockLogger.error.mock.calls[0] as [{ err: unknown }];
    expect(context.err).toBeInstanceOf(Error);
    expect((context.err as Error).message).toBe('socket hang up');
  });

  it('returns false after 3 seconds when the database never responds', async () => {
    vi.useFakeTimers();
    mockDbQuery.mockReturnValueOnce(new Promise(() => {})); // hangs forever

    const result = checkDbHealth();

    await vi.advanceTimersByTimeAsync(2999);
    expect(mockLogger.error).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe(false);

    const [context] = mockLogger.error.mock.calls[0] as [{ err: Error }];
    expect(context.err.message).toBe('DB health check timed out');
  });
});
