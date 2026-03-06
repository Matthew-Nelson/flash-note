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
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-fn-bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-2">
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
        <div className="card py-8 px-4 sm:px-10">
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
