import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
  pathname: '/dashboard/patients',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: h.replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => h.pathname,
  useSearchParams: () => h.searchParams,
}));

import { SearchPatients } from './SearchPatients';

describe('SearchPatients', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.replace.mockReset();
    h.searchParams = new URLSearchParams();
    h.pathname = '/dashboard/patients';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a labelled search input', () => {
    render(<SearchPatients initialQuery="" />);
    expect(
      screen.getByRole('searchbox', { name: /search patients by name/i }),
    ).toBeInTheDocument();
  });

  it('debounces URL updates by 250ms', async () => {
    render(<SearchPatients initialQuery="" />);
    const input = screen.getByRole('searchbox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'J' } });
      vi.advanceTimersByTime(100);
      fireEvent.change(input, { target: { value: 'Ja' } });
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledTimes(1);
    expect(h.replace).toHaveBeenCalledWith(
      '/dashboard/patients?q=Ja',
      { scroll: false },
    );
  });

  it('removes q param when the input is cleared', async () => {
    h.searchParams = new URLSearchParams('q=existing');
    render(<SearchPatients initialQuery="existing" />);
    const input = screen.getByRole('searchbox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: '' } });
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledWith('/dashboard/patients', { scroll: false });
  });

  it('resets page param when search changes', async () => {
    h.searchParams = new URLSearchParams('page=3');
    render(<SearchPatients initialQuery="" />);
    const input = screen.getByRole('searchbox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Ja' } });
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledWith('/dashboard/patients?q=Ja', { scroll: false });
  });

  // Focus-stability regression (UAT issue #3) — once the user types, the input
  // must remain focused across the debounced URL push and the Server
  // Component re-render (simulated here as a parent rerender with the new
  // `initialQuery` that mirrors what we just pushed).
  it('preserves focus and typed value when parent rerenders with echoed initialQuery', async () => {
    const { rerender } = render(<SearchPatients initialQuery="" />);
    const input = screen.getByRole<HTMLInputElement>('searchbox');
    input.focus();
    expect(document.activeElement).toBe(input);

    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Jan' } });
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledWith('/dashboard/patients?q=Jan', { scroll: false });

    // Simulate the parent Server Component re-rendering with the new URL.
    await act(async () => { await Promise.resolve();
      rerender(<SearchPatients initialQuery="Jan" />);
    });

    // Focus is preserved and value is intact.
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Jan');
  });

  it('user can keep typing while a previous debounce is in flight (no mid-type reset)', async () => {
    const { rerender } = render(<SearchPatients initialQuery="" />);
    const input = screen.getByRole<HTMLInputElement>('searchbox');
    input.focus();

    // First char + fire debounce
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'J' } });
      vi.advanceTimersByTime(250);
    });
    // Parent rerenders with echoed initialQuery (Server Component did re-run).
    await act(async () => { await Promise.resolve();
      rerender(<SearchPatients initialQuery="J" />);
    });

    // User keeps typing — value must not be reset to "J".
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Ja' } });
    });
    expect(input.value).toBe('Ja');
    expect(document.activeElement).toBe(input);
  });

  it('external URL change (navigation) DOES sync into the input', async () => {
    const { rerender } = render(<SearchPatients initialQuery="" />);
    const input = screen.getByRole<HTMLInputElement>('searchbox');

    // External change (e.g. user clicked a "Clear search" link or used browser
    // back): initialQuery moves to a value we never pushed ourselves.
    await act(async () => { await Promise.resolve();
      rerender(<SearchPatients initialQuery="external" />);
    });
    expect(input.value).toBe('external');
  });
});
