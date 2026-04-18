import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { usePhiCleanup } from './use-phi-cleanup';

// Hoisted mock so the vi.mock factory can reference it without TDZ issues.
const pathnameMock = vi.hoisted(() => vi.fn(() => '/dashboard'));

vi.mock('next/navigation', () => ({
  usePathname: pathnameMock,
}));

describe('usePhiCleanup', () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue('/dashboard');
  });

  it('does not call cleanup on initial mount', () => {
    const cleanup = vi.fn();
    renderHook(() => {
      const ref = useRef(cleanup);
      usePhiCleanup(ref);
    });
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('calls cleanup when pathname changes', () => {
    const cleanup = vi.fn();
    const { rerender } = renderHook(() => {
      const ref = useRef(cleanup);
      usePhiCleanup(ref);
    });
    expect(cleanup).not.toHaveBeenCalled();

    pathnameMock.mockReturnValue('/dashboard/patients');
    rerender();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not call cleanup when pathname is unchanged', () => {
    const cleanup = vi.fn();
    const { rerender } = renderHook(() => {
      const ref = useRef(cleanup);
      usePhiCleanup(ref);
    });
    rerender();
    rerender();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('calls cleanup on flashnote:logout event', () => {
    const cleanup = vi.fn();
    renderHook(() => {
      const ref = useRef(cleanup);
      usePhiCleanup(ref);
    });
    window.dispatchEvent(new Event('flashnote:logout'));
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('removes the logout listener on unmount', () => {
    const cleanup = vi.fn();
    const { unmount } = renderHook(() => {
      const ref = useRef(cleanup);
      usePhiCleanup(ref);
    });
    unmount();
    window.dispatchEvent(new Event('flashnote:logout'));
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('uses the latest cleanup ref without re-subscribing the effect', () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    const { rerender } = renderHook(
      ({ fn }: { fn: () => void }) => {
        const ref = useRef(fn);
        ref.current = fn; // caller updates the ref in place
        usePhiCleanup(ref);
      },
      { initialProps: { fn: cleanup1 } }
    );

    rerender({ fn: cleanup2 });
    window.dispatchEvent(new Event('flashnote:logout'));
    expect(cleanup2).toHaveBeenCalledTimes(1);
    expect(cleanup1).not.toHaveBeenCalled();
  });

  it('fires cleanup on each subsequent pathname change', () => {
    const cleanup = vi.fn();
    const { rerender } = renderHook(() => {
      const ref = useRef(cleanup);
      usePhiCleanup(ref);
    });

    pathnameMock.mockReturnValue('/dashboard/notes');
    rerender();
    pathnameMock.mockReturnValue('/dashboard');
    rerender();
    pathnameMock.mockReturnValue('/dashboard/settings');
    rerender();

    expect(cleanup).toHaveBeenCalledTimes(3);
  });

  it('fires cleanup on both pathname change AND logout event independently', () => {
    const cleanup = vi.fn();
    const { rerender } = renderHook(() => {
      const ref = useRef(cleanup);
      usePhiCleanup(ref);
    });

    pathnameMock.mockReturnValue('/dashboard/patients');
    rerender();
    expect(cleanup).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('flashnote:logout'));
    expect(cleanup).toHaveBeenCalledTimes(2);
  });
});
