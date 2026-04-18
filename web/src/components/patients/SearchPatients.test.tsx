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
    expect(h.replace).toHaveBeenCalledWith('/dashboard/patients');
  });

  it('resets page param when search changes', async () => {
    h.searchParams = new URLSearchParams('page=3');
    render(<SearchPatients initialQuery="" />);
    const input = screen.getByRole('searchbox');
    await act(async () => { await Promise.resolve();
      fireEvent.change(input, { target: { value: 'Ja' } });
      vi.advanceTimersByTime(250);
    });
    expect(h.replace).toHaveBeenCalledWith('/dashboard/patients?q=Ja');
  });
});
