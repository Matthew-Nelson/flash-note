import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
  pathname: '/dashboard/notes',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: h.replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => h.pathname,
  useSearchParams: () => h.searchParams,
}));

import { SearchNotes } from './SearchNotes';

describe('SearchNotes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.replace.mockReset();
    h.searchParams = new URLSearchParams();
    h.pathname = '/dashboard/notes';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a labelled search input (Rule 11)', () => {
    render(<SearchNotes initialQuery="" />);
    expect(
      screen.getByRole('searchbox', { name: 'Search notes' }),
    ).toBeInTheDocument();
  });

  // Regression: the control had three different names (visible label,
  // placeholder, aria-label). The visible label must be the accessible name.
  it('takes its accessible name from the visible label, with no aria-label', () => {
    render(<SearchNotes initialQuery="" />);
    const input = screen.getByRole('searchbox');
    expect(input).not.toHaveAttribute('aria-label');
    expect(screen.getByText('Search notes').tagName).toBe('LABEL');
  });

  it('caps typed input at the server-side search bound', () => {
    render(<SearchNotes initialQuery="" />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('maxlength', '100');
  });

  // Rule 13: the region must be in the DOM before its content changes.
  it('renders a persistent status region that is empty when idle', () => {
    render(<SearchNotes initialQuery="" />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toBeEmptyDOMElement();
  });

  it('debounces URL updates by 250ms', async () => {
    render(<SearchNotes initialQuery="" />);
    const input = screen.getByRole('searchbox');
    await act(async () => {
      await Promise.resolve();
      fireEvent.change(input, { target: { value: 'k' } });
      vi.advanceTimersByTime(100);
      fireEvent.change(input, { target: { value: 'knee' } });
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledTimes(1);
    expect(h.replace).toHaveBeenCalledWith('/dashboard/notes?q=knee', {
      scroll: false,
    });
  });

  it('removes the q param when the input is cleared', async () => {
    h.searchParams = new URLSearchParams('q=knee');
    render(<SearchNotes initialQuery="knee" />);
    const input = screen.getByRole('searchbox');
    await act(async () => {
      await Promise.resolve();
      fireEvent.change(input, { target: { value: '' } });
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledWith('/dashboard/notes', { scroll: false });
  });

  it('resets pagination when the search changes', async () => {
    h.searchParams = new URLSearchParams('page=3');
    render(<SearchNotes initialQuery="" />);
    const input = screen.getByRole('searchbox');
    await act(async () => {
      await Promise.resolve();
      fireEvent.change(input, { target: { value: 'knee' } });
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledWith('/dashboard/notes?q=knee', {
      scroll: false,
    });
  });

  it('preserves other filters already in the URL', async () => {
    h.searchParams = new URLSearchParams('noteType=initial_eval');
    render(<SearchNotes initialQuery="" />);
    const input = screen.getByRole('searchbox');
    await act(async () => {
      await Promise.resolve();
      fireEvent.change(input, { target: { value: 'knee' } });
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledWith(
      '/dashboard/notes?noteType=initial_eval&q=knee',
      { scroll: false },
    );
  });

  it('preserves focus and typed value when the parent echoes initialQuery back', async () => {
    const { rerender } = render(<SearchNotes initialQuery="" />);
    const input = screen.getByRole<HTMLInputElement>('searchbox');
    input.focus();

    await act(async () => {
      await Promise.resolve();
      fireEvent.change(input, { target: { value: 'gait' } });
      vi.advanceTimersByTime(250);
    });

    await act(async () => {
      await Promise.resolve();
      rerender(<SearchNotes initialQuery="gait" />);
    });

    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('gait');
  });

  it('syncs an external URL change (back button) into the input', async () => {
    const { rerender } = render(<SearchNotes initialQuery="" />);
    const input = screen.getByRole<HTMLInputElement>('searchbox');
    await act(async () => {
      await Promise.resolve();
      rerender(<SearchNotes initialQuery="external" />);
    });
    expect(input.value).toBe('external');
  });

  // Regression (PR #118 review A2): an edit that trims to the current term
  // (a trailing space) must not reset pagination or refetch the list.
  it('does not touch the URL when the trimmed term equals the current q', async () => {
    h.searchParams = new URLSearchParams('q=knee&page=3');
    render(<SearchNotes initialQuery="knee" />);
    const input = screen.getByRole('searchbox');
    await act(async () => {
      await Promise.resolve();
      fireEvent.change(input, { target: { value: 'knee ' } });
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).not.toHaveBeenCalled();
  });

  // Regression (PR #118 review A3): a debounce still pending when the URL
  // changes externally (back button, pagination link) must not fire and undo
  // that navigation.
  it('cancels a pending debounce when the URL changes externally', async () => {
    const { rerender } = render(<SearchNotes initialQuery="" />);
    const input = screen.getByRole<HTMLInputElement>('searchbox');
    await act(async () => {
      await Promise.resolve();
      fireEvent.change(input, { target: { value: 'gait' } });
      vi.advanceTimersByTime(100);
    });
    await act(async () => {
      await Promise.resolve();
      rerender(<SearchNotes initialQuery="external" />);
    });
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).not.toHaveBeenCalled();
    expect(input.value).toBe('external');
  });

  // A term typed back to the URL's current q while our own replace is still in
  // flight (searchParams not yet updated) must still be pushed.
  it('pushes a term equal to the stale URL q when a different term is in flight', async () => {
    h.searchParams = new URLSearchParams('q=knee');
    render(<SearchNotes initialQuery="knee" />);
    const input = screen.getByRole('searchbox');
    await act(async () => {
      await Promise.resolve();
      fireEvent.change(input, { target: { value: 'kneex' } });
      vi.advanceTimersByTime(250);
    });
    await act(async () => {
      await Promise.resolve();
      fireEvent.change(input, { target: { value: 'knee' } });
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledTimes(2);
    expect(h.replace).toHaveBeenLastCalledWith('/dashboard/notes?q=knee', { scroll: false });
  });
});
