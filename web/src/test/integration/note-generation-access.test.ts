/**
 * Note Generation Access Control Integration Test
 *
 * Tests the subscription access gating in generateNoteAction against a real
 * checkSubscriptionAccess implementation. This is NOT a unit test — we do not
 * mock checkSubscriptionAccess itself. We mock only:
 *   - @/server/lib/get-session (session state control)
 *   - @/server/dal/organizations (org subscription DB query)
 *   - @/server/services/note-generation (LLM — external I/O)
 *   - @/server/dal/usage (fire-and-forget, side-effect)
 *   - @/server/services/audit (fire-and-forget, side-effect)
 *   - @/server/lib/request-context (infrastructure, not under test)
 *   - @/server/lib/rate-limit (infrastructure, not under test)
 *
 * The real subscription logic: generateNoteAction → checkSubscriptionAccess
 * (subscription.ts) → getOrgSubscription (mocked DAL)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionData } from '@/server/types';

// --- Hoisted mock declarations ---

const mockGetSession = vi.hoisted(() => vi.fn());
const mockGetOrgSubscription = vi.hoisted(() => vi.fn());
const mockGenerateNote = vi.hoisted(() => vi.fn());
const mockIncrementUsage = vi.hoisted(() => vi.fn());
const mockAuditLog = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockCheckRateLimit = vi.hoisted(() => vi.fn());

// --- Mocks ---

vi.mock('@/server/lib/get-session', () => ({
  getSession: mockGetSession,
}));

vi.mock('@/server/lib/request-context', () => ({
  getRequestContext: vi.fn().mockResolvedValue({
    ipAddress: '127.0.0.1',
    userAgent: 'IntegrationTest/1.0',
  }),
}));

vi.mock('@/server/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  rateLimitKey: (ip: string, id?: string) => (id ? `${ip}:${id}` : ip),
  generateRateLimit: 'mock-limiter',
}));

// Mock DAL for org subscription — real checkSubscriptionAccess calls this
vi.mock('@/server/dal/organizations', () => ({
  getOrgSubscription: mockGetOrgSubscription,
}));

// Plan 04-03 Task 3: generateNoteAction now imports from the DAL barrel
// (findTemplateWithUserStyle, findTemplateById, findBuiltinTemplates,
// findPatientById). We mock the barrel so the test doesn't transitively
// load @/server/db (which calls process.exit on missing DATABASE_URL).
//
// The subscription-access paths under test short-circuit BEFORE reaching
// these DAL calls, so we only need stubs to satisfy the import graph.
// NOTE: factory runs at module init — use vi.hoisted() for the template.
const soapTemplate = vi.hoisted(() => ({
  id: '00000000-0000-0000-0000-000000000001',
  userId: null as string | null,
  organizationId: null as string | null,
  name: 'SOAP Note',
  isBuiltin: true,
  archivedAt: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
  sections: [] as unknown[],
}));
vi.mock('@/server/dal', () => ({
  findTemplateById: vi.fn().mockResolvedValue(soapTemplate),
  findTemplateWithUserStyle: vi.fn().mockResolvedValue(soapTemplate),
  findBuiltinTemplates: vi.fn().mockResolvedValue([soapTemplate]),
  findPatientById: vi.fn().mockResolvedValue(null),
  createClinicalNote: vi.fn(),
  findClinicalNoteById: vi.fn(),
  updateClinicalNoteContent: vi.fn(),
  archiveClinicalNote: vi.fn(),
  createInitialVersions: vi.fn(),
  createVersionForSection: vi.fn(),
}));

// getPoolClient is used by the new save/update actions only; stub it so the
// import graph resolves without loading @/server/db.
vi.mock('@/server/db', () => ({
  getPoolClient: vi.fn(),
  db: { query: vi.fn() },
}));

// Mock LLM (external I/O)
vi.mock('@/server/services/note-generation', () => ({
  generateNote: mockGenerateNote,
}));

vi.mock('@/server/dal/usage', () => ({
  incrementUsage: mockIncrementUsage,
}));

vi.mock('@/server/services/audit', () => ({
  auditService: {
    log: mockAuditLog,
    logWithClient: vi.fn(),
  },
}));

vi.mock('@/server/types', () => ({
  AuditAction: {
    NOTE_GENERATED: 'NOTE_GENERATED',
    NOTE_SAVED: 'NOTE_SAVED',
    NOTE_UPDATED: 'NOTE_UPDATED',
    NOTE_ARCHIVED: 'NOTE_ARCHIVED',
    ACCESS_DENIED: 'ACCESS_DENIED',
  },
}));

// Import after mocks
import { generateNoteAction } from '@/actions/notes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    email: 'test@example.com',
    subscriptionStatus: 'active',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    emailVerified: true,
    organizationId: null,
    ...overrides,
  };
}

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    noteType: 'daily_note',
    quickNotes: 'pt reports pain 5/10, ROM improving, strength gaining',
    ...overrides,
  };
  for (const [key, value] of Object.entries(defaults)) {
    fd.set(key, value);
  }
  return fd;
}

function createGenerateResult() {
  return {
    content: [
      { sectionId: '00000000-0000-0000-0000-000000000011', title: 'Subjective', content: 'Patient reports pain 4/10.' },
      { sectionId: '00000000-0000-0000-0000-000000000012', title: 'Objective', content: 'ROM: Flexion 60°.' },
      { sectionId: '00000000-0000-0000-0000-000000000013', title: 'Assessment', content: 'Progressing well.' },
      { sectionId: '00000000-0000-0000-0000-000000000014', title: 'Plan', content: 'Continue PT 2x/week.' },
    ],
    hallucinationIssues: [],
    metadata: {
      model: 'gemini-2.5-flash',
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
      generationTimeMs: 1500,
    },
    securityMetadata: {
      suspiciousPatternDetected: false,
      suspiciousPatternCount: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('note generation access control (real checkSubscriptionAccess)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 30, remaining: 29, reset: 0 });
    mockGenerateNote.mockResolvedValue(createGenerateResult());
    mockIncrementUsage.mockResolvedValue(undefined);
    mockAuditLog.mockResolvedValue(undefined);
    mockGetOrgSubscription.mockResolvedValue(null);
  });

  // -------------------------------------------------------------------------
  // Scenario 1: Individual active subscription → allowed → LLM called
  // -------------------------------------------------------------------------

  it('allows access and calls LLM for active individual subscription', async () => {
    mockGetSession.mockResolvedValue(createSession({ subscriptionStatus: 'active' }));

    const result = await generateNoteAction(makeFormData());

    expect(result.success).toBe(true);
    expect(mockGenerateNote).toHaveBeenCalledOnce();
    // org subscription DAL should NOT be called — active subscription short-circuits
    expect(mockGetOrgSubscription).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Trial still valid → allowed
  // -------------------------------------------------------------------------

  it('allows access for trialing user with trial end date in the future', async () => {
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    mockGetSession.mockResolvedValue(createSession({
      subscriptionStatus: 'trialing',
      trialEndsAt,
    }));

    const result = await generateNoteAction(makeFormData());

    expect(result.success).toBe(true);
    expect(mockGenerateNote).toHaveBeenCalledOnce();
    // org subscription DAL should NOT be called — valid trial short-circuits
    expect(mockGetOrgSubscription).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Trial expired → trial_expired + ACCESS_DENIED audit
  // -------------------------------------------------------------------------

  it('denies access and logs ACCESS_DENIED audit when trial is expired', async () => {
    const trialEndsAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    mockGetSession.mockResolvedValue(createSession({
      subscriptionStatus: 'trialing',
      trialEndsAt,
      organizationId: null, // no org fallback
    }));

    const result = await generateNoteAction(makeFormData());

    // Real checkSubscriptionAccess returns trial_expired for expired trial with no org
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('trial_expired');
    }
    // LLM must NOT be called (gated by subscription check)
    expect(mockGenerateNote).not.toHaveBeenCalled();
    // HIPAA: ACCESS_DENIED audit must fire (Fix 5 verification)
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACCESS_DENIED',
        status: 'FAILURE',
        metadata: expect.objectContaining({
          reason: 'trial_expired',
          resource: 'note_generation',
        }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Canceled individual sub + org with active sub → allowed (org fallback)
  // -------------------------------------------------------------------------

  it('allows access via org fallback when individual subscription is canceled but org is active', async () => {
    mockGetSession.mockResolvedValue(createSession({
      subscriptionStatus: 'canceled',
      organizationId: 'org-1',
    }));
    // Real checkSubscriptionAccess calls getOrgSubscription → active org
    mockGetOrgSubscription.mockResolvedValue({
      subscription_status: 'active',
      trial_ends_at: null,
    });

    const result = await generateNoteAction(makeFormData());

    expect(result.success).toBe(true);
    expect(mockGenerateNote).toHaveBeenCalledOnce();
    // Org subscription DAL must be called for the fallback check
    expect(mockGetOrgSubscription).toHaveBeenCalledWith('org-1', 'user-1');
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Canceled individual sub + org with expired sub → clinic_subscription_expired
  // -------------------------------------------------------------------------

  it('denies access with clinic_subscription_expired when both individual and org subscriptions are lapsed', async () => {
    mockGetSession.mockResolvedValue(createSession({
      subscriptionStatus: 'canceled',
      organizationId: 'org-1',
    }));
    // Org exists but subscription lapsed (canceled)
    mockGetOrgSubscription.mockResolvedValue({
      subscription_status: 'canceled',
      trial_ends_at: null,
    });

    const result = await generateNoteAction(makeFormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('clinic_subscription_expired');
    }
    expect(mockGenerateNote).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Scenario 6: No subscription, no org → subscription_required
  // -------------------------------------------------------------------------

  it('denies access with subscription_required when user has no active subscription and no org', async () => {
    mockGetSession.mockResolvedValue(createSession({
      subscriptionStatus: 'canceled',
      organizationId: null,
    }));

    const result = await generateNoteAction(makeFormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('subscription_required');
    }
    expect(mockGenerateNote).not.toHaveBeenCalled();
    // No org → org subscription DAL not called
    expect(mockGetOrgSubscription).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Scenario 7: Org fallback — trialing org with future trial end date → allowed
  // -------------------------------------------------------------------------

  it('allows access via org fallback when org subscription is trialing with future end date', async () => {
    mockGetSession.mockResolvedValue(createSession({
      subscriptionStatus: 'canceled',
      organizationId: 'org-1',
    }));
    const orgTrialEndsAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
    mockGetOrgSubscription.mockResolvedValue({
      subscription_status: 'trialing',
      trial_ends_at: orgTrialEndsAt,
    });

    const result = await generateNoteAction(makeFormData());

    expect(result.success).toBe(true);
    expect(mockGenerateNote).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Scenario 8: Org fallback — trialing org with expired trial → clinic_subscription_expired
  // -------------------------------------------------------------------------

  it('denies access with clinic_subscription_expired when org trial is also expired', async () => {
    mockGetSession.mockResolvedValue(createSession({
      subscriptionStatus: 'canceled',
      organizationId: 'org-1',
    }));
    const orgTrialEndsAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    mockGetOrgSubscription.mockResolvedValue({
      subscription_status: 'trialing',
      trial_ends_at: orgTrialEndsAt,
    });

    const result = await generateNoteAction(makeFormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('clinic_subscription_expired');
    }
    expect(mockGenerateNote).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Scenario 9: Verify rate limit is still enforced after subscription passes
  // -------------------------------------------------------------------------

  it('enforces rate limit after subscription check passes', async () => {
    mockGetSession.mockResolvedValue(createSession({ subscriptionStatus: 'active' }));
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 30, remaining: 0, reset: Date.now() });

    const result = await generateNoteAction(makeFormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('rate_limit_exceeded');
    }
    // Rate limit fires before LLM
    expect(mockGenerateNote).not.toHaveBeenCalled();
  });
});
