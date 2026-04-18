/**
 * PHI-10 code-side prerequisite: DB pool TLS enforcement.
 *
 * Per Phase 4 CONTEXT D-10, the code-side half of PHI-10 (encryption-in-transit
 * for Postgres connections) ships in Plan 04-01. Ops-side verification (Cloud
 * Logging sink, Cloud SQL flag audit) is deferred to the deploy phase.
 *
 * This test asserts the pg.Pool config builder enforces TLS in production
 * unless the connection string signals a local/Cloud-SQL-proxy tunnel (which is
 * already encrypted by Google's managed proxy). Dev/test environments keep TLS
 * optional — local Postgres typically lacks a valid TLS cert.
 *
 * Strategy: mock the `./config` module so `@/server/db` can be imported under
 * arbitrary NODE_ENV / DATABASE_URL values without triggering the real
 * envSchema.parse() (which process.exit(1)s on validation failure).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mock state — the config values that `buildPoolConfig` will see.
const mockConfig = vi.hoisted(() => ({
  current: { DATABASE_URL: 'postgres://user:pass@localhost:5432/test' },
}));

vi.mock('@/server/db/config', () => ({
  get config() {
    return mockConfig.current;
  },
  isProduction: false,
  isDevelopment: false,
  isTest: true,
}));

describe('DB pool TLS configuration (PHI-10 code-side)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  // Next.js types declare NODE_ENV as readonly; cast to a writable shape for tests.
  const env = process.env as Record<string, string | undefined>;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
    vi.resetModules();
  });

  it('enforces ssl.rejectUnauthorized=true in production when DATABASE_URL has no sslmode', async () => {
    env.NODE_ENV = 'production';
    mockConfig.current = {
      DATABASE_URL: 'postgres://user:pass@db.example.com:5432/flashnote',
    };
    const { buildPoolConfig } = await import('@/server/db');
    const opts = buildPoolConfig();
    expect(opts.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('does NOT set ssl when DATABASE_URL already contains sslmode=require', async () => {
    env.NODE_ENV = 'production';
    mockConfig.current = {
      DATABASE_URL:
        'postgres://user:pass@db.example.com:5432/flashnote?sslmode=require',
    };
    const { buildPoolConfig } = await import('@/server/db');
    const opts = buildPoolConfig();
    expect(opts.ssl).toBeUndefined();
  });

  it('does NOT set ssl when DATABASE_URL contains sslmode=verify-full', async () => {
    env.NODE_ENV = 'production';
    mockConfig.current = {
      DATABASE_URL:
        'postgres://user:pass@db.example.com:5432/flashnote?sslmode=verify-full',
    };
    const { buildPoolConfig } = await import('@/server/db');
    const opts = buildPoolConfig();
    expect(opts.ssl).toBeUndefined();
  });

  it('does NOT set ssl for Cloud SQL Auth Proxy on 127.0.0.1', async () => {
    env.NODE_ENV = 'production';
    mockConfig.current = {
      DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/flashnote',
    };
    const { buildPoolConfig } = await import('@/server/db');
    const opts = buildPoolConfig();
    expect(opts.ssl).toBeUndefined();
  });

  it('does NOT set ssl for Cloud SQL Unix-socket tunnel (host=/cloudsql/)', async () => {
    env.NODE_ENV = 'production';
    mockConfig.current = {
      DATABASE_URL:
        'postgres://user:pass@/flashnote?host=/cloudsql/project:region:instance',
    };
    const { buildPoolConfig } = await import('@/server/db');
    const opts = buildPoolConfig();
    expect(opts.ssl).toBeUndefined();
  });

  it('does NOT set ssl in development mode', async () => {
    env.NODE_ENV = 'development';
    mockConfig.current = {
      DATABASE_URL: 'postgres://user:pass@db.example.com:5432/flashnote',
    };
    const { buildPoolConfig } = await import('@/server/db');
    const opts = buildPoolConfig();
    expect(opts.ssl).toBeUndefined();
  });

  it('does NOT set ssl in test mode', async () => {
    env.NODE_ENV = 'test';
    mockConfig.current = {
      DATABASE_URL: 'postgres://user:pass@db.example.com:5432/flashnote',
    };
    const { buildPoolConfig } = await import('@/server/db');
    const opts = buildPoolConfig();
    expect(opts.ssl).toBeUndefined();
  });

  it('exposes production-safe pool defaults (max, timeouts)', async () => {
    env.NODE_ENV = 'production';
    mockConfig.current = {
      DATABASE_URL: 'postgres://user:pass@db.example.com:5432/flashnote',
    };
    const { buildPoolConfig } = await import('@/server/db');
    const opts = buildPoolConfig();
    expect(opts.max).toBe(20);
    expect(opts.statement_timeout).toBe(30000);
    expect(opts.connectionTimeoutMillis).toBe(2000);
    expect(opts.idleTimeoutMillis).toBe(30000);
  });
});
