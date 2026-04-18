import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditAction } from '@/server/types';

// ---------------------------------------------------------------------------
// Hoisted mocks (avoid top-level await + let us reset between tests)
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
  archivePatient: vi.fn(),
  getSession: vi.fn(),
  checkRateLimit: vi.fn(),
  getRequestContext: vi.fn(),
  auditLog: vi.fn(),
  auditLogWithClient: vi.fn(),
  redirect: vi.fn((_path: string) => {
    // Next.js' redirect() throws a NEXT_REDIRECT error. Replicate that so the
    // Server Action's "post-commit redirect" path is observable in tests.
    const err = new Error('NEXT_REDIRECT');
    (err as Error & { digest?: string }).digest = 'NEXT_REDIRECT';
    throw err;
  }),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  sanitizeFieldErrors: vi.fn(
    (
      errors: Record<string, string[]>,
      _allowed?: string[],
    ): Record<string, string[]> => {
      const out: Record<string, string[]> = {};
      for (const key of Object.keys(errors)) {
        out[key] = ['Validation failed'];
      }
      return out;
    },
  ),
  poolClient: {
    query: vi.fn(),
    release: vi.fn(),
  },
  getPoolClient: vi.fn(),
}));

vi.mock('@/server/dal', () => ({
  createPatient: h.createPatient,
  updatePatient: h.updatePatient,
  archivePatient: h.archivePatient,
}));

vi.mock('@/server/lib/get-session', () => ({
  getSession: h.getSession,
}));

vi.mock('@/server/lib/rate-limit', () => ({
  apiRateLimit: {},
  checkRateLimit: h.checkRateLimit,
}));

vi.mock('@/server/lib/request-context', () => ({
  getRequestContext: h.getRequestContext,
}));

vi.mock('@/server/services/audit', () => ({
  auditService: {
    log: h.auditLog,
    logWithClient: h.auditLogWithClient,
  },
}));

vi.mock('@/server/lib/logger', () => ({
  logger: h.logger,
}));

vi.mock('@/server/lib/validation', () => ({
  sanitizeFieldErrors: h.sanitizeFieldErrors,
}));

vi.mock('@/server/db', () => ({
  getPoolClient: h.getPoolClient,
}));

vi.mock('next/navigation', () => ({
  redirect: h.redirect,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  createPatientAction,
  updatePatientAction,
  archivePatientAction,
  updatePatientContextAction,
} from './patients';
import { createMockPatient } from '@/test/factories/patient-factory';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000002';
const PATIENT_ID = '11111111-1111-1111-1111-111111111111';

function validSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sessionId: 'session-id',
    userId: USER_ID,
    email: 'pt@example.com',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(),
    emailVerified: true,
    organizationId: null,
    ...overrides,
  };
}

function buildCreateFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('firstName', 'Jane');
  fd.set('lastName', 'Doe');
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

// ---------------------------------------------------------------------------
// Shared beforeEach — reset + sane defaults (happy-path-ready)
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Mock the PoolClient returned by getPoolClient — reset between tests.
  h.poolClient.query.mockReset();
  h.poolClient.query.mockResolvedValue({ rows: [] });
  h.poolClient.release.mockReset();
  h.getPoolClient.mockResolvedValue(h.poolClient);

  h.getSession.mockResolvedValue(validSession());
  h.checkRateLimit.mockResolvedValue({
    success: true,
    limit: 100,
    remaining: 99,
    reset: 0,
  });
  h.getRequestContext.mockResolvedValue({
    ipAddress: '127.0.0.1',
    userAgent: 'TestAgent',
  });
  h.auditLogWithClient.mockResolvedValue(undefined);
});

// ===========================================================================
// createPatientAction
// ===========================================================================

describe('createPatientAction', () => {
  it('returns unauthenticated when session is null', async () => {
    h.getSession.mockResolvedValueOnce(null);
    const res = await createPatientAction(buildCreateFormData());
    expect(res).toEqual({ success: false, error: 'unauthenticated' });
    expect(h.getPoolClient).not.toHaveBeenCalled();
  });

  it('returns unauthenticated when email not verified', async () => {
    h.getSession.mockResolvedValueOnce(validSession({ emailVerified: false }));
    const res = await createPatientAction(buildCreateFormData());
    expect(res).toEqual({ success: false, error: 'unauthenticated' });
    expect(h.getPoolClient).not.toHaveBeenCalled();
  });

  it('returns rate_limit_exceeded when limiter denies', async () => {
    h.checkRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: 0,
    });
    const res = await createPatientAction(buildCreateFormData());
    expect(res).toEqual({ success: false, error: 'rate_limit_exceeded' });
    expect(h.getPoolClient).not.toHaveBeenCalled();
  });

  it('returns validation_error with sanitized fieldErrors when schema fails', async () => {
    const fd = new FormData(); // missing firstName/lastName
    const res = await createPatientAction(fd);
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toBe('validation_error');
    expect(res.fieldErrors).toBeDefined();
    // sanitizeFieldErrors was called with allow list including firstName/lastName
    expect(h.sanitizeFieldErrors).toHaveBeenCalled();
    const call = h.sanitizeFieldErrors.mock.calls[0];
    expect(call[1]).toEqual(
      expect.arrayContaining(['firstName', 'lastName', 'context']),
    );
    expect(h.getPoolClient).not.toHaveBeenCalled();
  });

  it('happy path: BEGIN → createPatient(client) → logWithClient(client) → COMMIT → release', async () => {
    const patient = createMockPatient({ id: PATIENT_ID });
    h.createPatient.mockResolvedValueOnce(patient);

    const res = await createPatientAction(buildCreateFormData());

    expect(res).toEqual({ success: true, data: { id: PATIENT_ID } });
    // Query order: BEGIN, COMMIT (the DAL query is mocked so only transactional
    // bookends are observable on the PoolClient)
    const queries = h.poolClient.query.mock.calls.map((c: unknown[]): unknown => c[0]);
    expect(queries[0]).toBe('BEGIN');
    expect(queries[queries.length - 1]).toBe('COMMIT');
    expect(queries).not.toContain('ROLLBACK');
    // DAL and audit received the same client instance (M-6)
    expect(h.createPatient).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      h.poolClient,
    );
    expect(h.auditLogWithClient).toHaveBeenCalledWith(
      h.poolClient,
      expect.objectContaining({
        action: AuditAction.PATIENT_CREATED,
        userId: USER_ID,
        metadata: { patientId: PATIENT_ID },
      }),
    );
    expect(h.poolClient.release).toHaveBeenCalledTimes(1);
  });

  it('does not leak PHI in metadata — only patientId is audited', async () => {
    const patient = createMockPatient({ id: PATIENT_ID });
    h.createPatient.mockResolvedValueOnce(patient);

    await createPatientAction(
      buildCreateFormData({
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '555-0100',
      }),
    );

    const auditCall = h.auditLogWithClient.mock.calls[0]?.[1];
    expect(auditCall?.metadata).toEqual({ patientId: PATIENT_ID });
    // Assert no PHI keys leaked
    const metaStr = JSON.stringify(auditCall?.metadata);
    expect(metaStr).not.toContain('Jane');
    expect(metaStr).not.toContain('Doe');
    expect(metaStr).not.toContain('555-0100');
  });

  it('ROLLBACK + internal_error when createPatient throws', async () => {
    const boom = new Error('INSERT RETURNING returned no rows');
    h.createPatient.mockRejectedValueOnce(boom);

    const res = await createPatientAction(buildCreateFormData());

    expect(res).toEqual({ success: false, error: 'internal_error' });
    const queries = h.poolClient.query.mock.calls.map((c: unknown[]): unknown => c[0]);
    expect(queries).toContain('BEGIN');
    expect(queries).toContain('ROLLBACK');
    expect(queries).not.toContain('COMMIT');
    expect(h.auditLogWithClient).not.toHaveBeenCalled();
    expect(h.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'action_create_patient',
        errorType: 'create_patient_failed',
        userId: USER_ID,
      }),
      'Create patient failed',
    );
    expect(h.poolClient.release).toHaveBeenCalled();
  });

  it('ROLLBACK + internal_error when logWithClient throws', async () => {
    h.createPatient.mockResolvedValueOnce(createMockPatient({ id: PATIENT_ID }));
    h.auditLogWithClient.mockRejectedValueOnce(new Error('FK violation'));

    const res = await createPatientAction(buildCreateFormData());

    expect(res).toEqual({ success: false, error: 'internal_error' });
    const queries = h.poolClient.query.mock.calls.map((c: unknown[]): unknown => c[0]);
    expect(queries).toContain('ROLLBACK');
    expect(queries).not.toContain('COMMIT');
    expect(h.poolClient.release).toHaveBeenCalled();
  });

  it('client is released even when ROLLBACK itself throws', async () => {
    h.createPatient.mockRejectedValueOnce(new Error('boom'));
    h.poolClient.query.mockImplementation((q: string) => {
      if (q === 'ROLLBACK') return Promise.reject(new Error('rollback failed'));
      return Promise.resolve({ rows: [] });
    });

    const res = await createPatientAction(buildCreateFormData());

    expect(res).toEqual({ success: false, error: 'internal_error' });
    expect(h.poolClient.release).toHaveBeenCalled();
  });

  it('passes organizationId to createPatient when session has org', async () => {
    h.getSession.mockResolvedValueOnce(
      validSession({ organizationId: 'org-1' }),
    );
    h.createPatient.mockResolvedValueOnce(createMockPatient({ id: PATIENT_ID }));

    await createPatientAction(buildCreateFormData());

    expect(h.createPatient).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, organizationId: 'org-1' }),
      expect.any(Object),
      h.poolClient,
    );
  });

  it('blank optional fields are normalized to absent (DAL stores NULL)', async () => {
    h.createPatient.mockResolvedValueOnce(createMockPatient({ id: PATIENT_ID }));
    const fd = buildCreateFormData({ phone: '', email: '', context: '' });
    await createPatientAction(fd);
    const [, input] = h.createPatient.mock.calls[0];
    expect(input.phone).toBeNull();
    expect(input.email).toBeNull();
    expect(input.context).toBeNull();
  });
});

// ===========================================================================
// updatePatientAction
// ===========================================================================

describe('updatePatientAction', () => {
  function buildUpdateFormData(
    overrides: Record<string, string> = { firstName: 'Renamed' },
  ): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it('returns unauthenticated when session is null', async () => {
    h.getSession.mockResolvedValueOnce(null);
    const res = await updatePatientAction(PATIENT_ID, buildUpdateFormData());
    expect(res).toEqual({ success: false, error: 'unauthenticated' });
  });

  it('returns patient_not_found when patientId is not a UUID', async () => {
    const res = await updatePatientAction('not-a-uuid', buildUpdateFormData());
    expect(res).toEqual({ success: false, error: 'patient_not_found' });
    expect(h.getPoolClient).not.toHaveBeenCalled();
  });

  it('happy path: BEGIN → updatePatient(client) → logWithClient(client) → COMMIT', async () => {
    const patient = createMockPatient({ id: PATIENT_ID, firstName: 'Renamed' });
    h.updatePatient.mockResolvedValueOnce(patient);

    const res = await updatePatientAction(
      PATIENT_ID,
      buildUpdateFormData({ firstName: 'Renamed', lastName: 'Doe' }),
    );

    expect(res.success).toBe(true);
    const queries = h.poolClient.query.mock.calls.map((c: unknown[]): unknown => c[0]);
    expect(queries[0]).toBe('BEGIN');
    expect(queries[queries.length - 1]).toBe('COMMIT');
    expect(h.updatePatient).toHaveBeenCalledWith(
      { type: 'user', userId: USER_ID },
      PATIENT_ID,
      expect.any(Object),
      h.poolClient,
    );
    expect(h.auditLogWithClient).toHaveBeenCalledWith(
      h.poolClient,
      expect.objectContaining({
        action: AuditAction.PATIENT_UPDATED,
        metadata: expect.objectContaining({
          patientId: PATIENT_ID,
          fields: expect.arrayContaining(['firstName', 'lastName']),
        }),
      }),
    );
    // Audit metadata.fields MUST only contain keys present in the input
    const call = h.auditLogWithClient.mock.calls[0]?.[1];
    expect(call?.metadata?.fields).toEqual(
      expect.arrayContaining(['firstName', 'lastName']),
    );
    expect(call?.metadata?.fields).not.toContain('phone');
  });

  it('audit metadata NEVER contains PHI field values', async () => {
    h.updatePatient.mockResolvedValueOnce(
      createMockPatient({ id: PATIENT_ID }),
    );
    await updatePatientAction(
      PATIENT_ID,
      buildUpdateFormData({ firstName: 'SensitiveName' }),
    );
    const call = h.auditLogWithClient.mock.calls[0]?.[1];
    const metaStr = JSON.stringify(call?.metadata);
    expect(metaStr).not.toContain('SensitiveName');
  });

  it('patient_not_found + ROLLBACK when DAL returns null (out-of-scope / archived)', async () => {
    h.updatePatient.mockResolvedValueOnce(null);

    const res = await updatePatientAction(PATIENT_ID, buildUpdateFormData());

    expect(res).toEqual({ success: false, error: 'patient_not_found' });
    const queries = h.poolClient.query.mock.calls.map((c: unknown[]): unknown => c[0]);
    expect(queries).toContain('ROLLBACK');
    expect(queries).not.toContain('COMMIT');
    expect(h.auditLogWithClient).not.toHaveBeenCalled();
    expect(h.poolClient.release).toHaveBeenCalled();
  });

  it('Rule 5/8: uses user scope derived from session (not a client-supplied scope)', async () => {
    h.getSession.mockResolvedValueOnce(validSession({ userId: USER_ID }));
    h.updatePatient.mockResolvedValueOnce(createMockPatient({ id: PATIENT_ID }));

    await updatePatientAction(PATIENT_ID, buildUpdateFormData());

    expect(h.updatePatient).toHaveBeenCalledWith(
      { type: 'user', userId: USER_ID },
      PATIENT_ID,
      expect.any(Object),
      h.poolClient,
    );
    expect(h.updatePatient).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: OTHER_USER_ID }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('ROLLBACK + internal_error when DAL throws', async () => {
    h.updatePatient.mockRejectedValueOnce(new Error('boom'));
    const res = await updatePatientAction(PATIENT_ID, buildUpdateFormData());
    expect(res).toEqual({ success: false, error: 'internal_error' });
    const queries = h.poolClient.query.mock.calls.map((c: unknown[]): unknown => c[0]);
    expect(queries).toContain('ROLLBACK');
    expect(h.logger.error).toHaveBeenCalled();
  });
});

// ===========================================================================
// archivePatientAction
// ===========================================================================

describe('archivePatientAction', () => {
  it('returns unauthenticated when session is null', async () => {
    h.getSession.mockResolvedValueOnce(null);
    const res = await archivePatientAction(PATIENT_ID);
    expect(res).toEqual({ success: false, error: 'unauthenticated' });
  });

  it('returns patient_not_found when patientId is not a UUID', async () => {
    const res = await archivePatientAction('nope');
    expect(res).toEqual({ success: false, error: 'patient_not_found' });
    expect(h.getPoolClient).not.toHaveBeenCalled();
  });

  it('returns rate_limit_exceeded when limiter denies', async () => {
    h.checkRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: 0,
    });
    const res = await archivePatientAction(PATIENT_ID);
    expect(res).toEqual({ success: false, error: 'rate_limit_exceeded' });
  });

  it('happy path: BEGIN → archivePatient(client) → logWithClient(client) → COMMIT → redirect', async () => {
    h.archivePatient.mockResolvedValueOnce(true);

    // On success the action throws NEXT_REDIRECT (via `redirect()`); callers
    // don't see `{ success: true }` on the happy path. Assert both the
    // redirect target and that BEGIN/COMMIT happened BEFORE the redirect (so
    // the transaction is durable before navigation).
    await expect(archivePatientAction(PATIENT_ID)).rejects.toMatchObject({
      message: 'NEXT_REDIRECT',
    });

    expect(h.redirect).toHaveBeenCalledWith('/dashboard/patients');
    const queries = h.poolClient.query.mock.calls.map((c: unknown[]): unknown => c[0]);
    expect(queries[0]).toBe('BEGIN');
    expect(queries).toContain('COMMIT');
    expect(queries).not.toContain('ROLLBACK');
    // Client released BEFORE redirect fires (redirect throws AFTER finally)
    expect(h.poolClient.release).toHaveBeenCalled();
    expect(h.archivePatient).toHaveBeenCalledWith(
      { type: 'user', userId: USER_ID },
      PATIENT_ID,
      h.poolClient,
    );
    expect(h.auditLogWithClient).toHaveBeenCalledWith(
      h.poolClient,
      expect.objectContaining({
        action: AuditAction.PATIENT_ARCHIVED,
        metadata: { patientId: PATIENT_ID },
      }),
    );
  });

  it('does NOT redirect when archive fails (returns error without navigation)', async () => {
    h.archivePatient.mockResolvedValueOnce(false);
    const res = await archivePatientAction(PATIENT_ID);
    expect(res).toEqual({ success: false, error: 'archive_failed' });
    expect(h.redirect).not.toHaveBeenCalled();
  });

  it('does NOT redirect when DAL throws (returns internal_error)', async () => {
    h.archivePatient.mockRejectedValueOnce(new Error('boom'));
    const res = await archivePatientAction(PATIENT_ID);
    expect(res).toEqual({ success: false, error: 'internal_error' });
    expect(h.redirect).not.toHaveBeenCalled();
  });

  it('archive_failed + ROLLBACK when DAL returns false (already archived / not found)', async () => {
    h.archivePatient.mockResolvedValueOnce(false);

    const res = await archivePatientAction(PATIENT_ID);

    expect(res).toEqual({ success: false, error: 'archive_failed' });
    const queries = h.poolClient.query.mock.calls.map((c: unknown[]): unknown => c[0]);
    expect(queries).toContain('ROLLBACK');
    expect(queries).not.toContain('COMMIT');
    expect(h.auditLogWithClient).not.toHaveBeenCalled();
  });

  it('ROLLBACK + internal_error when DAL throws', async () => {
    h.archivePatient.mockRejectedValueOnce(new Error('boom'));
    const res = await archivePatientAction(PATIENT_ID);
    expect(res).toEqual({ success: false, error: 'internal_error' });
    const queries = h.poolClient.query.mock.calls.map((c: unknown[]): unknown => c[0]);
    expect(queries).toContain('ROLLBACK');
    expect(h.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'action_archive_patient',
        errorType: 'archive_patient_failed',
      }),
      'Archive patient failed',
    );
  });
});

// ===========================================================================
// updatePatientContextAction
// ===========================================================================

describe('updatePatientContextAction', () => {
  it('returns unauthenticated when session is null', async () => {
    h.getSession.mockResolvedValueOnce(null);
    const res = await updatePatientContextAction(PATIENT_ID, 'new context');
    expect(res).toEqual({ success: false, error: 'unauthenticated' });
  });

  it('returns validation_error when context exceeds 2000 chars', async () => {
    const tooLong = 'a'.repeat(2001);
    const res = await updatePatientContextAction(PATIENT_ID, tooLong);
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error).toBe('validation_error');
    expect(h.getPoolClient).not.toHaveBeenCalled();
  });

  it('happy path: audit fields = ["context"] and returns updated patient', async () => {
    const updated = createMockPatient({ id: PATIENT_ID, context: 'hello' });
    h.updatePatient.mockResolvedValueOnce(updated);

    const res = await updatePatientContextAction(PATIENT_ID, 'hello');

    expect(res).toEqual({ success: true, data: { patient: updated } });
    expect(h.updatePatient).toHaveBeenCalledWith(
      { type: 'user', userId: USER_ID },
      PATIENT_ID,
      { context: 'hello' },
      h.poolClient,
    );
    const auditCall = h.auditLogWithClient.mock.calls[0]?.[1];
    expect(auditCall?.action).toBe(AuditAction.PATIENT_UPDATED);
    expect(auditCall?.metadata).toEqual({
      patientId: PATIENT_ID,
      fields: ['context'],
    });
    // Never log context VALUE — only the field name
    expect(JSON.stringify(auditCall?.metadata)).not.toContain('hello');
  });

  it('context_save_failed + ROLLBACK when DAL returns null', async () => {
    h.updatePatient.mockResolvedValueOnce(null);

    const res = await updatePatientContextAction(PATIENT_ID, 'hi');

    expect(res).toEqual({ success: false, error: 'context_save_failed' });
    const queries = h.poolClient.query.mock.calls.map((c: unknown[]): unknown => c[0]);
    expect(queries).toContain('ROLLBACK');
  });

  it('context_save_failed on DAL throw (mapped from internal error)', async () => {
    h.updatePatient.mockRejectedValueOnce(new Error('db down'));
    const res = await updatePatientContextAction(PATIENT_ID, 'hi');
    expect(res).toEqual({ success: false, error: 'context_save_failed' });
    const queries = h.poolClient.query.mock.calls.map((c: unknown[]): unknown => c[0]);
    expect(queries).toContain('ROLLBACK');
    expect(h.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'action_update_patient_context',
        errorType: 'context_save_failed',
      }),
      'Update patient context failed',
    );
  });

  it('allows context=null (clearing the value)', async () => {
    const updated = createMockPatient({ id: PATIENT_ID, context: null });
    h.updatePatient.mockResolvedValueOnce(updated);

    const res = await updatePatientContextAction(PATIENT_ID, null);

    expect(res).toEqual({ success: true, data: { patient: updated } });
    const [, id, input] = h.updatePatient.mock.calls[0];
    expect(id).toBe(PATIENT_ID);
    expect(input).toEqual({ context: null });
  });
});

// ===========================================================================
// M-6 regression guard — ALL transactional writes share a single client
// ===========================================================================

describe('M-6: transactional DAL + audit share the same PoolClient', () => {
  it('createPatientAction: DAL and audit receive the same client', async () => {
    h.createPatient.mockResolvedValueOnce(createMockPatient({ id: PATIENT_ID }));
    await createPatientAction(buildCreateFormData());
    const dalClient = h.createPatient.mock.calls[0]?.[2];
    const auditClient = h.auditLogWithClient.mock.calls[0]?.[0];
    expect(dalClient).toBe(h.poolClient);
    expect(auditClient).toBe(h.poolClient);
    expect(dalClient).toBe(auditClient);
  });

  it('updatePatientAction: DAL and audit receive the same client', async () => {
    h.updatePatient.mockResolvedValueOnce(createMockPatient({ id: PATIENT_ID }));
    const fd = new FormData();
    fd.set('firstName', 'Renamed');
    await updatePatientAction(PATIENT_ID, fd);
    const dalClient = h.updatePatient.mock.calls[0]?.[3];
    const auditClient = h.auditLogWithClient.mock.calls[0]?.[0];
    expect(dalClient).toBe(h.poolClient);
    expect(auditClient).toBe(h.poolClient);
  });

  it('archivePatientAction: DAL and audit receive the same client', async () => {
    h.archivePatient.mockResolvedValueOnce(true);
    // Success throws NEXT_REDIRECT — swallow it so we can inspect mock calls.
    await archivePatientAction(PATIENT_ID).catch(() => {
      /* expected NEXT_REDIRECT */
    });
    const dalClient = h.archivePatient.mock.calls[0]?.[2];
    const auditClient = h.auditLogWithClient.mock.calls[0]?.[0];
    expect(dalClient).toBe(h.poolClient);
    expect(auditClient).toBe(h.poolClient);
  });

  it('updatePatientContextAction: DAL and audit receive the same client', async () => {
    h.updatePatient.mockResolvedValueOnce(createMockPatient({ id: PATIENT_ID }));
    await updatePatientContextAction(PATIENT_ID, 'ctx');
    const dalClient = h.updatePatient.mock.calls[0]?.[3];
    const auditClient = h.auditLogWithClient.mock.calls[0]?.[0];
    expect(dalClient).toBe(h.poolClient);
    expect(auditClient).toBe(h.poolClient);
  });
});
