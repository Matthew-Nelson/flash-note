import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('db/index', () => {
  const globalForDb = globalThis as unknown as { _flashnoteDb?: unknown };

  beforeEach(() => {
    vi.resetModules();
    delete globalForDb._flashnoteDb;
    mockPool.on.mockClear();
    mockPool.connect.mockClear();
    MockPool.mockClear();
  });

  it('exports db as a Pool instance', async () => {
    const { db } = await import('./index');
    expect(db).toBe(mockPool);
  });

  it('attaches an error handler to new pool', async () => {
    await import('./index');
    expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
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
    const { db: db2 } = await import('./index');
    expect(db2).toBe(mockPool);
    expect(MockPool).toHaveBeenCalledTimes(1);
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
});
