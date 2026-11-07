import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner, LoadingSpinner } from './Spinner';

describe('Spinner', () => {
  it('should render with role="status"', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should have aria-label "Loading"', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });

  it('should apply md size by default', () => {
    render(<Spinner />);
    const el = screen.getByRole('status');
    expect(el.className).toContain('w-6');
    expect(el.className).toContain('h-6');
  });

  it('should apply sm size', () => {
    render(<Spinner size="sm" />);
    const el = screen.getByRole('status');
    expect(el.className).toContain('w-4');
    expect(el.className).toContain('h-4');
  });

  it('should apply lg size', () => {
    render(<Spinner size="lg" />);
    const el = screen.getByRole('status');
    expect(el.className).toContain('w-8');
    expect(el.className).toContain('h-8');
  });

  it('should forward additional className', () => {
    render(<Spinner className="custom" />);
    expect(screen.getByRole('status').className).toContain('custom');
  });
});

describe('LoadingSpinner', () => {
  it('should render loading dots', () => {
    render(<LoadingSpinner />);
    const status = screen.getByRole('status');
    expect(status).toHaveClass('loading-spinner');
    // The dots are presentational spans with no role, so the class is the only handle.
    expect(status.querySelector('.loading-dots')).toBeInTheDocument();
  });

  it('should forward className', () => {
    render(<LoadingSpinner className="extra" />);
    expect(screen.getByRole('status')).toHaveClass('extra');
  });
});
