'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from '@/components/auth';

interface SidebarProps {
  user: { email: string };
  isOpen: boolean;
  onClose: () => void;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(href + '/');
}

function NavItem({
  href,
  label,
  pathname,
  comingSoon = false,
}: {
  href: string;
  label: string;
  pathname: string;
  comingSoon?: boolean;
}) {
  const active = isActive(pathname, href);
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className="flex items-center gap-3 px-3 py-2 rounded-fn-sm text-fn-sm font-medium
                   text-fn-sidebar-text hover:bg-fn-sidebar-hover transition-colors
                   aria-[current=page]:bg-fn-sidebar-active aria-[current=page]:text-fn-sidebar-text-active"
      >
        {label}
        {comingSoon && (
          <span className="text-fn-2xs text-fn-sidebar-text opacity-60 ml-auto">
            Soon
          </span>
        )}
      </Link>
    </li>
  );
}

function SidebarContent({
  user,
  onClose,
}: {
  user: { email: string };
  onClose: () => void;
}) {
  const pathname = usePathname();
  const initial = user.email.charAt(0).toUpperCase();

  return (
    <nav
      aria-label="Main navigation"
      className="w-fn-sidebar bg-fn-sidebar-bg flex flex-col flex-shrink-0 h-full"
    >
      {/* Logo header */}
      <div className="p-5 pb-4 flex items-center gap-2.5">
        <div className="w-8 h-8 bg-fn-primary-DEFAULT rounded-fn-base flex items-center justify-center">
          <svg
            aria-hidden="true"
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <span className="text-fn-lg font-bold text-fn-sidebar-text-active tracking-fn-tight">
          FlashNote
        </span>
      </div>

      {/* New Note CTA */}
      <div className="px-3 pb-4">
        <Link
          href="/dashboard/notes/new"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-fn-base
                     bg-fn-primary-DEFAULT text-white text-fn-sm font-semibold
                     hover:bg-fn-primary-hover transition-colors"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Note
        </Link>
      </div>

      {/* CORE section */}
      <div className="px-5 py-2">
        <span className="text-fn-2xs font-semibold text-fn-sidebar-text uppercase tracking-fn-wider">
          Core
        </span>
      </div>
      <ul className="px-3 space-y-1 mb-2">
        <NavItem href="/dashboard" label="Dashboard" pathname={pathname} />
        <NavItem
          href="/dashboard/notes"
          label="Notes"
          pathname={pathname}
          comingSoon
        />
        <NavItem
          href="/dashboard/patients"
          label="Patients"
          pathname={pathname}
          comingSoon
        />
      </ul>

      {/* MANAGE section */}
      <div className="px-5 py-2">
        <span className="text-fn-2xs font-semibold text-fn-sidebar-text uppercase tracking-fn-wider">
          Manage
        </span>
      </div>
      <ul className="px-3 space-y-1 flex-1">
        <NavItem
          href="/dashboard/templates"
          label="Templates"
          pathname={pathname}
          comingSoon
        />
        <NavItem href="/dashboard/settings" label="Settings" pathname={pathname} />
      </ul>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div
            className="w-8 h-8 rounded-full bg-fn-primary-DEFAULT flex items-center justify-center
                          text-white text-fn-xs font-semibold flex-shrink-0"
            aria-hidden="true"
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-fn-sm text-fn-sidebar-text-active truncate">{user.email}</p>
          </div>
        </div>
        <LogoutButton />
      </div>
    </nav>
  );
}

export function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  // Escape key closes mobile drawer
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Desktop sidebar — always visible at lg+ */}
      <div className="hidden lg:flex">
        <SidebarContent user={user} onClose={onClose} />
      </div>

      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-40 lg:hidden transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent user={user} onClose={onClose} />
      </div>
    </>
  );
}
