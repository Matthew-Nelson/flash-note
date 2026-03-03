import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers — must be declared before imports that trigger the mock factory
const mockGet = vi.fn<(name: string) => string | null>();

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (name: string): string | null => mockGet(name),
  }),
}));

// Mock config — start with Cloud Run default (TRUSTED_PROXY_COUNT=1)
const mockConfig = { TRUSTED_PROXY_COUNT: 1 };

vi.mock('@/server/db/config', () => ({
  config: mockConfig,
}));

const { getRequestContext } = await import('./request-context');

describe('getRequestContext', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockConfig.TRUSTED_PROXY_COUNT = 1;
  });

  describe('x-forwarded-for extraction with TRUSTED_PROXY_COUNT=1 (Cloud Run default)', () => {
    it('returns the second-to-last IP when header has two IPs (real + lb)', async () => {
      mockGet.mockImplementation((name) => {
        if (name === 'x-forwarded-for') return '1.2.3.4, 35.191.0.1';
        return null;
      });

      const ctx = await getRequestContext();
      expect(ctx.ipAddress).toBe('1.2.3.4');
    });

    it('ignores client-supplied fake IPs — uses real IP (second-to-last)', async () => {
      mockGet.mockImplementation((name) => {
        if (name === 'x-forwarded-for') return '10.0.0.1, 1.2.3.4, 35.191.0.1';
        return null;
      });

      const ctx = await getRequestContext();
      expect(ctx.ipAddress).toBe('1.2.3.4');
    });

    it('ignores multiple client-supplied fakes — still returns second-to-last', async () => {
      mockGet.mockImplementation((name) => {
        if (name === 'x-forwarded-for') return '10.0.0.1, 10.0.0.2, 1.2.3.4, 35.191.0.1';
        return null;
      });

      const ctx = await getRequestContext();
      expect(ctx.ipAddress).toBe('1.2.3.4');
    });

    it('falls back to rightmost when only one IP in header (index would go negative)', async () => {
      // parts.length=1, targetIndex=max(0, 1-1-1)=max(0,-1)=0 → parts[0]
      mockGet.mockImplementation((name) => {
        if (name === 'x-forwarded-for') return '1.2.3.4';
        return null;
      });

      const ctx = await getRequestContext();
      expect(ctx.ipAddress).toBe('1.2.3.4');
    });

    it('trims whitespace from each IP part', async () => {
      mockGet.mockImplementation((name) => {
        if (name === 'x-forwarded-for') return '  1.2.3.4  ,  35.191.0.1  ';
        return null;
      });

      const ctx = await getRequestContext();
      expect(ctx.ipAddress).toBe('1.2.3.4');
    });

    it('returns undefined ipAddress when x-forwarded-for is absent and x-real-ip is absent', async () => {
      mockGet.mockReturnValue(null);

      const ctx = await getRequestContext();
      expect(ctx.ipAddress).toBeUndefined();
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
      mockGet.mockImplementation((name) => {
        if (name === 'x-real-ip') return '1.2.3.4';
        return null;
      });

      const ctx = await getRequestContext();
      expect(ctx.ipAddress).toBe('1.2.3.4');
    });

    it('returns undefined ipAddress when extracted IP is invalid after extraction', async () => {
      // "not-an-ip, 35.191.0.1" with TRUSTED_PROXY_COUNT=1 → parts[0]="not-an-ip"
      // sanitizeIpAddress("not-an-ip") → null → undefined
      mockGet.mockImplementation((name) => {
        if (name === 'x-forwarded-for') return 'not-an-ip, 35.191.0.1';
        return null;
      });

      const ctx = await getRequestContext();
      expect(ctx.ipAddress).toBeUndefined();
    });

    it('includes user-agent from request headers', async () => {
      mockGet.mockImplementation((name) => {
        if (name === 'x-forwarded-for') return '1.2.3.4, 35.191.0.1';
        if (name === 'user-agent') return 'Mozilla/5.0 TestBrowser';
        return null;
      });

      const ctx = await getRequestContext();
      expect(ctx.userAgent).toBe('Mozilla/5.0 TestBrowser');
    });

    it('sets userAgent to undefined when user-agent header is absent', async () => {
      mockGet.mockImplementation((name) => {
        if (name === 'x-forwarded-for') return '1.2.3.4, 35.191.0.1';
        return null;
      });

      const ctx = await getRequestContext();
      expect(ctx.userAgent).toBeUndefined();
    });
  });

  describe('TRUSTED_PROXY_COUNT=0 (local dev, no proxy chain)', () => {
    beforeEach(() => {
      mockConfig.TRUSTED_PROXY_COUNT = 0;
    });

    it('returns the rightmost (only) IP when TRUSTED_PROXY_COUNT=0 and single IP', async () => {
      // "1.2.3.4" → targetIndex=max(0, 1-1-0)=0 → "1.2.3.4"
      mockGet.mockImplementation((name) => {
        if (name === 'x-forwarded-for') return '1.2.3.4';
        return null;
      });

      const ctx = await getRequestContext();
      expect(ctx.ipAddress).toBe('1.2.3.4');
    });

    it('returns the rightmost IP when TRUSTED_PROXY_COUNT=0 and multiple IPs', async () => {
      // "10.0.0.1, 10.0.0.2, 1.2.3.4" → targetIndex=max(0, 3-1-0)=2 → "1.2.3.4"
      mockGet.mockImplementation((name) => {
        if (name === 'x-forwarded-for') return '10.0.0.1, 10.0.0.2, 1.2.3.4';
        return null;
      });

      const ctx = await getRequestContext();
      expect(ctx.ipAddress).toBe('1.2.3.4');
    });
  });
});
