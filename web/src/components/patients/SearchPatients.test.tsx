import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  // shouldAdvanceTime: RTL's asyncWrapper drains through a setTimeout that only
  // advances under jest fake timers, so plain fake timers hang every userEvent call.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
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
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SearchPatients initialQuery="" />);
    const input = screen.getByRole('searchbox');
    await user.type(input, 'J');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    await user.type(input, 'a');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledTimes(1);
    expect(h.replace).toHaveBeenCalledWith(
      '/dashboard/patients?q=Ja',
      { scroll: false },
    );
  });

  it('removes q param when the input is cleared', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    h.searchParams = new URLSearchParams('q=existing');
    render(<SearchPatients initialQuery="existing" />);
    await user.clear(screen.getByRole('searchbox'));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledWith('/dashboard/patients', { scroll: false });
  });

  it('resets page param when search changes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    h.searchParams = new URLSearchParams('page=3');
    render(<SearchPatients initialQuery="" />);
    await user.type(screen.getByRole('searchbox'), 'Ja');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledWith('/dashboard/patients?q=Ja', { scroll: false });
  });

  // Focus-stability regression (UAT issue #3) — once the user types, the input
  // must remain focused across the debounced URL push and the Server
  // Component re-render (simulated here as a parent rerender with the new
  // `initialQuery` that mirrors what we just pushed).
  it('preserves focus and typed value when parent rerenders with echoed initialQuery', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<SearchPatients initialQuery="" />);
    const input = screen.getByRole<HTMLInputElement>('searchbox');
    await user.click(input);
    expect(document.activeElement).toBe(input);

    await user.type(input, 'Jan');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledWith('/dashboard/patients?q=Jan', { scroll: false });

    // Simulate the parent Server Component re-rendering with the new URL.
    act(() => {
      rerender(<SearchPatients initialQuery="Jan" />);
    });

    // Focus is preserved and value is intact.
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Jan');
  });

  it('user can keep typing while a previous debounce is in flight (no mid-type reset)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<SearchPatients initialQuery="" />);
    const input = screen.getByRole<HTMLInputElement>('searchbox');
    await user.click(input);

    // First char + fire debounce
    await user.type(input, 'J');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    // Parent rerenders with echoed initialQuery (Server Component did re-run).
    act(() => {
      rerender(<SearchPatients initialQuery="J" />);
    });

    // User keeps typing — value must not be reset to "J".
    await user.type(input, 'a');
    expect(input.value).toBe('Ja');
    expect(document.activeElement).toBe(input);
  });

  it('external URL change (navigation) DOES sync into the input', () => {
    const { rerender } = render(<SearchPatients initialQuery="" />);
    const input = screen.getByRole<HTMLInputElement>('searchbox');

    // External change (e.g. user clicked a "Clear search" link or used browser
    // back): initialQuery moves to a value we never pushed ourselves.
    act(() => {
      rerender(<SearchPatients initialQuery="external" />);
    });
    expect(input.value).toBe('external');
  });

  // Regression (PR #118 review A2): an edit that trims to the current term
  // (a trailing space) must not reset pagination or refetch the list.
  it('does not touch the URL when the trimmed term equals the current q', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    h.searchParams = new URLSearchParams('q=Jane&page=3');
    render(<SearchPatients initialQuery="Jane" />);
    await user.type(screen.getByRole('searchbox'), ' ');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).not.toHaveBeenCalled();
  });

  // Regression (PR #118 review A3): a debounce still pending when the URL
  // changes externally (back button, pagination link) must not fire and undo
  // that navigation.
  it('cancels a pending debounce when the URL changes externally', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<SearchPatients initialQuery="" />);
    const input = screen.getByRole<HTMLInputElement>('searchbox');
    await user.type(input, 'gait');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      rerender(<SearchPatients initialQuery="external" />);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).not.toHaveBeenCalled();
    expect(input.value).toBe('external');
  });

  // Regression (PR #118 review A1): the server truncates q to
  // MAX_SEARCH_LENGTH; without the same cap on the input, the truncated echo
  // reads as an external change and rewrites the input mid-typing.
  it('caps typed input at the server-side search bound', () => {
    render(<SearchPatients initialQuery="" />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('maxlength', '100');
  });

  // A term typed back to the URL's current q while our own replace is still in
  // flight (searchParams not yet updated) must still be pushed.
  it('pushes a term equal to the stale URL q when a different term is in flight', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    h.searchParams = new URLSearchParams('q=knee');
    render(<SearchPatients initialQuery="knee" />);
    const input = screen.getByRole('searchbox');
    await user.type(input, 'x');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    await user.type(input, '{Backspace}');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledTimes(2);
    expect(h.replace).toHaveBeenLastCalledWith('/dashboard/patients?q=knee', { scroll: false });
  });
});
