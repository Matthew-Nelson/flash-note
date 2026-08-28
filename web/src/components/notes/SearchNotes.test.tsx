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
      screen.getByRole('searchbox', { name: /search notes by content/i }),
    ).toBeInTheDocument();
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
});
