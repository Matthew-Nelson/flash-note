import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateSectionStyleAction } from './templates';
import type { SessionData } from '@/server/types';
import { toFormData } from '@/test/form-data';
import { createMockSession } from '@/test/factories/session-factory';

const mockGetSession = vi.hoisted(() => vi.fn());
const mockGetRequestContext = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockUpsertUserSectionStyle = vi.hoisted(() => vi.fn());
const mockAuditLog = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/server/lib/get-session', () => ({ getSession: mockGetSession }));
vi.mock('@/server/lib/request-context', () => ({ getRequestContext: mockGetRequestContext }));
vi.mock('@/server/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  apiRateLimit: 'mock-api-limiter',
}));
vi.mock('@/server/dal', () => ({ upsertUserSectionStyle: mockUpsertUserSectionStyle }));
vi.mock('@/server/services/audit', () => ({
  auditService: { log: mockAuditLog, logWithClient: vi.fn() },
}));
vi.mock('@/server/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/server/types', () => ({
  AuditAction: {
    USER_PREFERENCES_UPDATED: 'USER_PREFERENCES_UPDATED',
  },
}));

const SECTION_ID = '00000000-0000-0000-0000-000000000011';

function createSession(overrides: Partial<SessionData> = {}): SessionData {
  return createMockSession({ userId: 'user-1', ...overrides });
}

describe('updateSectionStyleAction', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(createSession());
    mockGetRequestContext.mockResolvedValue({ ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' });
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 });
    mockUpsertUserSectionStyle.mockResolvedValue({
      id: 'pref-1',
      userId: 'user-1',
      sectionId: SECTION_ID,
      verbosity: 'detailed',
      styling: 'paragraph',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockAuditLog.mockResolvedValue(undefined);
  });

  it('returns unauthenticated when no session', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const result = await updateSectionStyleAction(toFormData({ sectionId: SECTION_ID, verbosity: 'detailed' }));
    expect(result).toEqual({ success: false, error: 'unauthenticated' });
    expect(mockUpsertUserSectionStyle).not.toHaveBeenCalled();
  });

  it('returns unauthenticated when email not verified', async () => {
    mockGetSession.mockResolvedValueOnce(createSession({ emailVerified: false }));
    const result = await updateSectionStyleAction(toFormData({ sectionId: SECTION_ID, verbosity: 'detailed' }));
    expect(result).toEqual({ success: false, error: 'unauthenticated' });
    expect(mockUpsertUserSectionStyle).not.toHaveBeenCalled();
  });

  it('returns rate_limit_exceeded when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 0 });
    const result = await updateSectionStyleAction(toFormData({ sectionId: SECTION_ID, verbosity: 'detailed' }));
    expect(result).toEqual({ success: false, error: 'rate_limit_exceeded' });
    expect(mockUpsertUserSectionStyle).not.toHaveBeenCalled();
  });

  it('returns validation_error when sectionId is not a UUID', async () => {
    const result = await updateSectionStyleAction(toFormData({ sectionId: 'not-a-uuid', verbosity: 'detailed' }));
    expect(result).toEqual({
      success: false,
      error: 'validation_error',
      fieldErrors: { sectionId: ['Validation failed'] },
    });
    expect(mockUpsertUserSectionStyle).not.toHaveBeenCalled();
  });

  it('returns validation_error when neither verbosity nor styling supplied', async () => {
    const result = await updateSectionStyleAction(toFormData({ sectionId: SECTION_ID }));
    expect(result).toMatchObject({ success: false, error: 'validation_error' });
    expect(mockUpsertUserSectionStyle).not.toHaveBeenCalled();
  });

  it('returns validation_error for invalid verbosity enum value', async () => {
    const result = await updateSectionStyleAction(toFormData({ sectionId: SECTION_ID, verbosity: 'loud' }));
    expect(result).toEqual({
      success: false,
      error: 'validation_error',
      fieldErrors: { verbosity: ['Validation failed'] },
    });
    expect(mockUpsertUserSectionStyle).not.toHaveBeenCalled();
  });

  it('upserts and audits on happy path — verbosity only', async () => {
    // userId in the form is client-supplied; the upsert must use the session user.
    const result = await updateSectionStyleAction(toFormData({ sectionId: SECTION_ID, verbosity: 'detailed', userId: 'user-2' }));

    expect(result).toMatchObject({ success: true, data: { preference: { id: 'pref-1' } } });
    expect(mockUpsertUserSectionStyle).toHaveBeenCalledWith('user-1', SECTION_ID, {
      verbosity: 'detailed',
      styling: undefined,
    });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'USER_PREFERENCES_UPDATED',
        status: 'SUCCESS',
        metadata: {
          sectionId: SECTION_ID,
          fields: ['verbosity'],
        },
      }),
    );
  });

  it('upserts and audits on happy path — styling only', async () => {
    const result = await updateSectionStyleAction(toFormData({ sectionId: SECTION_ID, styling: 'bullets' }));

    expect(result).toMatchObject({ success: true, data: { preference: { id: 'pref-1' } } });
    expect(mockUpsertUserSectionStyle).toHaveBeenCalledWith('user-1', SECTION_ID, {
      verbosity: undefined,
      styling: 'bullets',
    });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_PREFERENCES_UPDATED',
        metadata: expect.objectContaining({ fields: ['styling'] }),
      }),
    );
  });

  it('audit metadata includes both fields when both submitted', async () => {
    await updateSectionStyleAction(toFormData({
      sectionId: SECTION_ID,
      verbosity: 'concise',
      styling: 'bullets',
    }));
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          fields: ['verbosity', 'styling'],
        }),
      }),
    );
  });

  it('returns style_prefs_save_failed when DAL throws', async () => {
    mockUpsertUserSectionStyle.mockRejectedValueOnce(new Error('db down'));
    const result = await updateSectionStyleAction(toFormData({ sectionId: SECTION_ID, verbosity: 'detailed' }));
    expect(result).toEqual({ success: false, error: 'style_prefs_save_failed' });
  });

  it('M-2: catch-block logger never includes PHI (metadata has sectionId only)', async () => {
    mockUpsertUserSectionStyle.mockRejectedValueOnce(new Error('db down'));
    await updateSectionStyleAction(toFormData({
      sectionId: SECTION_ID,
      verbosity: 'detailed',
      styling: 'bullets',
    }));
    expect(mockLogger.error).toHaveBeenCalled();
    const logPayload = JSON.stringify(mockLogger.error.mock.calls[0][0]);
    expect(logPayload).toContain('action_update_section_style');
    // No PHI — no free-text values from FormData leak into logs.
    expect(logPayload).not.toContain('patient');
    expect(logPayload).not.toContain('firstName');
    expect(logPayload).not.toContain('lastName');
    expect(logPayload).not.toContain('quickNotes');
    expect(logPayload).not.toContain('content');
  });
});
