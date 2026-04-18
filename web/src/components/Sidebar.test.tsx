import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';

// Mock usePathname
const mockUsePathname = vi.hoisted(() => vi.fn<() => string>());
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

// Mock LogoutButton
vi.mock('@/components/auth', () => ({
  LogoutButton: () => <button>Sign out</button>,
}));

const defaultUser = { email: 'therapist@example.com' };

function renderSidebar(
  props: { isOpen?: boolean; onClose?: () => void; user?: { email: string } } = {}
) {
  const { isOpen = false, onClose = vi.fn(), user = defaultUser } = props;
  return render(<Sidebar user={user} isOpen={isOpen} onClose={onClose} />);
}

describe('Sidebar', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/dashboard');
  });

  it('has aria-label="Main navigation" on nav element', () => {
    renderSidebar();
    // Desktop nav is always rendered
    const navs = screen.getAllByRole('navigation', { name: 'Main navigation' });
    expect(navs.length).toBeGreaterThan(0);
  });

  it('renders FlashNote logo text', () => {
    renderSidebar();
    expect(screen.getAllByText('FlashNote').length).toBeGreaterThan(0);
  });

  it('renders "New Note" CTA link to /dashboard/notes/new', () => {
    renderSidebar();
    const links = screen.getAllByRole('link', { name: /new note/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/dashboard/notes/new');
  });

  it('renders Dashboard nav item', () => {
    renderSidebar();
    const links = screen.getAllByRole('link', { name: 'Dashboard' });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/dashboard');
  });

  it('renders Notes nav item', () => {
    renderSidebar();
    expect(screen.getAllByRole('link', { name: /notes/i }).length).toBeGreaterThan(0);
  });

  it('renders Patients nav item', () => {
    renderSidebar();
    expect(screen.getAllByRole('link', { name: /patients/i }).length).toBeGreaterThan(0);
  });

  it('Patients nav item no longer shows "Soon" badge (Plan 04-02)', () => {
    renderSidebar();
    const links = screen.getAllByRole('link', { name: /patients/i });
    // The accessible name for a link with a child "Soon" badge would include it.
    // Assert no link with accessible name "Patients Soon" exists.
    const matchesSoon = links.filter((l) => /soon/i.test(l.textContent ?? ''));
    expect(matchesSoon).toHaveLength(0);
  });

  it('Patients nav item sets aria-current when on /dashboard/patients', () => {
    mockUsePathname.mockReturnValue('/dashboard/patients');
    renderSidebar();
    const allLinks = screen.getAllByRole('link');
    const patientsLink = allLinks.find(
      (l) => l.getAttribute('href') === '/dashboard/patients',
    );
    expect(patientsLink).toHaveAttribute('aria-current', 'page');
  });

  it('Patients nav item sets aria-current when on /dashboard/patients/[id]', () => {
    mockUsePathname.mockReturnValue('/dashboard/patients/abc123');
    renderSidebar();
    const allLinks = screen.getAllByRole('link');
    const patientsLink = allLinks.find(
      (l) => l.getAttribute('href') === '/dashboard/patients',
    );
    expect(patientsLink).toHaveAttribute('aria-current', 'page');
  });

  it('renders Templates nav item', () => {
    renderSidebar();
    expect(screen.getAllByRole('link', { name: /templates/i }).length).toBeGreaterThan(0);
  });

  it('renders Settings nav item', () => {
    renderSidebar();
    const links = screen.getAllByRole('link', { name: 'Settings' });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/dashboard/settings');
  });

  it('marks Dashboard as active when on /dashboard', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    renderSidebar();
    const dashboardLinks = screen.getAllByRole('link', { name: 'Dashboard' });
    expect(dashboardLinks[0]).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark Dashboard active on /dashboard/notes', () => {
    mockUsePathname.mockReturnValue('/dashboard/notes');
    renderSidebar();
    const dashboardLinks = screen.getAllByRole('link', { name: 'Dashboard' });
    expect(dashboardLinks[0]).not.toHaveAttribute('aria-current', 'page');
  });

  it('marks Notes active when on /dashboard/notes/new', () => {
    mockUsePathname.mockReturnValue('/dashboard/notes/new');
    renderSidebar();
    // Find the Notes link (href=/dashboard/notes)
    const allLinks = screen.getAllByRole('link');
    const notesLink = allLinks.find(
      (l) => l.getAttribute('href') === '/dashboard/notes'
    );
    expect(notesLink).toHaveAttribute('aria-current', 'page');
  });

  it('renders user email in footer', () => {
    renderSidebar({ user: { email: 'jane@clinic.com' } });
    expect(screen.getAllByText('jane@clinic.com').length).toBeGreaterThan(0);
  });

  it('renders initials avatar with first character of email uppercased', () => {
    renderSidebar({ user: { email: 'therapist@example.com' } });
    // "T" from "therapist@..."
    expect(screen.getAllByText('T').length).toBeGreaterThan(0);
  });

  it('renders LogoutButton in user footer area', () => {
    renderSidebar();
    expect(screen.getAllByText('Sign out').length).toBeGreaterThan(0);
  });

  it('renders backdrop when isOpen is true', () => {
    renderSidebar({ isOpen: true });
    const backdrop = document.querySelector('[aria-hidden="true"].fixed.inset-0');
    expect(backdrop).toBeInTheDocument();
  });

  it('does not render backdrop when isOpen is false', () => {
    renderSidebar({ isOpen: false });
    const backdrop = document.querySelector('.fixed.inset-0.z-30');
    expect(backdrop).not.toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    renderSidebar({ isOpen: true, onClose });
    const backdrop = document.querySelector('[aria-hidden="true"].fixed.inset-0');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key when open', () => {
    const onClose = vi.fn();
    renderSidebar({ isOpen: true, onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose on Escape key when closed', () => {
    const onClose = vi.fn();
    renderSidebar({ isOpen: false, onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('NavItem links have min-h-[44px] for touch target compliance', () => {
    renderSidebar();
    const dashboardLinks = screen.getAllByRole('link', { name: 'Dashboard' });
    expect(dashboardLinks[0].className).toContain('min-h-[44px]');
  });

  it('New Note CTA has min-h-[44px] for touch target compliance', () => {
    renderSidebar();
    const newNoteLinks = screen.getAllByRole('link', { name: /new note/i });
    expect(newNoteLinks[0].className).toContain('min-h-[44px]');
  });
});
