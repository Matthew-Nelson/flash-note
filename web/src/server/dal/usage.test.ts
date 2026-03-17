import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDbQuery, resetMocks, createMockOrgMemberRow, createMockOrgRow } from '@/test/dal-helpers';
import { getUsageForUser, incrementUsage } from './usage';

// Mock organization-members and organizations DAL modules
const mockFindActiveMembership = vi.hoisted(() => vi.fn());
const mockFindOrganizationById = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
}));

vi.mock('./organization-members', () => ({
  findActiveMembership: mockFindActiveMembership,
}));

vi.mock('./organizations', () => ({
  findOrganizationById: mockFindOrganizationById,
}));

vi.mock('@/server/lib/logger', () => ({ logger: mockLogger }));

describe('getUsageForUser', () => {
  beforeEach(() => {
    resetMocks();
    mockFindActiveMembership.mockReset();
    mockFindOrganizationById.mockReset();
  });

  it('returns notesGenerated: 0 when no usage row exists', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getUsageForUser('user-1', null);

    expect(result.notesGenerated).toBe(0);
    expect(result.organization).toBeNull();
    expect(result.currentMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns correct count when usage row exists', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ notes_generated: 42 }] });

    const result = await getUsageForUser('user-1', null);

    expect(result.notesGenerated).toBe(42);
  });

  it('resolves organization context when user has active membership', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ notes_generated: 10 }] });

    const mockMember = createMockOrgMemberRow({ organization_id: 'org-1', role: 'member' });
    mockFindActiveMembership.mockResolvedValueOnce({
      organizationId: mockMember.organization_id,
      role: mockMember.role,
      isBillable: mockMember.is_billable,
    });

    const mockOrg = createMockOrgRow({ id: 'org-1', name: 'Acme PT' });
    mockFindOrganizationById.mockResolvedValueOnce({
      id: mockOrg.id,
      name: mockOrg.name,
      maxSeats: mockOrg.max_seats,
      stripeCustomerId: mockOrg.stripe_customer_id,
      subscriptionId: mockOrg.subscription_id,
      subscriptionStatus: mockOrg.subscription_status,
      trialEndsAt: mockOrg.trial_ends_at,
      createdAt: mockOrg.created_at,
      updatedAt: mockOrg.updated_at,
    });

    const result = await getUsageForUser('user-1', 'org-1');

    expect(result.organization).toEqual({ name: 'Acme PT', role: 'member' });
    expect(mockFindActiveMembership).toHaveBeenCalledWith('user-1');
    expect(mockFindOrganizationById).toHaveBeenCalledWith('org-1');
  });

  it('returns organization: null when user has no org (organizationId is null)', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ notes_generated: 5 }] });

    const result = await getUsageForUser('user-1', null);

    expect(result.organization).toBeNull();
    expect(mockFindActiveMembership).not.toHaveBeenCalled();
    expect(mockFindOrganizationById).not.toHaveBeenCalled();
  });

  it('returns organization: null when membership is inactive (removed)', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ notes_generated: 3 }] });
    mockFindActiveMembership.mockResolvedValueOnce(null);

    const result = await getUsageForUser('user-1', 'org-1');

    expect(result.organization).toBeNull();
    expect(mockFindActiveMembership).toHaveBeenCalledWith('user-1');
    expect(mockFindOrganizationById).not.toHaveBeenCalled();
  });

  it('returns organization: null when organization is not found', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ notes_generated: 3 }] });
    mockFindActiveMembership.mockResolvedValueOnce({
      organizationId: 'org-deleted',
      role: 'member',
      isBillable: true,
    });
    mockFindOrganizationById.mockResolvedValueOnce(null);

    const result = await getUsageForUser('user-1', 'org-deleted');

    expect(result.organization).toBeNull();
  });

  it('queries usage with correct user ID and current month', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [] });

    await getUsageForUser('user-42', null);

    expect(mockDbQuery).toHaveBeenCalledWith(
      'SELECT notes_generated FROM usage WHERE user_id = $1 AND month = $2',
      ['user-42', expect.stringMatching(/^\d{4}-\d{2}$/)]
    );
  });
});

describe('incrementUsage', () => {
  beforeEach(() => {
    resetMocks();
    mockLogger.error.mockClear();
  });

  it('executes UPSERT with correct parameters', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [] });

    await incrementUsage('user-1', 100, 200);

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO usage'),
      ['user-1', expect.stringMatching(/^\d{4}-\d{2}$/), 100, 200]
    );
  });

  it('uses ON CONFLICT for atomic upsert', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [] });

    await incrementUsage('user-1', 50, 75);

    const sql = mockDbQuery.mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT (user_id, month)');
    expect(sql).toContain('DO UPDATE SET');
    expect(sql).toContain('notes_generated = usage.notes_generated + 1');
  });

  it('swallows errors without throwing', async () => {
    mockDbQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    // Should not throw
    await expect(incrementUsage('user-1', 100, 200)).resolves.toBeUndefined();

    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('logs structured context on failure (no PHI)', async () => {
    const dbError = new Error('connection refused');
    mockDbQuery.mockRejectedValueOnce(dbError);

    await incrementUsage('user-42', 10, 20);

    // Single logger.error call with structured context
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: dbError,
        source: 'dal_usage',
        errorType: 'usage_tracking_failed',
        userId: 'user-42',
      }),
      'Usage tracking failed'
    );
    // Should only be called once (not split across multiple calls)
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});
