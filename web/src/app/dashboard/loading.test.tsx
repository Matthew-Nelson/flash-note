import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Loading from './loading';

describe('Dashboard Loading skeleton', () => {
  it('renders skeleton with accessible loading status (not Spinner)', () => {
    render(<Loading />);
    // Skeleton uses role="status" for screen reader announcement, but not the Spinner component
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading dashboard');
    expect(screen.getByText('Loading dashboard')).toBeInTheDocument();
  });

  it('has animate-pulse class on wrapper', () => {
    const { container } = render(<Loading />);
    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('animate-pulse');
  });

  it('renders 6 skeleton placeholder blocks (banner, 2 KPI, CTA, 2 quick actions)', () => {
    const { container } = render(<Loading />);
    // All skeleton divs have bg-fn-bg-secondary
    const skeletonBlocks = container.querySelectorAll('.bg-fn-bg-secondary');
    expect(skeletonBlocks).toHaveLength(6);
  });
});
