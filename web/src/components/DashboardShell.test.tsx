import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardShell, useSidebar } from './DashboardShell';

// Mock Sidebar to isolate DashboardShell tests
const mockOnClose = vi.hoisted(() => vi.fn());
vi.mock('./Sidebar', () => ({
  Sidebar: ({
    user,
    isOpen,
    onClose,
  }: {
    user: { email: string };
    isOpen: boolean;
    onClose: () => void;
  }) => (
    <div
      data-testid="sidebar"
      data-email={user.email}
      data-open={isOpen}
      onClick={onClose}
    />
  ),
}));

// A child component that reads the sidebar context
function ContextReader() {
  const { openSidebar } = useSidebar();
  return (
    <button data-testid="open-btn" onClick={openSidebar}>
      Open
    </button>
  );
}

describe('DashboardShell', () => {
  it('renders children', () => {
    render(
      <DashboardShell user={{ email: 'test@example.com' }}>
        <div>Child content</div>
      </DashboardShell>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders Sidebar with user email', () => {
    render(
      <DashboardShell user={{ email: 'jane@clinic.com' }}>
        <div>content</div>
      </DashboardShell>
    );
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toHaveAttribute('data-email', 'jane@clinic.com');
  });

  it('provides SidebarContext — children can read openSidebar', () => {
    render(
      <DashboardShell user={{ email: 'test@example.com' }}>
        <ContextReader />
      </DashboardShell>
    );
    expect(screen.getByTestId('open-btn')).toBeInTheDocument();
  });

  it('openSidebar sets sidebar to open state', () => {
    render(
      <DashboardShell user={{ email: 'test@example.com' }}>
        <ContextReader />
      </DashboardShell>
    );

    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toHaveAttribute('data-open', 'false');

    fireEvent.click(screen.getByTestId('open-btn'));

    expect(sidebar).toHaveAttribute('data-open', 'true');
  });

  it('onClose sets sidebar to closed state', () => {
    render(
      <DashboardShell user={{ email: 'test@example.com' }}>
        <ContextReader />
      </DashboardShell>
    );

    const sidebar = screen.getByTestId('sidebar');
    // First open
    fireEvent.click(screen.getByTestId('open-btn'));
    expect(sidebar).toHaveAttribute('data-open', 'true');

    // Close via sidebar's onClick (which calls onClose)
    fireEvent.click(sidebar);
    expect(sidebar).toHaveAttribute('data-open', 'false');
  });
});
