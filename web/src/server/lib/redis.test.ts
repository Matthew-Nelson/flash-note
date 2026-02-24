import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must mock config before importing redis.ts
vi.mock('@/server/db/config', () => ({
  config: {
    UPSTASH_REDIS_REST_URL: undefined,
    UPSTASH_REDIS_REST_TOKEN: undefined,
  },
  isProduction: false,
}));

// Mock @upstash/redis with a proper constructor
vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    url: string;
    token: string;
    constructor(opts: { url: string; token: string }) {
      this.url = opts.url;
      this.token = opts.token;
    }
  },
}));

describe('redis', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should return null when env vars are missing in dev/test', async () => {
    vi.doMock('@/server/db/config', () => ({
      config: {
        UPSTASH_REDIS_REST_URL: undefined,
        UPSTASH_REDIS_REST_TOKEN: undefined,
      },
      isProduction: false,
    }));

    const { redis } = await import('./redis');
    expect(redis).toBeNull();
  });

  it('should create Redis client when credentials are provided', async () => {
    vi.doMock('@/server/db/config', () => ({
      config: {
        UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'test-token',
      },
      isProduction: false,
    }));

    const { redis } = await import('./redis');
    expect(redis).not.toBeNull();
  });

  it('should call process.exit(1) in production without credentials', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.doMock('@/server/db/config', () => ({
      config: {
        UPSTASH_REDIS_REST_URL: undefined,
        UPSTASH_REDIS_REST_TOKEN: undefined,
      },
      isProduction: true,
    }));

    await import('./redis');

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });
});
