import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock session-cookie module
const mockGetSessionToken = vi.fn<() => Promise<string | null>>();
const mockHashSessionToken = vi.fn<(token: string) => string>();

vi.mock('./session-cookie', () => ({
  getSessionToken: () => mockGetSessionToken(),
  hashSessionToken: (token: string) => mockHashSessionToken(token),
}));

// Mock session DAL
const mockFindSessionByTokenHash = vi.fn();
const mockRefreshSessionExpiry = vi.fn();

vi.mock('@/server/dal/sessions', () => ({
  findSessionByTokenHash: (...args: unknown[]): unknown => mockFindSessionByTokenHash(...args),
  refreshSessionExpiry: (...args: unknown[]): unknown => mockRefreshSessionExpiry(...args),
}));

// Mock config with known values
vi.mock('@/server/db/config', () => ({
  SESSION_IDLE_TTL_MS: 24 * 60 * 60 * 1000,        // 24 hours
  SESSION_ABSOLUTE_MAX_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  SESSION_REFRESH_THRESHOLD: 0.5,
}));

const { getSession } = await import('./get-session');

const SESSION_IDLE_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_ABSOLUTE_MAX_MS = 7 * 24 * 60 * 60 * 1000;

function createMockSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-uuid',
    user_id: 'user-uuid',
    token_hash: 'hashed-token',
    expires_at: new Date(Date.now() + SESSION_IDLE_TTL_MS),
    created_at: new Date(),
    ip_address: '127.0.0.1',
    user_agent: 'TestAgent/1.0',
    email: 'test@example.com',
    subscription_status: 'trialing' as const,
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    email_verified: true,
    organization_id: null,
    ...overrides,
  };
}

describe('getSession', () => {
  beforeEach(() => {
    mockGetSessionToken.mockReset();
    mockHashSessionToken.mockReset();
    mockFindSessionByTokenHash.mockReset();
    mockRefreshSessionExpiry.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should return null when no cookie token exists', async () => {
    mockGetSessionToken.mockResolvedValueOnce(null);

    const result = await getSession();

    expect(result).toBeNull();
    expect(mockHashSessionToken).not.toHaveBeenCalled();
    expect(mockFindSessionByTokenHash).not.toHaveBeenCalled();
  });

  it('should return null when session not found in DB', async () => {
    mockGetSessionToken.mockResolvedValueOnce('raw-token');
    mockHashSessionToken.mockReturnValueOnce('hashed-token');
    mockFindSessionByTokenHash.mockResolvedValueOnce(null);

    const result = await getSession();

    expect(result).toBeNull();
    expect(mockHashSessionToken).toHaveBeenCalledWith('raw-token');
    expect(mockFindSessionByTokenHash).toHaveBeenCalledWith('hashed-token');
  });

  it('should return SessionData for a valid session', async () => {
    const session = createMockSessionRow();
    mockGetSessionToken.mockResolvedValueOnce('raw-token');
    mockHashSessionToken.mockReturnValueOnce('hashed-token');
    mockFindSessionByTokenHash.mockResolvedValueOnce(session);

    const result = await getSession();

    expect(result).toEqual({
      sessionId: 'session-uuid',
      userId: 'user-uuid',
      email: 'test@example.com',
      subscriptionStatus: 'trialing',
      trialEndsAt: session.trial_ends_at,
      emailVerified: true,
      organizationId: null,
    });
  });

  it('should refresh session when >50% of idle TTL has elapsed', async () => {
    // Session with only 6 hours remaining (< 12 hours = 50% of 24h)
    const session = createMockSessionRow({
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000),
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Created 1 day ago
    });

    mockGetSessionToken.mockResolvedValueOnce('raw-token');
    mockHashSessionToken.mockReturnValueOnce('hashed-token');
    mockFindSessionByTokenHash.mockResolvedValueOnce(session);
    mockRefreshSessionExpiry.mockResolvedValueOnce(undefined);

    await getSession();

    expect(mockRefreshSessionExpiry).toHaveBeenCalledWith(
      'session-uuid',
      expect.any(Date)
    );
  });

  it('should NOT refresh when sufficient time remains', async () => {
    // Session with 20 hours remaining (> 12 hours threshold)
    const session = createMockSessionRow({
      expires_at: new Date(Date.now() + 20 * 60 * 60 * 1000),
    });

    mockGetSessionToken.mockResolvedValueOnce('raw-token');
    mockHashSessionToken.mockReturnValueOnce('hashed-token');
    mockFindSessionByTokenHash.mockResolvedValueOnce(session);

    await getSession();

    expect(mockRefreshSessionExpiry).not.toHaveBeenCalled();
  });

  it('should cap refresh at absolute maximum (7 days from creation)', async () => {
    // Session created 6.5 days ago, expiring soon — refresh should cap at 7d absolute max
    const createdAt = new Date(Date.now() - 6.5 * 24 * 60 * 60 * 1000);
    const session = createMockSessionRow({
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours left
      created_at: createdAt,
    });

    mockGetSessionToken.mockResolvedValueOnce('raw-token');
    mockHashSessionToken.mockReturnValueOnce('hashed-token');
    mockFindSessionByTokenHash.mockResolvedValueOnce(session);
    mockRefreshSessionExpiry.mockResolvedValueOnce(undefined);

    await getSession();

    expect(mockRefreshSessionExpiry).toHaveBeenCalled();
    const newExpiry = mockRefreshSessionExpiry.mock.calls[0][1] as Date;
    const absoluteMax = createdAt.getTime() + SESSION_ABSOLUTE_MAX_MS;

    // newExpiry should be the absolute max, not the idle expiry
    expect(newExpiry.getTime()).toBeLessThanOrEqual(absoluteMax);
    // And it should be less than idle expiry (24h from now)
    expect(newExpiry.getTime()).toBeLessThan(Date.now() + SESSION_IDLE_TTL_MS);
  });

  it('should NOT refresh when new expiry would not extend session', async () => {
    // Edge case: session near absolute max, and already set to absolute max
    const createdAt = new Date(Date.now() - 6.9 * 24 * 60 * 60 * 1000);
    const absoluteMax = new Date(createdAt.getTime() + SESSION_ABSOLUTE_MAX_MS);
    const session = createMockSessionRow({
      expires_at: absoluteMax, // Already at the absolute max
      created_at: createdAt,
    });

    mockGetSessionToken.mockResolvedValueOnce('raw-token');
    mockHashSessionToken.mockReturnValueOnce('hashed-token');
    mockFindSessionByTokenHash.mockResolvedValueOnce(session);

    await getSession();

    // Should not refresh since newExpiry <= current expires_at
    expect(mockRefreshSessionExpiry).not.toHaveBeenCalled();
  });

  it('should return null on DB error (fail-closed)', async () => {
    mockGetSessionToken.mockResolvedValueOnce('raw-token');
    mockHashSessionToken.mockReturnValueOnce('hashed-token');
    mockFindSessionByTokenHash.mockRejectedValueOnce(new Error('connection lost'));

    const result = await getSession();

    expect(result).toBeNull();
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalledWith(
      'getSession error:',
      expect.any(Error)
    );
  });

  it('should return null when getSessionToken throws', async () => {
    mockGetSessionToken.mockRejectedValueOnce(new Error('cookies() failed'));

    const result = await getSession();

    expect(result).toBeNull();
  });
});
