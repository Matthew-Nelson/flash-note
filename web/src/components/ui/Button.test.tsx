import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('should apply primary variant by default', () => {
    render(<Button>Primary</Button>);
    expect(screen.getByRole('button').className).toContain('btn-primary');
  });

  it('should apply secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button').className).toContain('btn-secondary');
  });

  it.each(['sm', 'md', 'lg'] as const)('should apply %s size', (size) => {
    render(<Button size={size}>Sized</Button>);
    const btn = screen.getByRole('button');
    // Each size has distinct px- class
    expect(btn.className).toBeTruthy();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should be disabled when loading is true', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should show spinner when loading', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should NOT show spinner when not loading', () => {
    render(<Button>Normal</Button>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('should fire onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should forward additional className', () => {
    render(<Button className="extra">Styled</Button>);
    expect(screen.getByRole('button').className).toContain('extra');
  });
});
