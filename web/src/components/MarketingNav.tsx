'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BetaBadge } from './BetaBadge';

interface MarketingNavProps {
  showDashboardLink?: boolean;
}

export function MarketingNav({ showDashboardLink = false }: MarketingNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Escape key closes mobile drawer
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  return (
    <nav aria-label="Main" className="container mx-auto px-6 py-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold text-fn-primary">FlashNote</span>
          <BetaBadge />
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <div className="hidden md:flex items-center space-x-6">
          <Link
            href="/pricing"
            className="text-fn-text-secondary hover:text-fn-text-primary transition-colors"
          >
            Pricing
          </Link>
          {showDashboardLink ? (
            <Link
              href="/dashboard"
              className="text-fn-text-secondary hover:text-fn-text-primary transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-fn-text-secondary hover:text-fn-text-primary transition-colors"
              >
                Sign In
              </Link>
              <Link href="/signup" className="btn-primary px-4 py-2">
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Hamburger button — visible on mobile only */}
        <button
          aria-label="Open menu"
          onClick={() => setIsOpen(true)}
          className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center
                     rounded-fn-sm text-fn-text-secondary hover:bg-fn-bg-secondary transition-colors"
        >
          <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          role="presentation"
          aria-hidden="true"
          data-testid="menu-backdrop"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`fixed inset-y-0 right-0 z-40 w-64 bg-fn-bg-card border-l border-fn-border md:hidden
                   transition-transform duration-200 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-6">
          <button
            aria-label="Close menu"
            onClick={() => setIsOpen(false)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center
                       rounded-fn-sm text-fn-text-secondary hover:bg-fn-bg-secondary transition-colors"
          >
            <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="mt-6 space-y-4">
            <Link
              href="/pricing"
              onClick={() => setIsOpen(false)}
              className="block text-fn-text-secondary hover:text-fn-text-primary transition-colors py-2"
            >
              Pricing
            </Link>
            {showDashboardLink ? (
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="block text-fn-text-secondary hover:text-fn-text-primary transition-colors py-2"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="block text-fn-text-secondary hover:text-fn-text-primary transition-colors py-2"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setIsOpen(false)}
                  className="btn-primary block text-center px-4 py-2"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
