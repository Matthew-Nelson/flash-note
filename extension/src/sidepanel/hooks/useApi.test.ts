import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApi } from './useApi';

describe('useApi', () => {
  describe('initial state', () => {
    it('should start with null data, null error, and isLoading false', () => {
      const mockFn = vi.fn();
      const { result } = renderHook(() => useApi(mockFn));
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('execute', () => {
    it('should set loading during execution', async () => {
      let resolve: (value: string) => void;
      const mockFn = vi.fn(() => new Promise<string>((r) => { resolve = r; }));
      const { result } = renderHook(() => useApi(mockFn));

      let executePromise: Promise<unknown>;
      act(() => {
        executePromise = result.current.execute();
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolve!('result');
        await executePromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should set data on success', async () => {
      const mockFn = vi.fn().mockResolvedValue('test-data');
      const { result } = renderHook(() => useApi(mockFn));

      await act(async () => {
        const returned = await result.current.execute();
        expect(returned).toBe('test-data');
      });

      expect(result.current.data).toBe('test-data');
      expect(result.current.error).toBeNull();
    });

    it('should set error on failure', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('API failed'));
      const { result } = renderHook(() => useApi(mockFn));

      await act(async () => {
        const returned = await result.current.execute();
        expect(returned).toBeNull();
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error!.message).toBe('API failed');
      expect(result.current.data).toBeNull();
    });

    it('should wrap non-Error rejections in Error', async () => {
      const mockFn = vi.fn().mockRejectedValue('string-error');
      const { result } = renderHook(() => useApi(mockFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error!.message).toBe('Unknown error');
    });

    it('should call onSuccess callback', async () => {
      const onSuccess = vi.fn();
      const mockFn = vi.fn().mockResolvedValue('data');
      const { result } = renderHook(() => useApi(mockFn, { onSuccess }));

      await act(async () => {
        await result.current.execute();
      });

      expect(onSuccess).toHaveBeenCalledWith('data');
    });

    it('should call onError callback', async () => {
      const onError = vi.fn();
      const mockFn = vi.fn().mockRejectedValue(new Error('fail'));
      const { result } = renderHook(() => useApi(mockFn, { onError }));

      await act(async () => {
        await result.current.execute();
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should pass arguments to the API function', async () => {
      const mockFn = vi.fn().mockResolvedValue('ok');
      const { result } = renderHook(() => useApi(mockFn));

      await act(async () => {
        await result.current.execute('arg1', 'arg2');
      });

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('reset', () => {
    it('should clear data, error, and loading', async () => {
      const mockFn = vi.fn().mockResolvedValue('data');
      const { result } = renderHook(() => useApi(mockFn));

      await act(async () => {
        await result.current.execute();
      });
      expect(result.current.data).toBe('data');

      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });
});
