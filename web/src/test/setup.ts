/**
 * Global test setup for the web package.
 *
 * Provides:
 * - DOM matchers (@testing-library/jest-dom)
 * - React cleanup after each test
 * - Mock: @sentry/nextjs
 * - Mock: next/navigation
 * - Mock: sessionStorage (spy-able)
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// React 19: RTL cleanup must be called manually
afterEach(() => {
  cleanup();
});

// Mock @sentry/nextjs
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  withScope: vi.fn((cb: (scope: unknown) => void) => cb({ setExtras: vi.fn() })),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  redirect: vi.fn(),
}));

// Spy-able sessionStorage mock
const store = new Map<string, string>();

const sessionStorageMock: Storage = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
  removeItem: vi.fn((key: string) => { store.delete(key); }),
  clear: vi.fn(() => { store.clear(); }),
  get length() { return store.size; },
  key: vi.fn((index: number) => [...store.keys()][index] ?? null),
};

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Expose the backing store for test manipulation
export { store as sessionStorageStore };

afterEach(() => {
  store.clear();
  vi.mocked(sessionStorageMock.getItem).mockClear();
  vi.mocked(sessionStorageMock.setItem).mockClear();
  vi.mocked(sessionStorageMock.removeItem).mockClear();
});
