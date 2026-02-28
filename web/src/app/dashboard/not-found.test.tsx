import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardNotFound from './not-found';

describe('DashboardNotFound', () => {
  it('renders 404 message', () => {
    render(<DashboardNotFound />);

    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByText(/doesn't exist or has been moved/)).toBeInTheDocument();
  });

  it('renders link to dashboard', () => {
    render(<DashboardNotFound />);

    const link = screen.getByText('Return to Dashboard');
    expect(link.closest('a')).toHaveAttribute('href', '/dashboard');
  });
});
