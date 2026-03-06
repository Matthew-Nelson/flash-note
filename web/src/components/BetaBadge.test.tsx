import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BetaBadge } from './BetaBadge';

describe('BetaBadge', () => {
  it('renders BETA text', () => {
    render(<BetaBadge />);
    expect(screen.getByText('BETA')).toBeInTheDocument();
  });

  it('has expected CSS classes', () => {
    render(<BetaBadge />);
    const badge = screen.getByText('BETA');
    expect(badge).toHaveClass('rounded-full');
    expect(badge).toHaveClass('border');
    expect(badge).toHaveClass('border-fn-border');
    expect(badge).toHaveClass('text-fn-text-secondary');
  });
});
