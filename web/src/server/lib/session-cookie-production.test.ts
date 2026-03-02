import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---
// These must be set up before the module under test is imported.
// Separate file required because module-level mocks are evaluated once per test module;
// the base session-cookie.test.ts mocks isProduction: false and cannot be overridden per-test.

const mockSet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: (...args: unknown[]) => mockSet(...args),
    get: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Mock config with isProduction: true — must use a separate file because
// module-level mocks are evaluated once; cannot override per-test in the same file.
vi.mock('@/server/db/config', () => ({
  isProduction: true,
  SESSION_COOKIE_MAX_AGE_SECONDS: 7 * 24 * 60 * 60,
}));

const { setSessionCookie } = await import('./session-cookie');

describe('session-cookie (production mode)', () => {
  beforeEach(() => {
    mockSet.mockReset();
  });

  it('sets secure: true in production mode (HTTPS enforcement)', async () => {
    await setSessionCookie('test-token');

    const options = mockSet.mock.calls[0][2] as Record<string, unknown>;
    expect(options.secure).toBe(true);
  });

  it('still sets httpOnly: true in production mode (XSS protection)', async () => {
    await setSessionCookie('test-token');

    const options = mockSet.mock.calls[0][2] as Record<string, unknown>;
    expect(options.httpOnly).toBe(true);
  });

  it('still sets sameSite: lax in production mode (CSRF protection)', async () => {
    await setSessionCookie('test-token');

    const options = mockSet.mock.calls[0][2] as Record<string, unknown>;
    expect(options.sameSite).toBe('lax');
  });
});
