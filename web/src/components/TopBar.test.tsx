import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from './TopBar';

// Mock useSidebar context hook
const mockOpenSidebar = vi.hoisted(() => vi.fn());
vi.mock('./DashboardShell', () => ({
  useSidebar: () => ({ openSidebar: mockOpenSidebar }),
}));

describe('TopBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders h1 with title text', () => {
    render(<TopBar title="Dashboard" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders back button when backHref is provided', () => {
    render(<TopBar title="Settings" backHref="/dashboard" />);
    const backButton = screen.getByRole('link', { name: 'Go back' });
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute('href', '/dashboard');
  });

  it('does not render back button when backHref is not provided', () => {
    render(<TopBar title="Dashboard" />);
    expect(screen.queryByRole('link', { name: 'Go back' })).not.toBeInTheDocument();
  });

  it('renders children in right-side slot', () => {
    render(
      <TopBar title="Notes">
        <button>Export</button>
      </TopBar>
    );
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('hamburger button has aria-label="Open navigation menu"', () => {
    render(<TopBar title="Dashboard" />);
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument();
  });

  it('hamburger button has lg:hidden class', () => {
    render(<TopBar title="Dashboard" />);
    const hamburger = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(hamburger).toHaveClass('lg:hidden');
  });

  it('hamburger calls openSidebar on click', () => {
    render(<TopBar title="Dashboard" />);
    const hamburger = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(hamburger);
    expect(mockOpenSidebar).toHaveBeenCalledTimes(1);
  });

  it('renders as header element', () => {
    render(<TopBar title="Dashboard" />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
