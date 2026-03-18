import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

// Mock server-only (it throws in non-server contexts)
vi.mock('server-only', () => ({}));

// Mock config to avoid real env var parsing
vi.mock('./config', () => ({
  config: {
    DATABASE_URL: 'postgres://localhost:5432/flashnote_test',
  },
}));

// Mock pg to avoid real DB connections.
// vi.hoisted ensures these are available when the vi.mock factory executes
// (vi.mock calls are hoisted to the top of the file, before other declarations).
const { mockPool, MockPool } = vi.hoisted(() => {
  const mockPool = {
    on: vi.fn(),
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
  };
  // Must be a regular function (not an arrow function) so it can be used as a
  // constructor with `new`. The source does: const { Pool } = pg; new Pool(...)
  const MockPool = vi.fn(function () {
    return mockPool;
  });
  return { mockPool, MockPool };
});

vi.mock('pg', () => ({
  default: {
    Pool: MockPool,
  },
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
}));

vi.mock('@/server/lib/logger', () => ({ logger: mockLogger }));

describe('db/index', () => {
  const globalForDb = globalThis as unknown as { _flashnoteDb?: unknown };

  beforeEach(() => {
    vi.resetModules();
    delete globalForDb._flashnoteDb;
    mockPool.on.mockClear();
    mockPool.connect.mockClear();
    MockPool.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  it('exports db as a Pool instance', async () => {
    const { db } = await import('./index');
    expect(db).toBe(mockPool);
  });

  it('attaches an error handler to new pool', async () => {
    await import('./index');
    expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('logs pool creation on first import', async () => {
    await import('./index');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'database', poolSize: 20 }),
      'PostgreSQL connection pool created'
    );
  });

  it('caches pool on globalThis in non-production', async () => {
    await import('./index');
    expect(globalForDb._flashnoteDb).toBe(mockPool);
  });

  it('getPoolClient delegates to db.connect', async () => {
    const mockClient = { query: vi.fn(), release: vi.fn() };
    mockPool.connect.mockResolvedValueOnce(mockClient);

    const { getPoolClient } = await import('./index');
    const client = await getPoolClient();
    expect(client).toBe(mockClient);
    expect(mockPool.connect).toHaveBeenCalled();
  });

  it('does not call Pool constructor again when globalThis cache is populated', async () => {
    // First import — creates the pool and caches it
    await import('./index');
    expect(MockPool).toHaveBeenCalledTimes(1);
    expect(globalForDb._flashnoteDb).toBe(mockPool);

    // Simulate HMR: reset modules so the next import re-evaluates the module body
    vi.resetModules();

    // Re-register mocks so the freshly-evaluated module can find them.
    // Note: vi.mock() calls inside test bodies are NOT hoisted, but they are
    // registered synchronously before the await import() below.
    vi.mock('server-only', () => ({}));
    vi.mock('./config', () => ({
      config: { DATABASE_URL: 'postgres://localhost:5432/flashnote_test' },
    }));
    vi.mock('pg', () => ({
      default: { Pool: MockPool },
    }));

    // Second import re-evaluates the module. globalThis cache is still set,
    // so Pool constructor should NOT be called again.
    mockLogger.info.mockClear();
    const { db: db2 } = await import('./index');
    expect(db2).toBe(mockPool);
    expect(MockPool).toHaveBeenCalledTimes(1);
    // Startup log should NOT fire when pool comes from cache
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      expect.objectContaining({ source: 'database' }),
      expect.any(String)
    );
  });

  it('does not write pool to globalThis in production', async () => {
    vi.resetModules();

    vi.mock('server-only', () => ({}));
    vi.mock('./config', () => ({
      config: { DATABASE_URL: 'postgres://localhost:5432/flashnote_test' },
    }));
    vi.mock('pg', () => ({
      default: { Pool: MockPool },
    }));

    vi.stubEnv('NODE_ENV', 'production');
    try {
      await import('./index');
      expect(globalForDb._flashnoteDb).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('does not attach duplicate error handlers when globalThis cache is populated', async () => {
    // First import — attaches error handler once
    await import('./index');
    expect(mockPool.on).toHaveBeenCalledTimes(1);

    // Simulate HMR: reset modules so the next import re-evaluates the module body
    vi.resetModules();

    vi.mock('server-only', () => ({}));
    vi.mock('./config', () => ({
      config: { DATABASE_URL: 'postgres://localhost:5432/flashnote_test' },
    }));
    vi.mock('pg', () => ({
      default: { Pool: MockPool },
    }));

    // Second import reuses the cached pool — isNewPool is false, so on() is NOT called again
    await import('./index');
    expect(mockPool.on).toHaveBeenCalledTimes(1);
  });

  describe('graceful shutdown', () => {
    let processOnSpy: MockInstance;
    let processExitSpy: MockInstance;

    beforeEach(() => {
      processOnSpy = vi.spyOn(process, 'on');
      processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    });

    afterEach(() => {
      processOnSpy.mockRestore();
      processExitSpy.mockRestore();
      process.removeAllListeners('SIGTERM');
      process.removeAllListeners('SIGINT');
    });

    it('registers SIGTERM and SIGINT handlers on new pool', async () => {
      await import('./index');
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('does not register duplicate signal handlers when globalThis cache is populated', async () => {
      await import('./index');
      const sigTermCalls = processOnSpy.mock.calls.filter((call) => call[0] === 'SIGTERM');
      expect(sigTermCalls).toHaveLength(1);

      vi.resetModules();
      vi.mock('server-only', () => ({}));
      vi.mock('./config', () => ({
        config: { DATABASE_URL: 'postgres://localhost:5432/flashnote_test' },
      }));
      vi.mock('pg', () => ({
        default: { Pool: MockPool },
      }));

      // Restore the previous spy before creating a new one. Chaining
      // vi.spyOn() on an already-spied method (spy2 wrapping spy1) causes
      // Vitest to call process.on internally during spy installation, which
      // lands on spy2 and produces a phantom call in the assertion below.
      processOnSpy.mockRestore();
      processOnSpy = vi.spyOn(process, 'on');
      await import('./index');

      const sigTermCallsAfter = processOnSpy.mock.calls.filter((call) => call[0] === 'SIGTERM');
      expect(sigTermCallsAfter).toHaveLength(0);
    });

    it('calls pool.end() and exits with 0 on SIGTERM', async () => {
      mockPool.end = vi.fn().mockResolvedValueOnce(undefined);

      await import('./index');
      const sigTermHandler = processOnSpy.mock.calls.find((call) => call[0] === 'SIGTERM')?.[1] as () => void;
      expect(sigTermHandler).toBeDefined();

      sigTermHandler();

      // Allow the Promise chain to resolve
      await vi.waitFor(() => {
        expect(mockPool.end).toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(0);
      });
    });

    it('exits with 1 when pool.end() rejects', async () => {
      mockPool.end = vi.fn().mockRejectedValueOnce(new Error('drain failed'));

      await import('./index');
      const sigTermHandler = processOnSpy.mock.calls.find((call) => call[0] === 'SIGTERM')?.[1] as () => void;

      sigTermHandler();

      await vi.waitFor(() => {
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });
    });

    it('force-exits after timeout if pool.end() does not resolve', async () => {
      vi.useFakeTimers();

      // pool.end() never resolves
      mockPool.end = vi.fn().mockReturnValue(new Promise(() => {}));

      await import('./index');
      const sigTermHandler = processOnSpy.mock.calls.find((call) => call[0] === 'SIGTERM')?.[1] as () => void;

      sigTermHandler();

      // Advance past the shutdown timeout (5000ms)
      await vi.advanceTimersByTimeAsync(5000);

      expect(processExitSpy).toHaveBeenCalledWith(1);

      vi.useRealTimers();
    });

    it('handles SIGINT the same as SIGTERM', async () => {
      mockPool.end = vi.fn().mockResolvedValueOnce(undefined);

      await import('./index');
      const sigIntHandler = processOnSpy.mock.calls.find((call) => call[0] === 'SIGINT')?.[1] as () => void;
      expect(sigIntHandler).toBeDefined();

      sigIntHandler();

      await vi.waitFor(() => {
        expect(mockPool.end).toHaveBeenCalled();
        expect(processExitSpy).toHaveBeenCalledWith(0);
      });
    });

    it('ignores second signal if shutdown is already in progress', async () => {
      // pool.end() never resolves — keeps shutdown in progress
      mockPool.end = vi.fn().mockReturnValue(new Promise(() => {}));

      await import('./index');
      const sigTermHandler = processOnSpy.mock.calls.find((call) => call[0] === 'SIGTERM')?.[1] as () => void;
      const sigIntHandler = processOnSpy.mock.calls.find((call) => call[0] === 'SIGINT')?.[1] as () => void;

      sigTermHandler();
      sigIntHandler();

      // pool.end() should only be called once despite two signals
      expect(mockPool.end).toHaveBeenCalledTimes(1);
    });
  });
});
