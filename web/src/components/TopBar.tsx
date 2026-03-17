'use client';

import Link from 'next/link';
import { useSidebar } from './DashboardShell';

interface TopBarProps {
  title: string;
  backHref?: string;
  children?: React.ReactNode;
}

export function TopBar({ title, backHref, children }: TopBarProps) {
  const { openSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-fn-border bg-fn-bg-card">
      <div className="flex items-center gap-3">
        {/* Hamburger — visible on mobile only */}
        <button
          aria-label="Open navigation menu"
          onClick={openSidebar}
          className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center
                     rounded-fn-sm text-fn-text-secondary hover:bg-fn-bg-secondary transition-colors"
        >
          <svg
            aria-hidden="true"
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Back button — optional */}
        {backHref && (
          <Link
            href={backHref}
            aria-label="Go back"
            className="w-[44px] h-[44px] flex items-center justify-center
                       rounded-fn-sm text-fn-text-secondary hover:bg-fn-bg-secondary transition-colors"
          >
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
        )}

        <h1 className="text-fn-xl font-bold text-fn-text-primary tracking-fn-tight">
          {title}
        </h1>
      </div>

      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </header>
  );
}
