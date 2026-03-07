import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Loading from './loading';

describe('Dashboard Loading skeleton', () => {
  it('renders skeleton placeholder elements (not Spinner)', () => {
    render(<Loading />);
    // Spinner would have role="status" or data-testid="spinner"; skeleton has neither
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
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
