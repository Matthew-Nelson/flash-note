import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateNoteAction,
  saveNoteAction,
  updateNoteSectionsAction,
  archiveNoteAction,
} from './notes';
import type { SessionData } from '@/server/types';
import type { GeneratedNoteResult } from '@/server/services/note-generation';
import { toFormData } from '@/test/form-data';
import { createMockSession } from '@/test/factories/session-factory';

// --- Mocks ---

const mockGetSession = vi.hoisted(() => vi.fn());
const mockGetRequestContext = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockCheckSubscriptionAccess = vi.hoisted(() => vi.fn());
const mockGenerateNote = vi.hoisted(() => vi.fn());
const mockIncrementUsage = vi.hoisted(() => vi.fn());
const mockAuditLog = vi.hoisted(() => vi.fn());
const mockAuditLogWithClient = vi.hoisted(() => vi.fn());
const mockFindTemplateWithUserStyle = vi.hoisted(() => vi.fn());
const mockIsTemplateUsableByUser = vi.hoisted(() => vi.fn());
const mockFindPatientById = vi.hoisted(() => vi.fn());
const mockCreateClinicalNote = vi.hoisted(() => vi.fn());
const mockFindClinicalNoteById = vi.hoisted(() => vi.fn());
const mockUpdateClinicalNoteContent = vi.hoisted(() => vi.fn());
const mockArchiveClinicalNote = vi.hoisted(() => vi.fn());
const mockCreateInitialVersions = vi.hoisted(() => vi.fn());
const mockCreateVersionForSection = vi.hoisted(() => vi.fn());
const mockGetPoolClient = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
}));

vi.mock('@/server/lib/get-session', () => ({
  getSession: mockGetSession,
}));

vi.mock('@/server/lib/request-context', () => ({
  getRequestContext: mockGetRequestContext,
}));

vi.mock('@/server/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  rateLimitKey: (ip: string, id?: string) => id ? `${ip}:${id}` : ip,
  generateRateLimit: 'mock-limiter',
  apiRateLimit: 'mock-api-limiter',
}));

vi.mock('@/server/services/subscription', () => ({
  checkSubscriptionAccess: mockCheckSubscriptionAccess,
}));

vi.mock('@/server/services/note-generation', () => ({
  generateNote: mockGenerateNote,
}));

vi.mock('@/server/dal', () => ({
  findTemplateWithUserStyle: mockFindTemplateWithUserStyle,
  isTemplateUsableByUser: mockIsTemplateUsableByUser,
  findPatientById: mockFindPatientById,
  createClinicalNote: mockCreateClinicalNote,
  findClinicalNoteById: mockFindClinicalNoteById,
  updateClinicalNoteContent: mockUpdateClinicalNoteContent,
  archiveClinicalNote: mockArchiveClinicalNote,
  createInitialVersions: mockCreateInitialVersions,
  createVersionForSection: mockCreateVersionForSection,
}));

vi.mock('@/server/db', () => ({
  getPoolClient: mockGetPoolClient,
  db: { query: vi.fn() },
}));

vi.mock('@/server/dal/usage', () => ({
  incrementUsage: mockIncrementUsage,
}));

vi.mock('@/server/services/audit', () => ({
  auditService: { log: mockAuditLog, logWithClient: mockAuditLogWithClient },
}));

vi.mock('@/server/lib/logger', () => ({ logger: mockLogger }));

vi.mock('@/server/types', () => ({
  AuditAction: {
    NOTE_GENERATED: 'NOTE_GENERATED',
    NOTE_SAVED: 'NOTE_SAVED',
    NOTE_UPDATED: 'NOTE_UPDATED',
    NOTE_ARCHIVED: 'NOTE_ARCHIVED',
    ACCESS_DENIED: 'ACCESS_DENIED',
  },
}));

// --- Helpers ---

function makeFormData(overrides: Record<string, string> = {}): FormData {
  return toFormData({
    noteType: 'daily_note',
    quickNotes: 'pt reports pain 5/10, ROM improving, strength getting better',
    ...overrides,
  });
}

function createSession(overrides: Partial<SessionData> = {}): SessionData {
  return createMockSession({ userId: 'user-1', ...overrides });
}

const SOAP_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001';
const SUB_ID = '00000000-0000-0000-0000-000000000011';
const OBJ_ID = '00000000-0000-0000-0000-000000000012';
const ASS_ID = '00000000-0000-0000-0000-000000000013';
const PLA_ID = '00000000-0000-0000-0000-000000000014';

const now = new Date('2026-04-18T00:00:00Z');

const soapTemplate = {
  id: SOAP_TEMPLATE_ID,
  userId: null,
  organizationId: null,
  name: 'SOAP Note',
  isBuiltin: true,
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
  sections: [
    { id: SUB_ID, templateId: SOAP_TEMPLATE_ID, title: 'Subjective', sortOrder: 1, verbosity: 'concise' as const, styling: 'paragraph' as const, promptInstructions: '…', includeInCopyAll: true, createdAt: now, updatedAt: now },
    { id: OBJ_ID, templateId: SOAP_TEMPLATE_ID, title: 'Objective', sortOrder: 2, verbosity: 'detailed' as const, styling: 'paragraph' as const, promptInstructions: '…', includeInCopyAll: true, createdAt: now, updatedAt: now },
    { id: ASS_ID, templateId: SOAP_TEMPLATE_ID, title: 'Assessment', sortOrder: 3, verbosity: 'concise' as const, styling: 'paragraph' as const, promptInstructions: '…', includeInCopyAll: true, createdAt: now, updatedAt: now },
    { id: PLA_ID, templateId: SOAP_TEMPLATE_ID, title: 'Plan', sortOrder: 4, verbosity: 'concise' as const, styling: 'bullets' as const, promptInstructions: '…', includeInCopyAll: true, createdAt: now, updatedAt: now },
  ],
};

function createGenerateResult(overrides: Partial<GeneratedNoteResult> = {}): GeneratedNoteResult {
  return {
    content: [
      { sectionId: SUB_ID, title: 'Subjective', content: 'Patient reports pain 4/10.' },
      { sectionId: OBJ_ID, title: 'Objective', content: 'ROM: Flexion 60°.' },
      { sectionId: ASS_ID, title: 'Assessment', content: 'Progressing well.' },
      { sectionId: PLA_ID, title: 'Plan', content: 'Continue PT 2x/week.' },
    ],
    billing: { suggestedCodes: [{ cptCode: '97110', description: 'Therapeutic Exercise' }] },
    alerts: ['Check billing codes.'],
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
    ...overrides,
  };
}

describe('generateNoteAction', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(createSession());
    mockGetRequestContext.mockResolvedValue({ ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' });
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 30, remaining: 29, reset: 0 });
    mockCheckSubscriptionAccess.mockResolvedValue({ allowed: true });
    mockGenerateNote.mockResolvedValue(createGenerateResult());
    mockIncrementUsage.mockResolvedValue(undefined);
    mockAuditLog.mockResolvedValue(undefined);
    mockFindTemplateWithUserStyle.mockResolvedValue(soapTemplate);
    mockFindPatientById.mockResolvedValue(null);
  });

  // --- Validation ---

  it('returns validation_error with fieldErrors for invalid input', async () => {
    const result = await generateNoteAction(makeFormData({ quickNotes: 'short' }));
    // Field names preserved, Zod messages replaced by the generic string (Rule 2)
    expect(result).toEqual({
      success: false,
      error: 'validation_error',
      fieldErrors: { quickNotes: ['Validation failed'] },
    });
  });

  it('returns validation_error with fieldErrors for missing noteType', async () => {
    const fd = new FormData();
    fd.set('quickNotes', 'pt reports pain 5/10, ROM improving');
    const result = await generateNoteAction(fd);
    expect(result).toEqual({
      success: false,
      error: 'validation_error',
      fieldErrors: { noteType: ['Validation failed'] },
    });
  });

  it('returns validation_error with fieldErrors for invalid noteType', async () => {
    const result = await generateNoteAction(makeFormData({ noteType: 'invalid_type' }));
    expect(result).toEqual({
      success: false,
      error: 'validation_error',
      fieldErrors: { noteType: ['Validation failed'] },
    });
  });

  it('rejects whitespace-only input for quickNotes', async () => {
    const result = await generateNoteAction(makeFormData({ quickNotes: '     ' }));
    expect(result).toEqual({
      success: false,
      error: 'validation_error',
      fieldErrors: { quickNotes: ['Validation failed'] },
    });
  });

  it('accepts patientContext after trimming', async () => {
    const result = await generateNoteAction(makeFormData({
      patientContext: '  65 y/o female  ',
      quickNotes: 'valid text with more than ten characters'
    }));
    expect(result).toMatchObject({ success: true });
    expect(mockGenerateNote).toHaveBeenCalledWith(
      expect.objectContaining({
        quickNotes: 'valid text with more than ten characters',
        noteType: 'daily_note',
        patientContext: '65 y/o female',  // Should be trimmed
        template: expect.objectContaining({ id: SOAP_TEMPLATE_ID }),
      }),
    );
  });

  it('accepts quickNotes after trimming', async () => {
    const result = await generateNoteAction(makeFormData({
      quickNotes: '  pt reports improvement in strength and balance  '
    }));
    expect(result).toMatchObject({ success: true });
    // Verify the trimmed value was passed to generateNote
    expect(mockGenerateNote).toHaveBeenCalledWith(
      expect.objectContaining({
        quickNotes: 'pt reports improvement in strength and balance',  // Trimmed
        noteType: 'daily_note',
        patientContext: null,
        template: expect.objectContaining({ id: SOAP_TEMPLATE_ID }),
      }),
    );
  });

  // --- Auth ---

  it('returns unauthenticated when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await generateNoteAction(makeFormData());
    expect(result).toEqual({ success: false, error: 'unauthenticated' });
    expect(mockGenerateNote).not.toHaveBeenCalled();
    expect(mockFindTemplateWithUserStyle).not.toHaveBeenCalled();
  });

  it('returns email_not_verified when email not verified', async () => {
    mockGetSession.mockResolvedValue(createSession({ emailVerified: false }));
    const result = await generateNoteAction(makeFormData());
    expect(result).toEqual({ success: false, error: 'email_not_verified' });
    expect(mockGenerateNote).not.toHaveBeenCalled();
  });

  // --- Subscription ---

  it('returns trial_expired when subscription check fails', async () => {
    mockCheckSubscriptionAccess.mockResolvedValue({ allowed: false, reason: 'trial_expired' });
    const result = await generateNoteAction(makeFormData());
    expect(result).toEqual({ success: false, error: 'trial_expired' });
    expect(mockGenerateNote).not.toHaveBeenCalled();
  });

  it('returns subscription_required when no subscription', async () => {
    mockCheckSubscriptionAccess.mockResolvedValue({ allowed: false, reason: 'subscription_required' });
    const result = await generateNoteAction(makeFormData());
    expect(result).toEqual({ success: false, error: 'subscription_required' });
    expect(mockGenerateNote).not.toHaveBeenCalled();
  });

  it('returns clinic_subscription_expired for org denial', async () => {
    mockCheckSubscriptionAccess.mockResolvedValue({ allowed: false, reason: 'clinic_subscription_expired' });
    const result = await generateNoteAction(makeFormData());
    expect(result).toEqual({ success: false, error: 'clinic_subscription_expired' });
    expect(mockGenerateNote).not.toHaveBeenCalled();
  });

  it('logs ACCESS_DENIED audit when trial is expired (Fix 5 / HIPAA)', async () => {
    mockGetSession.mockResolvedValueOnce(createSession({
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(0),
    }));
    mockGetRequestContext.mockResolvedValueOnce({ ipAddress: '127.0.0.1', userAgent: 'TestAgent' });
    mockCheckSubscriptionAccess.mockResolvedValueOnce({ allowed: false, reason: 'trial_expired' });

    const result = await generateNoteAction(makeFormData());

    expect(result).toEqual({ success: false, error: 'trial_expired' });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACCESS_DENIED',
        status: 'FAILURE',
        metadata: expect.objectContaining({ reason: 'trial_expired', resource: 'note_generation' }),
      })
    );
  });

  // --- Rate limiting ---

  it('returns rate_limit_exceeded when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 30, remaining: 0, reset: 0 });
    const result = await generateNoteAction(makeFormData());
    expect(result).toEqual({ success: false, error: 'rate_limit_exceeded' });
    expect(mockGenerateNote).not.toHaveBeenCalled();
  });

  it('uses IP:userId compound key for rate limiting', async () => {
    await generateNoteAction(makeFormData());
    expect(mockCheckRateLimit).toHaveBeenCalledWith('mock-limiter', '127.0.0.1:user-1');
  });

  // --- Successful generation ---

  it('logs note generation start at info level', async () => {
    const result = await generateNoteAction(makeFormData());
    expect(result).toMatchObject({ success: true });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'action_generate_note', userId: expect.any(String), noteType: expect.any(String) }),
      'Note generation started'
    );
  });

  it('logs note generation completion at info level', async () => {
    const result = await generateNoteAction(makeFormData());
    expect(result).toMatchObject({ success: true });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'action_generate_note', userId: expect.any(String), durationMs: expect.any(Number) }),
      'Note generation completed'
    );
  });

  it('returns SOAP note on success', async () => {
    const result = await generateNoteAction(makeFormData());

    expect(result).toMatchObject({
      success: true,
      data: {
        subjective: 'Patient reports pain 4/10.',
        objective: 'ROM: Flexion 60°.',
        assessment: 'Progressing well.',
        plan: 'Continue PT 2x/week.',
      },
    });
  });

  it('includes billing, alerts, and metadata in response', async () => {
    const result = await generateNoteAction(makeFormData());

    expect(result).toMatchObject({
      success: true,
      data: {
        billing: { suggestedCodes: [{ cptCode: '97110', description: 'Therapeutic Exercise' }] },
        alerts: ['Check billing codes.'],
        metadata: { generationTimeMs: 1500 },
      },
    });
  });

  it('strips model and token counts from response (security)', async () => {
    const result = await generateNoteAction(makeFormData());

    // metadata is matched exactly, so model/tokens can't hide there; objectContaining
    // on data would let them through at the top level, hence the explicit checks.
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ metadata: { generationTimeMs: 1500 } }),
    });
    for (const key of ['model', 'inputTokens', 'outputTokens']) {
      expect(result.success && result.data).not.toHaveProperty(key);
    }
  });

  it('passes patientContext to generateNote when provided', async () => {
    await generateNoteAction(makeFormData({ patientContext: '65 y/o female' }));

    expect(mockGenerateNote).toHaveBeenCalledWith(
      expect.objectContaining({
        noteType: 'daily_note',
        patientContext: '65 y/o female',
      }),
    );
  });

  // --- Usage tracking ---

  it('calls incrementUsage with correct token counts', async () => {
    await generateNoteAction(makeFormData());

    expect(mockIncrementUsage).toHaveBeenCalledWith('user-1', 100, 200);
  });

  // --- Audit logging ---

  it('logs audit entry with non-PHI metadata on success', async () => {
    await generateNoteAction(makeFormData());

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'NOTE_GENERATED',
        status: 'SUCCESS',
        metadata: expect.objectContaining({
          noteType: 'daily_note',
          inputTokens: 100,
          outputTokens: 200,
          generationTimeMs: 1500,
          suspiciousPatternDetected: false,
        }),
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent/1.0',
      })
    );
  });

  it('logs audit entry with FAILURE status on generation error', async () => {
    mockGenerateNote.mockRejectedValueOnce(new Error('LLM down'));

    await generateNoteAction(makeFormData());

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'NOTE_GENERATED',
        status: 'FAILURE',
        metadata: expect.objectContaining({
          noteType: 'daily_note',
          errorCode: 'internal_error',
        }),
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent/1.0',
      })
    );
  });

  it('logs warn when suspicious patterns detected', async () => {
    mockGenerateNote.mockResolvedValue(createGenerateResult({
      securityMetadata: { suspiciousPatternDetected: true, suspiciousPatternCount: 3 },
    }));

    await generateNoteAction(makeFormData());

    expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({
      source: 'action_generate_note',
      audit: true,
      userId: 'user-1',
      noteType: 'daily_note',
      suspiciousPatternCount: 3,
    }), 'Suspicious prompt patterns detected');
  });

  it('does not log warn when no suspicious patterns detected', async () => {
    await generateNoteAction(makeFormData());

    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('audit metadata never contains PHI (quickNotes, patientContext, note content)', async () => {
    await generateNoteAction(makeFormData({ patientContext: 'PHI_PATIENT_DATA' }));

    const auditEntry = mockAuditLog.mock.calls[0][0];
    const metadataStr = JSON.stringify(auditEntry.metadata);
    expect(metadataStr).not.toContain('PHI_PATIENT_DATA');
    expect(metadataStr).not.toContain('pt reports');
    expect(metadataStr).not.toContain('Progressing well');
  });

  // --- LLM error mapping ---

  it('maps RateLimitError to ai_rate_limited', async () => {
    const { RateLimitError } = await import('@/server/services/llm');
    mockGenerateNote.mockRejectedValueOnce(new RateLimitError('gemini'));

    const result = await generateNoteAction(makeFormData());

    expect(result).toEqual({ success: false, error: 'ai_rate_limited' });
  });

  it('maps ContentBlockedError to ai_content_blocked', async () => {
    const { ContentBlockedError } = await import('@/server/services/llm');
    mockGenerateNote.mockRejectedValueOnce(new ContentBlockedError('gemini'));

    const result = await generateNoteAction(makeFormData());

    expect(result).toEqual({ success: false, error: 'ai_content_blocked' });
  });

  it('maps TimeoutError to ai_timeout', async () => {
    const { TimeoutError } = await import('@/server/services/llm');
    mockGenerateNote.mockRejectedValueOnce(new TimeoutError('gemini', 30000));

    const result = await generateNoteAction(makeFormData());

    expect(result).toEqual({ success: false, error: 'ai_timeout' });
  });

  it('maps NetworkError to ai_unavailable', async () => {
    const { NetworkError } = await import('@/server/services/llm');
    mockGenerateNote.mockRejectedValueOnce(new NetworkError('gemini'));

    const result = await generateNoteAction(makeFormData());

    expect(result).toEqual({ success: false, error: 'ai_unavailable' });
  });

  it('maps generic LLMError to ai_error', async () => {
    const { LLMError } = await import('@/server/services/llm');
    mockGenerateNote.mockRejectedValueOnce(new LLMError('parse_error', 'Parse failed', 'gemini'));

    const result = await generateNoteAction(makeFormData());

    expect(result).toEqual({ success: false, error: 'ai_error' });
  });

  it('maps unknown errors to internal_error', async () => {
    mockGenerateNote.mockRejectedValueOnce(new Error('unexpected'));

    const result = await generateNoteAction(makeFormData());

    expect(result).toEqual({ success: false, error: 'internal_error' });
  });

  it('logs structured error context on failure (no PHI)', async () => {
    mockGenerateNote.mockRejectedValueOnce(new Error('db connection lost'));

    await generateNoteAction(makeFormData());

    expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({
      err: expect.any(Error),
      source: 'action_generate_note',
      errorType: 'internal_error',
      userId: 'user-1',
      noteType: 'daily_note',
    }), 'Note generation failed');
    // Verify no PHI in the log
    const loggedContext = mockLogger.error.mock.calls[0][0] as Record<string, unknown>;
    expect(JSON.stringify(loggedContext)).not.toContain('pt reports');
    // Verify error object is included (not raw message string)
    expect(loggedContext.err).toBeInstanceOf(Error);
  });

  // --- Order of operations ---

  it('validates input before checking session', async () => {
    const result = await generateNoteAction(makeFormData({ quickNotes: '' }));
    expect(result).toMatchObject({ success: false, error: 'validation_error' });
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('checks session before subscription', async () => {
    mockGetSession.mockResolvedValue(null);
    await generateNoteAction(makeFormData());
    expect(mockCheckSubscriptionAccess).not.toHaveBeenCalled();
  });

  it('checks subscription before rate limit', async () => {
    mockCheckSubscriptionAccess.mockResolvedValue({ allowed: false, reason: 'trial_expired' });
    await generateNoteAction(makeFormData());
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  // --- Modality and duration fields ---

  it('includes modality in response metadata', async () => {
    const result = await generateNoteAction(makeFormData({ modality: 'in_person' }));
    expect(result).toMatchObject({ success: true, data: { metadata: { modality: 'in_person' } } });
  });

  it('includes duration in response metadata', async () => {
    const result = await generateNoteAction(makeFormData({ duration: '45' }));
    expect(result).toMatchObject({ success: true, data: { metadata: { duration: 45 } } });
  });

  it('includes modality and duration in audit metadata', async () => {
    await generateNoteAction(makeFormData({ modality: 'telehealth', duration: '60' }));

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'NOTE_GENERATED',
        status: 'SUCCESS',
        metadata: expect.objectContaining({
          modality: 'telehealth',
          duration: 60,
        }),
      })
    );
  });

  it('accepts submission without modality and duration', async () => {
    const result = await generateNoteAction(makeFormData());
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ metadata: { generationTimeMs: 1500 } }),
    });
  });

  // --- Plan 04-03 Task 3: findTemplateWithUserStyle + findPatientById wiring ---

  it('prefers findTemplateWithUserStyle for the template load (user style overlay)', async () => {
    await generateNoteAction(makeFormData());
    expect(mockFindTemplateWithUserStyle).toHaveBeenCalledWith(SOAP_TEMPLATE_ID, 'user-1');
  });

  it('returns template_unavailable when the template is not visible to the user, without substituting another', async () => {
    const OTHER_USERS_TEMPLATE_ID = '22222222-2222-2222-2222-222222222222';
    mockFindTemplateWithUserStyle.mockResolvedValueOnce(null);

    const result = await generateNoteAction(
      makeFormData({ templateId: OTHER_USERS_TEMPLATE_ID }),
    );

    expect(result).toEqual({ success: false, error: 'template_unavailable' });
    expect(mockFindTemplateWithUserStyle).toHaveBeenCalledWith(OTHER_USERS_TEMPLATE_ID, 'user-1');
    expect(mockGenerateNote).not.toHaveBeenCalled();
  });

  it('loads patient and passes patient.context as generation-time snapshot when patientId supplied', async () => {
    const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
    mockFindPatientById.mockResolvedValueOnce({
      id: PATIENT_ID,
      firstName: 'P',
      lastName: 'Z',
      context: 'SERVER_DB_PATIENT_CONTEXT',
    });

    // userId in the form is client-supplied; the patient lookup must use the session user.
    await generateNoteAction(makeFormData({ patientId: PATIENT_ID, userId: 'user-2' }));

    expect(mockFindPatientById).toHaveBeenCalledWith(
      { type: 'user', userId: 'user-1' },
      PATIENT_ID,
    );
    expect(mockGenerateNote).toHaveBeenCalledWith(
      expect.objectContaining({ patientContext: 'SERVER_DB_PATIENT_CONTEXT' }),
    );
  });

  it('returns patient_not_found when patientId supplied but DAL returns null', async () => {
    mockFindPatientById.mockResolvedValueOnce(null);
    const result = await generateNoteAction(
      makeFormData({ patientId: '11111111-1111-1111-1111-111111111111' }),
    );
    expect(result).toEqual({ success: false, error: 'patient_not_found' });
    expect(mockGenerateNote).not.toHaveBeenCalled();
  });

  it('includes templateId + patientId in NOTE_GENERATED audit metadata', async () => {
    const PATIENT_ID = '22222222-2222-2222-2222-222222222222';
    mockFindPatientById.mockResolvedValueOnce({ id: PATIENT_ID, firstName: 'P', lastName: 'Z', context: 'ctx' });
    await generateNoteAction(makeFormData({ patientId: PATIENT_ID }));
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'NOTE_GENERATED',
        metadata: expect.objectContaining({
          templateId: SOAP_TEMPLATE_ID,
          patientId: PATIENT_ID,
          sectionCount: 4,
          hallucinationCount: 0,
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Task 3: saveNoteAction
// ---------------------------------------------------------------------------

function createMockPoolClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
}

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const NOTE_ID = '55555555-5555-5555-5555-555555555555';

function makeSaveFormData(overrides: Record<string, string> = {}): FormData {
  return toFormData({
    templateId: SOAP_TEMPLATE_ID,
    noteType: 'daily_note',
    content: JSON.stringify([
      { sectionId: SUB_ID, title: 'Subjective', content: 'S content' },
      { sectionId: OBJ_ID, title: 'Objective', content: 'O content' },
      { sectionId: ASS_ID, title: 'Assessment', content: 'A content' },
      { sectionId: PLA_ID, title: 'Plan', content: 'P content' },
    ]),
    quickNotes: 'pt reports pain 5/10, ROM improving, strength gaining',
    ...overrides,
  });
}

describe('saveNoteAction', () => {
  let poolClient: ReturnType<typeof createMockPoolClient>;

  beforeEach(() => {
    poolClient = createMockPoolClient();
    mockGetSession.mockResolvedValue(createSession());
    mockGetRequestContext.mockResolvedValue({ ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' });
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 });
    mockGetPoolClient.mockResolvedValue(poolClient);
    mockCreateClinicalNote.mockResolvedValue({
      id: NOTE_ID,
      userId: 'user-1',
      templateId: SOAP_TEMPLATE_ID,
      noteType: 'daily_note',
      content: [],
      createdAt: now,
      updatedAt: now,
    });
    mockCreateInitialVersions.mockResolvedValue([]);
    mockAuditLogWithClient.mockResolvedValue(undefined);
    mockFindPatientById.mockResolvedValue(null);
    mockIsTemplateUsableByUser.mockResolvedValue(true);
  });

  // --- Auth / rate limit ---

  it('returns unauthenticated when no session', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const result = await saveNoteAction(makeSaveFormData());
    expect(result).toEqual({ success: false, error: 'unauthenticated' });
    expect(mockGetPoolClient).not.toHaveBeenCalled();
    expect(mockCreateClinicalNote).not.toHaveBeenCalled();
  });

  it('returns unauthenticated when email not verified', async () => {
    mockGetSession.mockResolvedValueOnce(createSession({ emailVerified: false }));
    const result = await saveNoteAction(makeSaveFormData());
    expect(result).toEqual({ success: false, error: 'unauthenticated' });
    expect(mockCreateClinicalNote).not.toHaveBeenCalled();
  });

  it('returns rate_limit_exceeded when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 0 });
    const result = await saveNoteAction(makeSaveFormData());
    expect(result).toEqual({ success: false, error: 'rate_limit_exceeded' });
    expect(mockGetPoolClient).not.toHaveBeenCalled();
  });

  // --- Validation ---

  it('returns validation_error with fieldErrors on bad FormData', async () => {
    const result = await saveNoteAction(makeSaveFormData({ templateId: 'not-a-uuid' }));
    expect(result).toEqual({
      success: false,
      error: 'validation_error',
      fieldErrors: { templateId: ['Validation failed'] },
    });
  });

  it('returns validation_error when content is not valid JSON', async () => {
    const fd = makeSaveFormData();
    fd.set('content', '{invalid-json');
    const result = await saveNoteAction(fd);
    expect(result).toEqual({ success: false, error: 'validation_error' });
  });

  // --- Template authorization ---

  it('checks the template inside the transaction for the session user', async () => {
    await saveNoteAction(makeSaveFormData({ userId: 'user-2' }));

    expect(mockIsTemplateUsableByUser).toHaveBeenCalledWith(poolClient, SOAP_TEMPLATE_ID, 'user-1');
    expect(poolClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
  });

  it('returns template_unavailable and rolls back when the template is not usable by the user', async () => {
    mockIsTemplateUsableByUser.mockResolvedValueOnce(false);

    const result = await saveNoteAction(makeSaveFormData());

    expect(result).toEqual({ success: false, error: 'template_unavailable' });
    expect(poolClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(poolClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockCreateClinicalNote).not.toHaveBeenCalled();
    expect(mockAuditLogWithClient).not.toHaveBeenCalled();
    expect(poolClient.release).toHaveBeenCalled();
  });

  // --- Happy path transactional flow (Rule 1 + Rule 9) ---

  it('wraps create + initial versions + audit in BEGIN/COMMIT', async () => {
    // userId in the form is client-supplied; the note must be created for the session user.
    await saveNoteAction(makeSaveFormData({ userId: 'user-2' }));

    expect(poolClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockCreateClinicalNote).toHaveBeenCalledWith(
      poolClient,
      expect.objectContaining({ userId: 'user-1' }),
      expect.objectContaining({
        templateId: SOAP_TEMPLATE_ID,
        noteType: 'daily_note',
      }),
    );
    expect(mockCreateInitialVersions).toHaveBeenCalledWith(
      poolClient,
      NOTE_ID,
      expect.any(Array),
      'user-1',
    );
    expect(mockAuditLogWithClient).toHaveBeenCalledWith(
      poolClient,
      expect.objectContaining({
        action: 'NOTE_SAVED',
        status: 'SUCCESS',
        metadata: expect.objectContaining({ noteId: NOTE_ID, sectionCount: 4 }),
      }),
    );
    expect(poolClient.query).toHaveBeenCalledWith('COMMIT');
    expect(poolClient.release).toHaveBeenCalled();
  });

  it('returns { id } on success', async () => {
    const result = await saveNoteAction(makeSaveFormData());
    expect(result).toEqual({ success: true, data: { id: NOTE_ID } });
  });

  // --- M-5: Server-authoritative patientContext snapshot ---

  it('M-5: re-loads patient inside the transaction and overrides client-supplied snapshot', async () => {
    mockFindPatientById.mockResolvedValueOnce({
      id: PATIENT_ID,
      firstName: 'Pat',
      lastName: 'Zero',
      context: 'SERVER_DB_VALUE',
    });

    const fd = makeSaveFormData({
      patientId: PATIENT_ID,
      patientContextSnapshot: 'CLIENT_SUPPLIED_VALUE',
    });
    await saveNoteAction(fd);

    // findPatientById MUST be called with the client arg (proves inside-tx)
    expect(mockFindPatientById).toHaveBeenCalledWith(
      { type: 'user', userId: 'user-1' },
      PATIENT_ID,
      poolClient,
    );
    // createClinicalNote MUST receive the server value, not the client value
    expect(mockCreateClinicalNote).toHaveBeenCalledWith(
      poolClient,
      expect.anything(),
      expect.objectContaining({ patientContext: 'SERVER_DB_VALUE' }),
    );
    expect(mockCreateClinicalNote).not.toHaveBeenCalledWith(
      poolClient,
      expect.anything(),
      expect.objectContaining({ patientContext: 'CLIENT_SUPPLIED_VALUE' }),
    );
  });

  it('ROLLBACKs and returns patient_not_found when patientId supplied but findPatientById returns null', async () => {
    mockFindPatientById.mockResolvedValueOnce(null);
    const result = await saveNoteAction(makeSaveFormData({ patientId: PATIENT_ID }));

    expect(result).toEqual({ success: false, error: 'patient_not_found' });
    expect(poolClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(poolClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockCreateClinicalNote).not.toHaveBeenCalled();
    expect(mockAuditLogWithClient).not.toHaveBeenCalled();
    expect(poolClient.release).toHaveBeenCalled();
  });

  // --- Induced rollback (Rule 1) ---

  it('ROLLBACKs, does not audit, and returns internal_error when createInitialVersions throws', async () => {
    mockCreateInitialVersions.mockRejectedValueOnce(new Error('induced failure'));

    const result = await saveNoteAction(makeSaveFormData());

    expect(result).toEqual({ success: false, error: 'internal_error' });
    expect(poolClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(poolClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockAuditLogWithClient).not.toHaveBeenCalled();
    expect(poolClient.release).toHaveBeenCalled();
  });

  // --- M-2: PHI-in-logs guard ---

  it('M-2: catch-block logger never includes PHI (quickNotes, content, patientContext, patient PII)', async () => {
    mockCreateClinicalNote.mockRejectedValueOnce(new Error('db down'));
    const PHI_PATIENT_ID = '99999999-9999-9999-9999-999999999999';
    mockFindPatientById.mockResolvedValueOnce({
      id: PHI_PATIENT_ID,
      firstName: 'PHI_FIRST_NAME',
      lastName: 'PHI_LAST_NAME',
      dateOfBirth: new Date('1970-01-01'),
      context: 'PHI_CTX_VALUE',
    });

    await saveNoteAction(makeSaveFormData({
      patientId: PHI_PATIENT_ID,
      patientContextSnapshot: 'PHI_CLIENT_SNAPSHOT',
    }));

    expect(mockLogger.error).toHaveBeenCalled();
    const logPayload = JSON.stringify(mockLogger.error.mock.calls[0][0]);
    for (const forbidden of [
      'PHI_FIRST_NAME',
      'PHI_LAST_NAME',
      'PHI_CTX_VALUE',
      'PHI_CLIENT_SNAPSHOT',
      'pt reports pain',
      'S content',
    ]) {
      expect(logPayload).not.toContain(forbidden);
    }
  });
});

// ---------------------------------------------------------------------------
// Task 3: updateNoteSectionsAction
// ---------------------------------------------------------------------------

function makeUpdateFormData(overrides: Record<string, string> = {}): FormData {
  return toFormData({
    noteId: NOTE_ID,
    expectedUpdatedAt: '2026-04-18T00:00:00.000Z',
    sections: JSON.stringify({ [SUB_ID]: 'new subjective text' }),
    ...overrides,
  });
}

describe('updateNoteSectionsAction', () => {
  let poolClient: ReturnType<typeof createMockPoolClient>;

  const existingNote = {
    id: NOTE_ID,
    userId: 'user-1',
    organizationId: null,
    templateId: SOAP_TEMPLATE_ID,
    noteType: 'daily_note',
    content: [
      { sectionId: SUB_ID, title: 'Subjective', content: 'old sub' },
      { sectionId: OBJ_ID, title: 'Objective', content: 'old obj' },
    ],
    quickNotes: '…',
    patientContext: null,
    modality: null,
    durationMinutes: null,
    generationTimeMs: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    patientId: null,
    patientFirstName: null,
    patientLastName: null,
  };

  beforeEach(() => {
    poolClient = createMockPoolClient();
    mockGetSession.mockResolvedValue(createSession());
    mockGetRequestContext.mockResolvedValue({ ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' });
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 });
    mockGetPoolClient.mockResolvedValue(poolClient);
    mockFindClinicalNoteById.mockResolvedValue(existingNote);
    mockUpdateClinicalNoteContent.mockResolvedValue({
      ...existingNote,
      content: [...existingNote.content],
    });
    mockCreateVersionForSection.mockResolvedValue({});
    mockAuditLogWithClient.mockResolvedValue(undefined);
  });

  it('returns unauthenticated when no session', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const result = await updateNoteSectionsAction(makeUpdateFormData());
    expect(result).toEqual({ success: false, error: 'unauthenticated' });
    expect(mockGetPoolClient).not.toHaveBeenCalled();
    expect(mockFindClinicalNoteById).not.toHaveBeenCalled();
  });

  it('returns rate_limit_exceeded when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 0 });
    const result = await updateNoteSectionsAction(makeUpdateFormData());
    expect(result).toEqual({ success: false, error: 'rate_limit_exceeded' });
    expect(mockGetPoolClient).not.toHaveBeenCalled();
  });

  it('returns validation_error when sections is not parseable JSON', async () => {
    const fd = makeUpdateFormData();
    fd.set('sections', '{nope');
    const result = await updateNoteSectionsAction(fd);
    expect(result).toEqual({ success: false, error: 'validation_error' });
  });

  it('returns note_not_found and ROLLBACKs when the note does not exist', async () => {
    mockFindClinicalNoteById.mockResolvedValueOnce(null);
    const result = await updateNoteSectionsAction(makeUpdateFormData());
    expect(result).toEqual({ success: false, error: 'note_not_found' });
    expect(poolClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(poolClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockUpdateClinicalNoteContent).not.toHaveBeenCalled();
    expect(mockAuditLogWithClient).not.toHaveBeenCalled();
    expect(poolClient.release).toHaveBeenCalled();
  });

  it('returns invalid_section_id and ROLLBACKs when submitted sectionId is not in existing note', async () => {
    const fd = makeUpdateFormData({
      sections: JSON.stringify({ '00000000-0000-0000-0000-000000009999': 'rogue' }),
    });
    const result = await updateNoteSectionsAction(fd);
    expect(result).toEqual({ success: false, error: 'invalid_section_id' });
    expect(poolClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(poolClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockUpdateClinicalNoteContent).not.toHaveBeenCalled();
  });

  it('returns conflict and ROLLBACKs when optimistic lock stale (updateClinicalNoteContent returns null)', async () => {
    mockUpdateClinicalNoteContent.mockResolvedValueOnce(null);
    const result = await updateNoteSectionsAction(makeUpdateFormData());
    expect(result).toEqual({ success: false, error: 'conflict' });
    expect(poolClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(poolClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockCreateVersionForSection).not.toHaveBeenCalled();
    expect(mockAuditLogWithClient).not.toHaveBeenCalled();
  });

  // --- M-1: UNIQUE (note_id, section_id, version) violation ---

  it('M-1: UNIQUE violation (pg 23505) on version INSERT surfaces as conflict with ROLLBACK + release', async () => {
    const uniqueError = Object.assign(new Error('duplicate key'), { code: '23505' });
    mockCreateVersionForSection.mockRejectedValueOnce(uniqueError);

    const result = await updateNoteSectionsAction(makeUpdateFormData());

    expect(result).toEqual({ success: false, error: 'conflict' });
    expect(poolClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(poolClient.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mockAuditLogWithClient).not.toHaveBeenCalled();
    expect(poolClient.release).toHaveBeenCalled();
  });

  it('commits successfully on happy path and writes NOTE_UPDATED audit in-transaction (Rule 9)', async () => {
    // userId in the form is client-supplied; note access must use the session user.
    const result = await updateNoteSectionsAction(makeUpdateFormData({ userId: 'user-2' }));
    expect(result).toEqual({
      success: true,
      data: { note: expect.objectContaining({ id: NOTE_ID }) },
    });
    expect(mockFindClinicalNoteById).toHaveBeenCalledWith({ type: 'user', userId: 'user-1' }, NOTE_ID);
    expect(poolClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockCreateVersionForSection).toHaveBeenCalledWith(
      poolClient,
      NOTE_ID,
      SUB_ID,
      'new subjective text',
      'manual',
      'user-1',
    );
    expect(mockAuditLogWithClient).toHaveBeenCalledWith(
      poolClient,
      expect.objectContaining({
        action: 'NOTE_UPDATED',
        status: 'SUCCESS',
        metadata: expect.objectContaining({ noteId: NOTE_ID, editedSectionCount: 1 }),
      }),
    );
    expect(poolClient.query).toHaveBeenCalledWith('COMMIT');
  });

  it('M-2: catch-block logger never includes PHI', async () => {
    mockUpdateClinicalNoteContent.mockRejectedValueOnce(new Error('db down'));
    await updateNoteSectionsAction(makeUpdateFormData({
      sections: JSON.stringify({ [SUB_ID]: 'PHI_NEW_CONTENT' }),
    }));
    const logPayload = JSON.stringify(mockLogger.error.mock.calls[0][0]);
    expect(logPayload).not.toContain('PHI_NEW_CONTENT');
    expect(logPayload).not.toContain('old sub');
  });
});

// ---------------------------------------------------------------------------
// Task 3: archiveNoteAction
// ---------------------------------------------------------------------------

describe('archiveNoteAction', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(createSession());
    mockGetRequestContext.mockResolvedValue({ ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' });
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 });
    mockArchiveClinicalNote.mockResolvedValue(true);
    mockAuditLog.mockResolvedValue(undefined);
  });

  it('returns unauthenticated when no session', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const result = await archiveNoteAction(NOTE_ID);
    expect(result).toEqual({ success: false, error: 'unauthenticated' });
    expect(mockArchiveClinicalNote).not.toHaveBeenCalled();
  });

  it('returns validation_error when noteId is not a UUID', async () => {
    const result = await archiveNoteAction('not-a-uuid');
    expect(result).toEqual({ success: false, error: 'validation_error' });
    expect(mockArchiveClinicalNote).not.toHaveBeenCalled();
  });

  it('returns rate_limit_exceeded when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 0 });
    const result = await archiveNoteAction(NOTE_ID);
    expect(result).toEqual({ success: false, error: 'rate_limit_exceeded' });
    expect(mockArchiveClinicalNote).not.toHaveBeenCalled();
  });

  it('returns archive_failed when DAL returns false (not found / out-of-scope)', async () => {
    mockArchiveClinicalNote.mockResolvedValueOnce(false);
    const result = await archiveNoteAction(NOTE_ID);
    expect(result).toEqual({ success: false, error: 'archive_failed' });
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('writes NOTE_ARCHIVED audit on success', async () => {
    const result = await archiveNoteAction(NOTE_ID);
    expect(result).toEqual({ success: true });
    expect(mockArchiveClinicalNote).toHaveBeenCalledWith({ type: 'user', userId: 'user-1' }, NOTE_ID);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'NOTE_ARCHIVED',
        status: 'SUCCESS',
        metadata: expect.objectContaining({ noteId: NOTE_ID }),
      }),
    );
  });

  it('M-2: catch-block logger never includes PHI', async () => {
    mockArchiveClinicalNote.mockRejectedValueOnce(new Error('db down'));
    const result = await archiveNoteAction(NOTE_ID);
    expect(result).toEqual({ success: false, error: 'internal_error' });
    const logPayload = JSON.stringify(mockLogger.error.mock.calls[0][0]);
    // audit metadata never logged — only noteId in error context
    expect(logPayload).not.toContain('content');
    expect(logPayload).not.toContain('quickNotes');
  });
});
