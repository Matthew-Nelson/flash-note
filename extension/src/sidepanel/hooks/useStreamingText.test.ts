import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStreamingText } from './useStreamingText';

describe('useStreamingText', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return empty text and isComplete=true for empty string', () => {
    const { result } = renderHook(() => useStreamingText(''));
    expect(result.current.displayedText).toBe('');
    expect(result.current.isComplete).toBe(true);
    expect(result.current.isStreaming).toBe(false);
  });

  it('should stream text character by character', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useStreamingText('ABC', { speed: 10 }));

    expect(result.current.displayedText).toBe('');
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.isComplete).toBe(false);

    act(() => { vi.advanceTimersByTime(10); });
    expect(result.current.displayedText).toBe('A');

    act(() => { vi.advanceTimersByTime(10); });
    expect(result.current.displayedText).toBe('AB');

    act(() => { vi.advanceTimersByTime(10); });
    expect(result.current.displayedText).toBe('ABC');

    // One more tick needed: the interval that finds index === text.length sets isComplete
    act(() => { vi.advanceTimersByTime(10); });
    expect(result.current.isComplete).toBe(true);
    expect(result.current.isStreaming).toBe(false);
  });

  it('should use custom speed parameter', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useStreamingText('Hi', { speed: 50 }));

    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current.displayedText).toBe('H');

    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current.displayedText).toBe('Hi');
  });

  it('should call onComplete callback when streaming finishes', () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    renderHook(() => useStreamingText('AB', { speed: 10, onComplete }));

    act(() => { vi.advanceTimersByTime(20); });
    // After 2 intervals: 'A', 'AB' displayed, then 3rd interval marks complete
    act(() => { vi.advanceTimersByTime(10); });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('should skipToEnd immediately', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useStreamingText('Hello World', { speed: 10 }));

    act(() => { vi.advanceTimersByTime(10); }); // Show 'H'
    expect(result.current.displayedText).toBe('H');

    act(() => { result.current.skipToEnd(); });
    expect(result.current.displayedText).toBe('Hello World');
    expect(result.current.isComplete).toBe(true);
    expect(result.current.isStreaming).toBe(false);
  });

  it('should restart animation when text changes', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ text }) => useStreamingText(text, { speed: 10 }),
      { initialProps: { text: 'AB' } }
    );

    act(() => { vi.advanceTimersByTime(20); });
    expect(result.current.displayedText).toBe('AB');

    rerender({ text: 'XY' });

    expect(result.current.displayedText).toBe('');
    expect(result.current.isComplete).toBe(false);

    act(() => { vi.advanceTimersByTime(10); });
    expect(result.current.displayedText).toBe('X');

    act(() => { vi.advanceTimersByTime(10); });
    expect(result.current.displayedText).toBe('XY');
  });

  it('should use default speed of 15ms', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useStreamingText('A'));

    act(() => { vi.advanceTimersByTime(15); });
    expect(result.current.displayedText).toBe('A');
  });

  it('should handle single character text', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useStreamingText('X', { speed: 10 }));

    act(() => { vi.advanceTimersByTime(10); });
    expect(result.current.displayedText).toBe('X');

    act(() => { vi.advanceTimersByTime(10); });
    expect(result.current.isComplete).toBe(true);
  });
});
