import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
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

  // Auth redirect: redirect unauthenticated users away from /dashboard/*.
  // This is a UX optimization only — middleware runs on Edge Runtime and cannot
  // query the DB. Real auth enforcement happens in Server Components via
  // getSession() (CLAUDE.md Rule 8).
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const sessionCookie = request.cookies.get('session_id');
    if (!sessionCookie?.value) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.headers.set(cspHeaderName, cspHeader);
      return response;
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

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
