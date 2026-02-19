import { NextRequest, NextResponse } from 'next/server';

/**
 * CSP Middleware
 *
 * Adds Content-Security-Policy header with per-request nonces for script security.
 *
 * NOTE on server-side route protection (M-11):
 * Auth tokens live in sessionStorage (client-side only). Server-side Next.js
 * middleware cannot access sessionStorage, so true server-side route protection
 * requires migrating to httpOnly cookies — out of scope for this PR.
 * Route protection remains client-side via ProtectedRoute, with the backend
 * as the real authorization enforcement (per Rule 8).
 */
export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const isDev = process.env.NODE_ENV === 'development';

  // API URL for connect-src (backend calls from the browser)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const cspDirectives = [
    `default-src 'self'`,
    // 'strict-dynamic' propagates trust from the nonced script to dynamically loaded scripts.
    // 'unsafe-eval' is required in dev for Next.js HMR/Fast Refresh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? ` 'unsafe-eval'` : ''}`,
    // Accepted risk: Tailwind CSS and Next.js generate inline style attributes
    // (font loading, image placeholders) that cannot use nonces without significant
    // build pipeline changes. Style injection is a very limited attack vector.
    `style-src 'self' 'unsafe-inline'`,
    `connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io ${apiUrl}`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ];

  const cspHeader = cspDirectives.join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Use Report-Only in dev to avoid breaking HMR, enforce in production
  const cspHeaderName = isDev
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';

  response.headers.set(cspHeaderName, cspHeader);

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files, images, and API routes
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|api/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
