import Link from 'next/link';
import { type ReactNode } from 'react';

interface AuthLayoutProps {
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, footer, children }: AuthLayoutProps) {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-fn-bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      {/* Subtle brand bar at the top */}
      <div aria-hidden="true" className="absolute top-0 left-0 right-0 h-1 bg-fn-primary" />
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-2">
          <div aria-hidden="true" className="w-8 h-8 bg-fn-primary rounded-fn-base flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-3xl font-bold text-fn-primary">FlashNote</span>
          <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-fn-border text-fn-text-secondary">BETA</span>
        </Link>
        {title && (
          <h1 className="mt-4 text-center text-2xl font-bold text-fn-text-primary">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="mt-2 text-center text-sm text-fn-text-secondary">
            {subtitle}
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card py-8 px-4 sm:px-10 shadow-fn-lg">
          {children}
        </div>
        {footer && (
          <div className="mt-6 text-center">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
