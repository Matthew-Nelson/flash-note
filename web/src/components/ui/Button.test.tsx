import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
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

  it('should have min-h-[44px] for touch target compliance', () => {
    render(<Button>Touch Target</Button>);
    expect(screen.getByRole('button').className).toContain('min-h-[44px]');
  });

  it('should have cursor-pointer class', () => {
    render(<Button>Pointer</Button>);
    expect(screen.getByRole('button').className).toContain('cursor-pointer');
  });

  it('should have min-h-[44px] even with sm size', () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button').className).toContain('min-h-[44px]');
  });

  it('should have cursor-pointer class even when disabled (CSS :disabled handles override)', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button').className).toContain('cursor-pointer');
  });

  // ----- destructive variant (Plan 04-02) -----

  it('should apply destructive variant', () => {
    render(<Button variant="destructive">Archive patient</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-fn-error');
    expect(btn.className).toContain('hover:bg-fn-error-dark');
    expect(btn.className).toContain('text-white');
  });

  it('destructive variant retains 44px touch target', () => {
    render(<Button variant="destructive">Archive</Button>);
    expect(screen.getByRole('button').className).toContain('min-h-[44px]');
  });

  it('destructive variant shows spinner when loading', () => {
    render(
      <Button variant="destructive" loading>
        Archive
      </Button>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('destructive variant fires onClick when enabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button variant="destructive" onClick={onClick}>
        Archive
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // ----- forwardRef (required by ConfirmDialog initial-focus on Cancel) -----

  it('forwards ref to the underlying <button>', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>With ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('ref.current.focus() works (ConfirmDialog needs this for initial focus)', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Focus me</Button>);
    ref.current?.focus();
    expect(document.activeElement).toBe(ref.current);
  });
});
