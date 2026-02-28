import { NextRequest, NextResponse } from 'next/server';
import type { SessionEndReason } from '@/lib/types';

// ReadonlySet<string> so .has() accepts untrusted strings from URL params;
// satisfies ensures only valid SessionEndReason values are in the set.
const VALID_SESSION_END_REASONS: ReadonlySet<string> = new Set([
  'session_invalidated',
  'session_expired',
  'session_limit',
  'session_revoked',
] satisfies readonly SessionEndReason[]);

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const isDev = process.env.NODE_ENV === 'development';

  const cspDirectives = [
    `default-src 'self'`,
    // 'strict-dynamic' propagates trust from the nonced script to dynamically loaded scripts.
    // 'unsafe-eval' is required in dev for Next.js HMR/Fast Refresh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? ` 'unsafe-eval'` : ''}`,
    // Accepted risk: Tailwind CSS and Next.js generate inline style attributes
    // (font loading, image placeholders) that cannot use nonces without significant
    // build pipeline changes. Style injection is a very limited attack vector.
    `style-src 'self' 'unsafe-inline'`,
    `connect-src 'self'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ];

  const cspHeader = cspDirectives.join('; ');

  // Use Report-Only in dev to avoid breaking HMR, enforce in production
  const cspHeaderName = isDev
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  // Auth redirects — UX optimization only. The proxy runs on Node.js runtime but
  // intentionally avoids DB queries to stay fast. Real auth enforcement happens
  // in Server Components via getSession() (CLAUDE.md Rule 8).
  const sessionCookie = request.cookies.get('session_id');
  const hasSession = !!sessionCookie?.value;
  const pathname = request.nextUrl.pathname;

  // Redirect unauthenticated users away from /dashboard/*
  if (pathname.startsWith('/dashboard') && !hasSession) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.headers.set(cspHeaderName, cspHeader);
    return response;
  }

  // Redirect authenticated users away from /login and /signup — UNLESS the request
  // carries a valid session-end reason (e.g., ?reason=session_expired). That means the
  // dashboard layout detected an invalid session and redirected here. In that case
  // the cookie is stale: clear it and let the user through to the login page.
  // Only known SessionEndReason values are trusted — arbitrary query params are ignored
  // to prevent crafted URLs from clearing valid session cookies.
  if ((pathname === '/login' || pathname === '/signup') && hasSession) {
    const reason = request.nextUrl.searchParams.get('reason');
    if (reason && VALID_SESSION_END_REASONS.has(reason)) {
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });
      response.cookies.delete('session_id');
      response.headers.set(cspHeaderName, cspHeader);
      return response;
    }
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    response.headers.set(cspHeaderName, cspHeader);
    return response;
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

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
