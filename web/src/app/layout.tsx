import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FlashNote - AI SOAP Notes for Physical Therapists',
  description:
    'Generate professional PT documentation in seconds. Type shorthand, get complete SOAP notes ready for any EMR.',
  keywords: ['physical therapy', 'SOAP notes', 'PT documentation', 'AI', 'healthcare'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
