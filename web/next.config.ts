import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withSentryConfig(nextConfig, {
  org: 'flashnote',
  project: 'flashnote-web',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,
});
