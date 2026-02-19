import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Inter } from 'next/font/google';
import Providers from '@/components/Providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FlashNote - AI SOAP Notes for Physical Therapists',
  description:
    'Generate professional PT documentation in seconds. Type shorthand, get complete SOAP notes ready for any EMR.',
  keywords: ['physical therapy', 'SOAP notes', 'PT documentation', 'AI', 'healthcare'],
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reading headers forces dynamic rendering, which is required for per-request
  // CSP nonces. Next.js reads x-nonce from request headers and automatically
  // applies it to all script tags it generates.
  await headers();

  return (
    <html lang="en">
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-fn-bg-primary focus:text-fn-accent-primary focus:font-medium focus:underline"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
