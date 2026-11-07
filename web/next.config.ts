import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // The e2e suite runs its own `next dev` beside a developer's, and Next allows
  // only one dev server per build dir.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The dev-tools button sits over the sidebar's Sign out button, so e2e clicks
  // land on it. Turning it off leaves the dev error overlay in place.
  ...(process.env.DISABLE_DEV_INDICATORS === 'true' ? { devIndicators: false as const } : {}),
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
