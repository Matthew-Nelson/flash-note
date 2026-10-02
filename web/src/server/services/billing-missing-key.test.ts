import { describe, it, expect, vi } from 'vitest';

// Separate file: the config mock must omit STRIPE_SECRET_KEY, which the main
// billing.test.ts provides at module scope.
vi.mock('@/server/db/config', () => ({
  config: {
    STRIPE_SECRET_KEY: undefined,
    STRIPE_WEBHOOK_SECRET: 'whsec_test_mock',
    WEB_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/server/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
vi.mock('@/server/dal/users', () => ({}));
vi.mock('@/server/dal/webhooks', () => ({}));
vi.mock('@/server/services/audit', () => ({ auditService: { log: vi.fn() } }));

const { getBillingService, BillingError } = await import('./billing');

describe('getBillingService without STRIPE_SECRET_KEY', () => {
  it('throws BillingError(missing_stripe_key) on first use', () => {
    let caught: unknown;
    try {
      getBillingService();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BillingError);
    expect((caught as InstanceType<typeof BillingError>).code).toBe('missing_stripe_key');
  });

  it('does not cache a failed construction — every call keeps failing closed', () => {
    expect(() => getBillingService()).toThrow(BillingError);
    expect(() => getBillingService()).toThrow(BillingError);
  });
});
