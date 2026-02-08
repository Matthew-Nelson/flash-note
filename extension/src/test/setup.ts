/**
 * Global test setup for the extension package.
 *
 * Provides:
 * - DOM matchers (@testing-library/jest-dom)
 * - React cleanup after each test
 * - Mock: chrome global (storage.local, runtime.getManifest)
 * - Mock: @/shared/sentry
 * - Stub: VITE_API_URL, VITE_SENTRY_DSN, MODE env vars
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// React 19: RTL cleanup must be called manually
afterEach(() => {
  cleanup();
});

// Mock chrome global with Promise-based storage API
const chromeStore = new Map<string, unknown>();

const chromeMock = {
  storage: {
    local: {
      get: vi.fn((keys: string | string[]) => {
        const keyArr = typeof keys === 'string' ? [keys] : keys;
        const result: Record<string, unknown> = {};
        for (const key of keyArr) {
          const val = chromeStore.get(key);
          if (val !== undefined) result[key] = val;
        }
        return result;
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(items)) {
          chromeStore.set(key, value);
        }
      }),
      remove: vi.fn((keys: string | string[]) => {
        const keyArr = typeof keys === 'string' ? [keys] : keys;
        for (const key of keyArr) {
          chromeStore.delete(key);
        }
      }),
    },
  },
  runtime: {
    getManifest: vi.fn(() => ({ version: '0.1.0' })),
  },
};

Object.defineProperty(globalThis, 'chrome', {
  value: chromeMock,
  writable: true,
});

// Expose the backing store for direct test manipulation
export { chromeStore };

afterEach(() => {
  chromeStore.clear();
  vi.mocked(chromeMock.storage.local.get).mockClear();
  vi.mocked(chromeMock.storage.local.set).mockClear();
  vi.mocked(chromeMock.storage.local.remove).mockClear();
});

// Mock @/shared/sentry
vi.mock('@/shared/sentry', () => ({
  initSentry: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
}));

// Stub environment variables
vi.stubEnv('VITE_API_URL', 'http://localhost:4000');
vi.stubEnv('VITE_SENTRY_DSN', '');
vi.stubEnv('MODE', 'test');
