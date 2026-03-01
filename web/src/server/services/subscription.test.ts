import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkSubscriptionAccess } from './subscription';
import type { SessionData } from '@/server/types';

const mockGetOrgSubscription = vi.hoisted(() => vi.fn());

vi.mock('@/server/dal/organizations', () => ({
  getOrgSubscription: mockGetOrgSubscription,
}));

function createSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    email: 'test@example.com',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    emailVerified: true,
    organizationId: null,
    ...overrides,
  };
}

describe('checkSubscriptionAccess', () => {
  beforeEach(() => {
    mockGetOrgSubscription.mockReset();
  });

  it('allows active individual subscription', async () => {
    const result = await checkSubscriptionAccess(
      createSession({ subscriptionStatus: 'active' })
    );
    expect(result).toEqual({ allowed: true });
    expect(mockGetOrgSubscription).not.toHaveBeenCalled();
  });

  it('allows valid individual trial', async () => {
    const result = await checkSubscriptionAccess(
      createSession({
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
      })
    );
    expect(result).toEqual({ allowed: true });
  });

  it('denies expired individual trial (no org)', async () => {
    const result = await checkSubscriptionAccess(
      createSession({
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date(Date.now() - 1000), // expired
        organizationId: null,
      })
    );
    expect(result).toEqual({ allowed: false, reason: 'trial_expired' });
  });

  it('denies canceled subscription (no org)', async () => {
    const result = await checkSubscriptionAccess(
      createSession({
        subscriptionStatus: 'canceled',
        organizationId: null,
      })
    );
    expect(result).toEqual({ allowed: false, reason: 'subscription_required' });
  });

  it('falls back to org subscription when individual check fails', async () => {
    mockGetOrgSubscription.mockResolvedValueOnce({
      subscription_status: 'active',
      trial_ends_at: null,
    });

    const result = await checkSubscriptionAccess(
      createSession({
        subscriptionStatus: 'canceled',
        organizationId: 'org-1',
      })
    );

    expect(result).toEqual({ allowed: true });
    expect(mockGetOrgSubscription).toHaveBeenCalledWith('org-1', 'user-1');
  });

  it('allows org trial that is still valid', async () => {
    mockGetOrgSubscription.mockResolvedValueOnce({
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() + 1000 * 60 * 60),
    });

    const result = await checkSubscriptionAccess(
      createSession({
        subscriptionStatus: 'canceled',
        organizationId: 'org-1',
      })
    );

    expect(result).toEqual({ allowed: true });
  });

  it('denies when org subscription is lapsed', async () => {
    mockGetOrgSubscription.mockResolvedValueOnce({
      subscription_status: 'canceled',
      trial_ends_at: null,
    });

    const result = await checkSubscriptionAccess(
      createSession({
        subscriptionStatus: 'canceled',
        organizationId: 'org-1',
      })
    );

    expect(result).toEqual({ allowed: false, reason: 'clinic_subscription_expired' });
  });

  it('denies when org trial is expired', async () => {
    mockGetOrgSubscription.mockResolvedValueOnce({
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() - 1000),
    });

    const result = await checkSubscriptionAccess(
      createSession({
        subscriptionStatus: 'canceled',
        organizationId: 'org-1',
      })
    );

    expect(result).toEqual({ allowed: false, reason: 'clinic_subscription_expired' });
  });

  it('returns trial_expired when individual was trialing and org not found', async () => {
    mockGetOrgSubscription.mockResolvedValueOnce(null);

    const result = await checkSubscriptionAccess(
      createSession({
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date(Date.now() - 1000),
        organizationId: 'org-1',
      })
    );

    expect(result).toEqual({ allowed: false, reason: 'trial_expired' });
  });

  it('returns subscription_required when non-trialing and org not found', async () => {
    mockGetOrgSubscription.mockResolvedValueOnce(null);

    const result = await checkSubscriptionAccess(
      createSession({
        subscriptionStatus: 'past_due',
        organizationId: 'org-1',
      })
    );

    expect(result).toEqual({ allowed: false, reason: 'subscription_required' });
  });

  it('skips org lookup when organizationId is null', async () => {
    const result = await checkSubscriptionAccess(
      createSession({
        subscriptionStatus: 'canceled',
        organizationId: null,
      })
    );

    expect(result).toEqual({ allowed: false, reason: 'subscription_required' });
    expect(mockGetOrgSubscription).not.toHaveBeenCalled();
  });
});
