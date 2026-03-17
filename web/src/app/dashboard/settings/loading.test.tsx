import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Loading from './loading';

describe('Settings Loading skeleton', () => {
  it('renders with role="status"', () => {
    render(<Loading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has aria-label="Loading settings"', () => {
    render(<Loading />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading settings');
  });

  it('uses animate-pulse class', () => {
    render(<Loading />);
    expect(screen.getByRole('status')).toHaveClass('animate-pulse');
  });

  it('renders sr-only loading text', () => {
    render(<Loading />);
    expect(screen.getByText('Loading settings')).toBeInTheDocument();
    expect(screen.getByText('Loading settings')).toHaveClass('sr-only');
  });

  it('does not render a Spinner component', () => {
    const { container } = render(<Loading />);
    // Spinner renders an element with role="status" and class containing "animate-spin"
    const spinners = container.querySelectorAll('.animate-spin');
    expect(spinners.length).toBe(0);
  });

  it('renders skeleton card placeholders', () => {
    const { container } = render(<Loading />);
    // Should have 3 card sections (Account Info, Change Password, Danger Zone)
    const cards = container.querySelectorAll('.card');
    expect(cards.length).toBe(3);
  });

  it('renders TopBar placeholder with skeleton block', () => {
    const { container } = render(<Loading />);
    // TopBar placeholder is the first sticky element
    const topBarPlaceholder = container.querySelector('.sticky');
    expect(topBarPlaceholder).toBeInTheDocument();
    const skeletonBlock = topBarPlaceholder?.querySelector('.h-7.w-40');
    expect(skeletonBlock).toBeInTheDocument();
  });

  it('uses responsive padding matching settings page', () => {
    render(<Loading />);
    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toHaveClass('p-4', 'sm:p-6');
  });
});
