import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, config } from './middleware';

describe('Middleware', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function createRequest(
    url = 'https://flashnote.co/dashboard',
    options?: { cookies?: Record<string, string> }
  ): NextRequest {
    const headers = new Headers();
    if (options?.cookies) {
      const cookieString = Object.entries(options.cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
      headers.set('Cookie', cookieString);
    }
    return new NextRequest(url, { headers });
  }

  describe('CSP headers', () => {
    it('should set CSP header on response', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(createRequest('https://flashnote.co/'));
      expect(response.headers.has('Content-Security-Policy')).toBe(true);
    });

    it('should use Content-Security-Policy in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(createRequest('https://flashnote.co/'));
      expect(response.headers.has('Content-Security-Policy')).toBe(true);
      expect(response.headers.has('Content-Security-Policy-Report-Only')).toBe(false);
    });

    it('should use Content-Security-Policy-Report-Only in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const response = middleware(createRequest('https://flashnote.co/'));
      expect(response.headers.has('Content-Security-Policy-Report-Only')).toBe(true);
      expect(response.headers.has('Content-Security-Policy')).toBe(false);
    });

    it('should include unsafe-eval in dev for HMR', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const response = middleware(createRequest('https://flashnote.co/'));
      const csp = response.headers.get('Content-Security-Policy-Report-Only')!;
      expect(csp).toContain("'unsafe-eval'");
    });

    it('should NOT include unsafe-eval in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(createRequest('https://flashnote.co/'));
      const csp = response.headers.get('Content-Security-Policy')!;
      expect(csp).not.toContain("'unsafe-eval'");
    });

    it('should generate unique nonces per request', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response1 = middleware(createRequest('https://flashnote.co/'));
      const response2 = middleware(createRequest('https://flashnote.co/'));

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
      const response = middleware(createRequest('https://flashnote.co/'));
      const csp = response.headers.get('Content-Security-Policy')!;

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("'strict-dynamic'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("font-src 'self'");
      expect(csp).toContain("img-src 'self' data: blob:");
    });

    it('should set x-nonce on request headers as a valid UUID', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(createRequest('https://flashnote.co/'));
      const csp = response.headers.get('Content-Security-Policy')!;
      const nonce = csp.match(/nonce-([a-f0-9-]+)/)?.[1];
      expect(nonce).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    });
  });

  describe('auth redirect', () => {
    it('redirects /dashboard to /login when no session_id cookie', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(createRequest('https://flashnote.co/dashboard'));
      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('https://flashnote.co/login');
    });

    it('redirects /dashboard/settings to /login when no cookie', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(createRequest('https://flashnote.co/dashboard/settings'));
      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('https://flashnote.co/login');
    });

    it('does NOT redirect /dashboard when session_id cookie present', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(
        createRequest('https://flashnote.co/dashboard', { cookies: { session_id: 'abc123' } })
      );
      expect(response.status).not.toBe(307);
      expect(response.headers.has('Content-Security-Policy')).toBe(true);
    });

    it('does NOT redirect public routes without cookie', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const publicRoutes = ['/', '/pricing', '/terms', '/privacy', '/baa', '/forgot-password'];
      for (const route of publicRoutes) {
        const response = middleware(createRequest(`https://flashnote.co${route}`));
        expect(response.status).not.toBe(307);
      }
    });

    it('redirects /login to /dashboard when session_id cookie present', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(
        createRequest('https://flashnote.co/login', { cookies: { session_id: 'abc123' } })
      );
      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('https://flashnote.co/dashboard');
    });

    it('redirects /signup to /dashboard when session_id cookie present', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(
        createRequest('https://flashnote.co/signup', { cookies: { session_id: 'abc123' } })
      );
      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('https://flashnote.co/dashboard');
    });

    it('does NOT redirect /login when no session_id cookie', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(createRequest('https://flashnote.co/login'));
      expect(response.status).not.toBe(307);
    });

    it('does NOT redirect /signup when no session_id cookie', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(createRequest('https://flashnote.co/signup'));
      expect(response.status).not.toBe(307);
    });

    it('sets CSP headers on authenticated redirect from /login', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(
        createRequest('https://flashnote.co/login', { cookies: { session_id: 'abc123' } })
      );
      expect(response.status).toBe(307);
      expect(response.headers.has('Content-Security-Policy')).toBe(true);
    });

    it('clears stale cookie and allows /login when ?reason param present with cookie', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(
        createRequest('https://flashnote.co/login?reason=session_expired', { cookies: { session_id: 'stale-token' } })
      );
      // Should NOT redirect — allows the login page to render
      expect(response.status).not.toBe(307);
      // Should delete the stale cookie
      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('session_id');
      expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
    });

    it('sets CSP headers when clearing stale cookie on /login with reason', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(
        createRequest('https://flashnote.co/login?reason=session_expired', { cookies: { session_id: 'stale-token' } })
      );
      expect(response.headers.has('Content-Security-Policy')).toBe(true);
    });

    it('does NOT clear cookie for invalid ?reason values — redirects to /dashboard', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(
        createRequest('https://flashnote.co/login?reason=anything', { cookies: { session_id: 'valid-token' } })
      );
      // Invalid reason: should redirect to /dashboard, not clear the cookie
      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('https://flashnote.co/dashboard');
    });

    it('does NOT clear cookie for empty ?reason value — redirects to /dashboard', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(
        createRequest('https://flashnote.co/login?reason=', { cookies: { session_id: 'valid-token' } })
      );
      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('https://flashnote.co/dashboard');
    });

    it('does NOT redirect /login with empty session_id cookie', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(
        createRequest('https://flashnote.co/login', { cookies: { session_id: '' } })
      );
      expect(response.status).not.toBe(307);
    });

    it('sets CSP headers on redirected responses', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(createRequest('https://flashnote.co/dashboard'));
      expect(response.status).toBe(307);
      expect(response.headers.has('Content-Security-Policy')).toBe(true);
    });

    it('sets CSP headers on dashboard responses when cookie present', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(
        createRequest('https://flashnote.co/dashboard', { cookies: { session_id: 'abc123' } })
      );
      expect(response.headers.has('Content-Security-Policy')).toBe(true);
    });

    it('redirects when session_id cookie exists but is empty', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const response = middleware(
        createRequest('https://flashnote.co/dashboard', { cookies: { session_id: '' } })
      );
      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('https://flashnote.co/login');
    });
  });

  describe('matcher config', () => {
    it('should have exclusion pattern for static files and API routes', () => {
      const source = config.matcher[0].source;
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
