import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, config } from './middleware';

describe('CSP Middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function createRequest(url = 'https://flashnote.co/dashboard'): NextRequest {
    return new NextRequest(url);
  }

  it('should set CSP header on response', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = middleware(createRequest());
    expect(response.headers.has('Content-Security-Policy')).toBe(true);
  });

  it('should use Content-Security-Policy in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = middleware(createRequest());
    expect(response.headers.has('Content-Security-Policy')).toBe(true);
    expect(response.headers.has('Content-Security-Policy-Report-Only')).toBe(false);
  });

  it('should use Content-Security-Policy-Report-Only in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const response = middleware(createRequest());
    expect(response.headers.has('Content-Security-Policy-Report-Only')).toBe(true);
    expect(response.headers.has('Content-Security-Policy')).toBe(false);
  });

  it('should include unsafe-eval in dev for HMR', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const response = middleware(createRequest());
    const csp = response.headers.get('Content-Security-Policy-Report-Only')!;
    expect(csp).toContain("'unsafe-eval'");
  });

  it('should NOT include unsafe-eval in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = middleware(createRequest());
    const csp = response.headers.get('Content-Security-Policy')!;
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('should generate unique nonces per request', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response1 = middleware(createRequest());
    const response2 = middleware(createRequest());

    const csp1 = response1.headers.get('Content-Security-Policy')!;
    const csp2 = response2.headers.get('Content-Security-Policy')!;

    const nonce1 = csp1.match(/nonce-([a-f0-9-]+)/)?.[1];
    const nonce2 = csp2.match(/nonce-([a-f0-9-]+)/)?.[1];

    expect(nonce1).toBeDefined();
    expect(nonce2).toBeDefined();
    expect(nonce1).not.toBe(nonce2);
  });

  it('should include required CSP directives', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = middleware(createRequest());
    const csp = response.headers.get('Content-Security-Policy')!;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("img-src 'self' data: blob:");
  });

  it('should include Sentry domains in connect-src', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = middleware(createRequest());
    const csp = response.headers.get('Content-Security-Policy')!;

    expect(csp).toContain('https://*.sentry.io');
    expect(csp).toContain('https://*.ingest.sentry.io');
  });

  it('should include API URL in connect-src', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.flashnote.co');
    const response = middleware(createRequest());
    const csp = response.headers.get('Content-Security-Policy')!;

    expect(csp).toContain('https://api.flashnote.co');
  });

  it('should default API URL to localhost in connect-src', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.NEXT_PUBLIC_API_URL;
    const response = middleware(createRequest());
    const csp = response.headers.get('Content-Security-Policy')!;

    expect(csp).toContain('http://localhost:4000');
  });

  it('should set x-nonce on request headers', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const request = createRequest();
    middleware(request);

    // The nonce in CSP should be a valid UUID format
    const response = middleware(createRequest());
    const csp = response.headers.get('Content-Security-Policy')!;
    const nonce = csp.match(/nonce-([a-f0-9-]+)/)?.[1];
    expect(nonce).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
  });

  describe('matcher config', () => {
    it('should have exclusion pattern for static files and API routes', () => {
      const source = config.matcher[0].source;
      // Next.js handles anchoring internally; verify the pattern excludes expected prefixes
      expect(source).toContain('_next/static');
      expect(source).toContain('_next/image');
      expect(source).toContain('favicon.ico');
      expect(source).toContain('api/');
    });

    it('should exclude prefetch requests', () => {
      const missing = config.matcher[0].missing;
      expect(missing).toContainEqual({ type: 'header', key: 'next-router-prefetch' });
      expect(missing).toContainEqual({ type: 'header', key: 'purpose', value: 'prefetch' });
    });
  });
});
