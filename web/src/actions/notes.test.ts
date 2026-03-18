import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateNoteAction } from './notes';
import type { SessionData } from '@/server/types';
import type { GeneratedNoteResult } from '@/server/services/note-generation';

// --- Mocks ---

const mockGetSession = vi.hoisted(() => vi.fn());
const mockGetRequestContext = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockCheckSubscriptionAccess = vi.hoisted(() => vi.fn());
const mockGenerateNote = vi.hoisted(() => vi.fn());
const mockIncrementUsage = vi.hoisted(() => vi.fn());
const mockAuditLog = vi.hoisted(() => vi.fn());
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
}));

vi.mock('@/server/services/subscription', () => ({
  checkSubscriptionAccess: mockCheckSubscriptionAccess,
}));

vi.mock('@/server/services/note-generation', () => ({
  generateNote: mockGenerateNote,
}));

vi.mock('@/server/dal/usage', () => ({
  incrementUsage: mockIncrementUsage,
}));

vi.mock('@/server/services/audit', () => ({
  auditService: { log: mockAuditLog },
}));

vi.mock('@/server/lib/logger', () => ({ logger: mockLogger }));

vi.mock('@/server/types', () => ({
  AuditAction: {
    NOTE_GENERATED: 'NOTE_GENERATED',
    ACCESS_DENIED: 'ACCESS_DENIED',
  },
}));

// --- Helpers ---

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const defaults: Record<string, string> = {
    noteType: 'daily_note',
    quickNotes: 'pt reports pain 5/10, ROM improving, strength getting better',
    ...overrides,
  };
  for (const [key, value] of Object.entries(defaults)) {
    data.set(key, value);
  }
  return data;
}

function makeFormDataWithOptionals(overrides: Record<string, string | undefined> = {}): FormData {
  const data = new FormData();
  data.set('noteType', 'daily_note');
  data.set('quickNotes', 'pt reports pain 5/10, ROM improving, strength getting better');
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) data.set(key, value);
  }
  return data;
}

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

function createGenerateResult(overrides: Partial<GeneratedNoteResult> = {}): GeneratedNoteResult {
  return {
    subjective: 'Patient reports pain 4/10.',
    objective: 'ROM: Flexion 60°.',
    assessment: 'Progressing well.',
    plan: 'Continue PT 2x/week.',
    billing: { suggestedCodes: [{ cptCode: '97110', description: 'Therapeutic Exercise' }] },
    alerts: ['Check billing codes.'],
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
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(createSession());
    mockGetRequestContext.mockResolvedValue({ ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' });
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 30, remaining: 29, reset: 0 });
    mockCheckSubscriptionAccess.mockResolvedValue({ allowed: true });
    mockGenerateNote.mockResolvedValue(createGenerateResult());
    mockIncrementUsage.mockResolvedValue(undefined);
    mockAuditLog.mockResolvedValue(undefined);
  });

  // --- Validation ---

  it('returns validation_error with fieldErrors for invalid input', async () => {
    const result = await generateNoteAction(makeFormData({ quickNotes: 'short' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation_error');
      expect(result.fieldErrors).toBeDefined();
      // Verify field errors are sanitized (field names preserved, messages generic)
      expect(result.fieldErrors?.quickNotes).toBeDefined();       // Field name preserved
      expect(result.fieldErrors?.quickNotes?.[0]).toBe('Validation failed');  // Generic message
      // Verify no Zod-specific messages
      expect(result.fieldErrors?.quickNotes?.[0]).not.toContain('Please provide more detail');
    }
  });

  it('returns validation_error with fieldErrors for missing noteType', async () => {
    const fd = new FormData();
    fd.set('quickNotes', 'pt reports pain 5/10, ROM improving');
    const result = await generateNoteAction(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation_error');
      expect(result.fieldErrors).toBeDefined();
      expect(result.fieldErrors?.noteType).toBeDefined();
    }
  });

  it('returns validation_error with fieldErrors for invalid noteType', async () => {
    const result = await generateNoteAction(makeFormData({ noteType: 'invalid_type' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation_error');
      expect(result.fieldErrors).toBeDefined();
    }
  });

  it('rejects whitespace-only input for quickNotes', async () => {
    const result = await generateNoteAction(makeFormData({ quickNotes: '     ' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation_error');
      expect(result.fieldErrors?.quickNotes).toBeDefined();  // Field name preserved
      expect(result.fieldErrors?.quickNotes?.[0]).toBe('Validation failed');
    }
  });

  it('accepts patientContext after trimming', async () => {
    const result = await generateNoteAction(makeFormData({
      patientContext: '  65 y/o female  ',
      quickNotes: 'valid text with more than ten characters'
    }));
    expect(result.success).toBe(true);
    expect(mockGenerateNote).toHaveBeenCalledWith(
      'valid text with more than ten characters',
      'daily_note',
      '65 y/o female'  // Should be trimmed
    );
  });

  it('accepts quickNotes after trimming', async () => {
    const result = await generateNoteAction(makeFormData({
      quickNotes: '  pt reports improvement in strength and balance  '
    }));
    expect(result.success).toBe(true);
    // Verify the trimmed value was passed to generateNote
    expect(mockGenerateNote).toHaveBeenCalledWith(
      'pt reports improvement in strength and balance',  // Trimmed
      'daily_note',
      undefined
    );
  });

  // --- Auth ---

  it('returns unauthenticated when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await generateNoteAction(makeFormData());
    expect(result).toEqual({ success: false, error: 'unauthenticated' });
  });

  it('returns email_not_verified when email not verified', async () => {
    mockGetSession.mockResolvedValue(createSession({ emailVerified: false }));
    const result = await generateNoteAction(makeFormData());
    expect(result).toEqual({ success: false, error: 'email_not_verified' });
  });

  // --- Subscription ---

  it('returns trial_expired when subscription check fails', async () => {
    mockCheckSubscriptionAccess.mockResolvedValue({ allowed: false, reason: 'trial_expired' });
    const result = await generateNoteAction(makeFormData());
    expect(result).toEqual({ success: false, error: 'trial_expired' });
  });

  it('returns subscription_required when no subscription', async () => {
    mockCheckSubscriptionAccess.mockResolvedValue({ allowed: false, reason: 'subscription_required' });
    const result = await generateNoteAction(makeFormData());
    expect(result).toEqual({ success: false, error: 'subscription_required' });
  });

  it('returns clinic_subscription_expired for org denial', async () => {
    mockCheckSubscriptionAccess.mockResolvedValue({ allowed: false, reason: 'clinic_subscription_expired' });
    const result = await generateNoteAction(makeFormData());
    expect(result).toEqual({ success: false, error: 'clinic_subscription_expired' });
  });

  it('logs ACCESS_DENIED audit when trial is expired (Fix 5 / HIPAA)', async () => {
    mockGetSession.mockResolvedValueOnce(createSession({
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(0),
    }));
    mockGetRequestContext.mockResolvedValueOnce({ ipAddress: '127.0.0.1', userAgent: 'TestAgent' });
    mockCheckSubscriptionAccess.mockResolvedValueOnce({ allowed: false, reason: 'trial_expired' });

    const result = await generateNoteAction(makeFormData());

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('trial_expired');
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
  });

  it('uses IP:userId compound key for rate limiting', async () => {
    await generateNoteAction(makeFormData());
    expect(mockCheckRateLimit).toHaveBeenCalledWith('mock-limiter', '127.0.0.1:user-1');
  });

  // --- Successful generation ---

  it('logs note generation start at info level', async () => {
    const result = await generateNoteAction(makeFormData());
    expect(result.success).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'action_generate_note', userId: expect.any(String), noteType: expect.any(String) }),
      'Note generation started'
    );
  });

  it('logs note generation completion at info level', async () => {
    const result = await generateNoteAction(makeFormData());
    expect(result.success).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'action_generate_note', userId: expect.any(String), durationMs: expect.any(Number) }),
      'Note generation completed'
    );
  });

  it('returns SOAP note on success', async () => {
    const result = await generateNoteAction(makeFormData());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subjective).toBe('Patient reports pain 4/10.');
      expect(result.data.objective).toBe('ROM: Flexion 60°.');
      expect(result.data.assessment).toBe('Progressing well.');
      expect(result.data.plan).toBe('Continue PT 2x/week.');
    }
  });

  it('includes billing, alerts, and metadata in response', async () => {
    const result = await generateNoteAction(makeFormData());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.billing).toBeDefined();
      expect(result.data.alerts).toEqual(['Check billing codes.']);
      expect(result.data.metadata.generationTimeMs).toBe(1500);
    }
  });

  it('strips model and token counts from response (security)', async () => {
    const result = await generateNoteAction(makeFormData());

    expect(result.success).toBe(true);
    if (result.success) {
      // metadata should only have generationTimeMs + optional modality/duration, not model/tokens
      expect(result.data.metadata).toEqual({ generationTimeMs: 1500, modality: undefined, duration: undefined });
      expect((result.data.metadata as Record<string, unknown>)['model']).toBeUndefined();
      expect((result.data.metadata as Record<string, unknown>)['inputTokens']).toBeUndefined();
    }
  });

  it('passes patientContext to generateNote when provided', async () => {
    await generateNoteAction(makeFormData({ patientContext: '65 y/o female' }));

    expect(mockGenerateNote).toHaveBeenCalledWith(
      expect.any(String),
      'daily_note',
      '65 y/o female'
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
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('validation_error');
    }
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
    const result = await generateNoteAction(makeFormDataWithOptionals({ modality: 'in_person' }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.modality).toBe('in_person');
    }
  });

  it('includes duration in response metadata', async () => {
    const result = await generateNoteAction(makeFormDataWithOptionals({ duration: '45' }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.duration).toBe(45);
    }
  });

  it('includes modality and duration in audit metadata', async () => {
    await generateNoteAction(makeFormDataWithOptionals({ modality: 'telehealth', duration: '60' }));

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
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata.modality).toBeUndefined();
      expect(result.data.metadata.duration).toBeUndefined();
    }
  });
});
