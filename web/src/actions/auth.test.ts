import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (vi.hoisted ensures declarations are available when vi.mock factories run) ---

const mockRedirect = vi.hoisted(() => vi.fn());
const mockLogin = vi.hoisted(() => vi.fn());
const mockRegister = vi.hoisted(() => vi.fn());
const mockCompletePasswordReset = vi.hoisted(() => vi.fn());
const mockVerifyEmail = vi.hoisted(() => vi.fn());
const mockIsTokenValid = vi.hoisted(() => vi.fn());
const mockFindUserIdFromToken = vi.hoisted(() => vi.fn());
const mockCreateToken = vi.hoisted(() => vi.fn());
const mockSendVerificationEmail = vi.hoisted(() => vi.fn());
const mockSendPasswordResetEmail = vi.hoisted(() => vi.fn());
const mockSetSessionCookie = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockClearSessionCookie = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetSession = vi.hoisted(() => vi.fn());
const mockFindUserByEmail = vi.hoisted(() => vi.fn());
const mockFindUserById = vi.hoisted(() => vi.fn());
const mockDeleteSession = vi.hoisted(() => vi.fn());
const mockFindByCode = vi.hoisted(() => vi.fn());
const mockValidateCodeRedeemable = vi.hoisted(() => vi.fn());
const mockAuditLog = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error('NEXT_REDIRECT');
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => {
      if (name === 'x-forwarded-for') return '127.0.0.1';
      if (name === 'user-agent') return 'TestAgent/1.0';
      return null;
    },
  }),
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock('@/server/services/auth', () => ({
  login: mockLogin,
  register: mockRegister,
  completePasswordReset: mockCompletePasswordReset,
  verifyEmail: mockVerifyEmail,
}));

vi.mock('@/server/services/token', () => ({
  isTokenValid: mockIsTokenValid,
  findUserIdFromToken: mockFindUserIdFromToken,
  createToken: mockCreateToken,
}));

vi.mock('@/server/services/email', () => ({
  sendVerificationEmail: mockSendVerificationEmail,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

vi.mock('@/server/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 0, remaining: 0, reset: 0 }),
  rateLimitKey: (ip: string, id?: string) => id ? `${ip}:${id}` : ip,
  loginRateLimit: null,
  registerRateLimit: null,
  verificationCompleteRateLimit: null,
  verificationResendRateLimit: null,
  passwordResetRequestRateLimit: null,
  passwordResetCompleteRateLimit: null,
  passwordResetValidateRateLimit: null,
  inviteCodeValidateRateLimit: null,
}));

vi.mock('@/server/lib/session-cookie', () => ({
  setSessionCookie: mockSetSessionCookie,
  clearSessionCookie: mockClearSessionCookie,
  getSessionToken: vi.fn().mockResolvedValue(null),
  hashSessionToken: vi.fn().mockReturnValue('hash'),
}));

vi.mock('@/server/lib/get-session', () => ({
  getSession: mockGetSession,
}));

vi.mock('@/server/dal/users', () => ({
  findUserByEmail: mockFindUserByEmail,
  findUserById: mockFindUserById,
}));

vi.mock('@/server/dal/sessions', () => ({
  deleteSession: mockDeleteSession,
}));

vi.mock('@/server/dal/invite-codes', () => ({
  findByCode: mockFindByCode,
  validateCodeRedeemable: mockValidateCodeRedeemable,
}));

vi.mock('@/server/services/audit', () => ({
  auditService: { log: mockAuditLog },
}));

vi.mock('@/server/db/config', () => ({
  config: {
    REGISTRATION_MODE: 'open',
    WEB_URL: 'http://localhost:3000',
    EMAIL_FROM_NAME: 'FlashNote',
    EMAIL_FROM_ADDRESS: 'noreply@flashnote.test',
  },
}));

import {
  loginAction,
  registerAction,
  logoutAction,
  expireSessionAction,
  requestPasswordResetAction,
  resetPasswordAction,
  verifyEmailAction,
  resendVerificationAction,
  validateResetTokenAction,
  validateInviteCodeAction,
} from './auth';

import { checkRateLimit } from '@/server/lib/rate-limit';
import { config } from '@/server/db/config';

function toFormData(obj: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(obj)) {
    fd.append(key, value);
  }
  return fd;
}

describe('auth actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.mockResolvedValue(undefined);
  });

  describe('loginAction', () => {
    it('rejects invalid input', async () => {
      const result = await loginAction(toFormData({ email: 'not-an-email', password: '' }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('validation_error');
        expect(result.fieldErrors).toBeDefined();
      }
    });

    it('returns rate_limit_exceeded when rate limited', async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        success: false, limit: 5, remaining: 0, reset: Date.now(),
      });

      const result = await loginAction(toFormData({ email: 'a@b.com', password: 'pass' }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('rate_limit_exceeded');
      }
    });

    it('sets cookie on successful login', async () => {
      mockLogin.mockResolvedValueOnce({
        success: true,
        user: { id: 'u-1', email: 'a@b.com', subscriptionStatus: 'trialing', trialEndsAt: new Date(), emailVerified: true, organizationId: null },
        token: 'session-token',
        emailVerificationRequired: false,
      });

      const result = await loginAction(toFormData({ email: 'a@b.com', password: 'pass' }));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.emailVerificationRequired).toBe(false);
      }
      expect(mockSetSessionCookie).toHaveBeenCalledWith('session-token');
    });

    it('returns error code on failed login', async () => {
      mockLogin.mockResolvedValueOnce({ success: false, error: 'invalid_credentials' });

      const result = await loginAction(toFormData({ email: 'a@b.com', password: 'wrong' }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_credentials');
      }
    });

    it('normalizes email in rate limit key to prevent case-variant bypass', async () => {
      mockLogin.mockResolvedValue({ success: false, error: 'invalid_credentials' });

      await loginAction(toFormData({ email: 'User@Example.COM', password: 'pass' }));

      expect(checkRateLimit).toHaveBeenCalledWith(
        null, // loginRateLimit mock
        '127.0.0.1:user@example.com'
      );
    });

    it('fires LOGIN_FAILED audit with emailProvided, not email (H-4)', async () => {
      mockLogin.mockResolvedValueOnce({ success: false, error: 'invalid_credentials' });

      await loginAction(toFormData({ email: 'a@b.com', password: 'wrong' }));

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          metadata: { emailProvided: true },
        })
      );
      // Verify no email in audit metadata
      const auditCall = mockAuditLog.mock.calls.find(
        (c: unknown[]) => (c[0] as Record<string, unknown>).action === 'LOGIN_FAILED'
      );
      expect(auditCall).toBeDefined();
      expect((auditCall![0] as Record<string, unknown>).metadata).not.toHaveProperty('email');
    });
  });

  describe('registerAction', () => {
    it('rejects invalid input', async () => {
      const result = await registerAction(toFormData({ email: 'bad', password: 'x' }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('validation_error');
      }
    });

    it('sets cookie on successful registration', async () => {
      mockRegister.mockResolvedValueOnce({
        success: true,
        user: { id: 'u-1', email: 'a@b.com', subscriptionStatus: 'trialing', trialEndsAt: new Date(), emailVerified: false, organizationId: null },
        token: 'new-session-token',
      });

      const result = await registerAction(toFormData({
        email: 'a@b.com',
        password: 'Password1',
        confirmPassword: 'Password1',
        acceptedLegalTerms: 'true',
      }));

      expect(result.success).toBe(true);
      expect(mockSetSessionCookie).toHaveBeenCalledWith('new-session-token');
    });

    it('maps email_exists to generic registration_failed (anti-enumeration)', async () => {
      mockRegister.mockResolvedValueOnce({ success: false, error: 'email_exists' });

      const result = await registerAction(toFormData({
        email: 'a@b.com',
        password: 'Password1',
        confirmPassword: 'Password1',
        acceptedLegalTerms: 'true',
      }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('registration_failed');
      }
    });

    it('passes through actionable error codes (invalid_invite_code)', async () => {
      mockRegister.mockResolvedValueOnce({ success: false, error: 'invalid_invite_code' });

      const result = await registerAction(toFormData({
        email: 'a@b.com',
        password: 'Password1',
        confirmPassword: 'Password1',
        acceptedLegalTerms: 'true',
      }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_invite_code');
      }
    });

    it('passes through actionable error codes (no_seats_available)', async () => {
      mockRegister.mockResolvedValueOnce({ success: false, error: 'no_seats_available' });

      const result = await registerAction(toFormData({
        email: 'a@b.com',
        password: 'Password1',
        confirmPassword: 'Password1',
        acceptedLegalTerms: 'true',
      }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('no_seats_available');
      }
    });
  });

  describe('logoutAction', () => {
    it('deletes current session only and clears cookie', async () => {
      mockGetSession.mockResolvedValueOnce({
        sessionId: 'session-1',
        userId: 'user-1',
        email: 'a@b.com',
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date(),
        emailVerified: true,
        organizationId: null,
      });
      mockDeleteSession.mockResolvedValueOnce(undefined);

      // redirect throws, so catch it
      await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

      // Deletes the specific session, not all sessions
      expect(mockDeleteSession).toHaveBeenCalledWith('session-1');
      expect(mockClearSessionCookie).toHaveBeenCalled();
      expect(mockRedirect).toHaveBeenCalledWith('/login');
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGOUT',
          status: 'SUCCESS',
        })
      );
    });

    it('still clears cookie and redirects when deleteSession fails, audits FAILURE', async () => {
      mockGetSession.mockResolvedValueOnce({
        sessionId: 'session-1',
        userId: 'user-1',
        email: 'a@b.com',
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date(),
        emailVerified: true,
        organizationId: null,
      });
      mockDeleteSession.mockRejectedValueOnce(new Error('db error'));

      await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

      expect(mockClearSessionCookie).toHaveBeenCalled();
      expect(mockRedirect).toHaveBeenCalledWith('/login');
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LOGOUT',
          status: 'FAILURE',
          metadata: { reason: 'session_deletion_failed' },
        })
      );
    });

    it('just clears cookie and redirects when no session', async () => {
      mockGetSession.mockResolvedValueOnce(null);

      await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

      expect(mockDeleteSession).not.toHaveBeenCalled();
      expect(mockClearSessionCookie).toHaveBeenCalled();
    });
  });

  describe('expireSessionAction', () => {
    it('clears cookie and redirects with reason', async () => {
      await expect(expireSessionAction('session_expired')).rejects.toThrow('NEXT_REDIRECT');
      expect(mockClearSessionCookie).toHaveBeenCalledTimes(1);
      expect(mockRedirect).toHaveBeenCalledWith('/login?reason=session_expired');
    });

    it('encodes reason in URL', async () => {
      await expect(expireSessionAction('session_limit')).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/login?reason=session_limit');
    });
  });

  describe('requestPasswordResetAction', () => {
    it('always returns success (anti-enumeration)', async () => {
      // User exists
      mockFindUserByEmail.mockResolvedValueOnce({ id: 'u-1' });
      mockCreateToken.mockResolvedValueOnce('reset-token');
      mockSendPasswordResetEmail.mockResolvedValueOnce(undefined);

      const result = await requestPasswordResetAction(toFormData({ email: 'a@b.com' }));
      expect(result.success).toBe(true);
    });

    it('returns success even when user does not exist', async () => {
      mockFindUserByEmail.mockResolvedValueOnce(null);

      const result = await requestPasswordResetAction(toFormData({ email: 'nobody@b.com' }));
      expect(result.success).toBe(true);
    });

    it('audits FAILURE when sendPasswordResetEmail throws', async () => {
      mockFindUserByEmail.mockResolvedValueOnce({ id: 'u-1' });
      mockCreateToken.mockResolvedValueOnce('reset-token');
      mockSendPasswordResetEmail.mockRejectedValueOnce(new Error('email error'));

      const result = await requestPasswordResetAction(toFormData({ email: 'a@b.com' }));

      expect(result.success).toBe(true); // anti-enumeration
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_RESET_REQUESTED',
          status: 'FAILURE',
          metadata: { reason: 'token_or_email_failed' },
        })
      );
    });

    it('audits FAILURE when createToken throws', async () => {
      mockFindUserByEmail.mockResolvedValueOnce({ id: 'u-1' });
      mockCreateToken.mockRejectedValueOnce(new Error('db error'));

      const result = await requestPasswordResetAction(toFormData({ email: 'a@b.com' }));

      expect(result.success).toBe(true); // anti-enumeration
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_RESET_REQUESTED',
          status: 'FAILURE',
          metadata: { reason: 'token_or_email_failed' },
        })
      );
    });
  });

  describe('resetPasswordAction', () => {
    it('returns reset_failed for invalid token', async () => {
      mockCompletePasswordReset.mockResolvedValueOnce({ success: false, error: 'invalid_token' });

      const result = await resetPasswordAction(toFormData({
        token: 'expired',
        password: 'NewPass123',
        confirmPassword: 'NewPass123',
      }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('reset_failed');
      }
      // Audit with TOKEN_INVALID action for token errors
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_RESET_TOKEN_INVALID',
          status: 'FAILURE',
          metadata: { reason: 'invalid_token' },
        })
      );
    });

    it('returns reset_failed and audits PASSWORD_RESET_FAILED when service returns not_found', async () => {
      mockCompletePasswordReset.mockResolvedValueOnce({ success: false, error: 'not_found' });

      const result = await resetPasswordAction(toFormData({
        token: 'valid-token',
        password: 'NewPass123',
        confirmPassword: 'NewPass123',
      }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('reset_failed');
      }
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_RESET_FAILED',
          status: 'FAILURE',
          metadata: { reason: 'not_found' },
        })
      );
    });

    it('passes token directly to completePasswordReset', async () => {
      mockCompletePasswordReset.mockResolvedValueOnce({ success: true, userId: 'user-1' });

      await resetPasswordAction(toFormData({
        token: 'my-token',
        password: 'NewPass123',
        confirmPassword: 'NewPass123',
      }));

      expect(mockCompletePasswordReset).toHaveBeenCalledWith(
        'my-token',
        'NewPass123',
        expect.objectContaining({ ipAddress: '127.0.0.1' })
      );
    });

    it('completes password reset for valid token', async () => {
      mockCompletePasswordReset.mockResolvedValueOnce({ success: true, userId: 'user-1' });

      const result = await resetPasswordAction(toFormData({
        token: 'valid-token',
        password: 'NewPass123',
        confirmPassword: 'NewPass123',
      }));

      expect(result.success).toBe(true);
    });
  });

  describe('verifyEmailAction', () => {
    it('verifies email for valid token via verifyEmail service', async () => {
      mockVerifyEmail.mockResolvedValueOnce('user-1');

      const result = await verifyEmailAction(toFormData({ token: 'valid' }));

      expect(result.success).toBe(true);
      expect(mockVerifyEmail).toHaveBeenCalledWith('valid');
    });

    it('returns alreadyVerified for used token if user is verified', async () => {
      mockVerifyEmail.mockResolvedValueOnce(null); // token consumed/invalid
      mockFindUserIdFromToken.mockResolvedValueOnce('user-1');
      mockFindUserById.mockResolvedValueOnce({ emailVerified: true });

      const result = await verifyEmailAction(toFormData({ token: 'used' }));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.alreadyVerified).toBe(true);
      }
    });

    it('returns invalid_token for truly invalid token', async () => {
      mockVerifyEmail.mockResolvedValueOnce(null);
      mockFindUserIdFromToken.mockResolvedValueOnce(null);

      const result = await verifyEmailAction(toFormData({ token: 'garbage' }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_token');
      }
    });

    it('audits EMAIL_VERIFICATION_SUCCESS on success', async () => {
      mockVerifyEmail.mockResolvedValueOnce('user-1');

      await verifyEmailAction(toFormData({ token: 'valid' }));

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'EMAIL_VERIFICATION_SUCCESS',
          status: 'SUCCESS',
        })
      );
    });
  });

  describe('resendVerificationAction', () => {
    it('always returns success (anti-enumeration)', async () => {
      mockFindUserByEmail.mockResolvedValueOnce(null);

      const result = await resendVerificationAction(toFormData({ email: 'nobody@b.com' }));
      expect(result.success).toBe(true);
    });

    it('sends email for unverified user', async () => {
      mockFindUserByEmail.mockResolvedValueOnce({ id: 'u-1', emailVerified: false });
      mockCreateToken.mockResolvedValueOnce('verify-token');
      mockSendVerificationEmail.mockResolvedValueOnce(undefined);

      const result = await resendVerificationAction(toFormData({ email: 'a@b.com' }));

      expect(result.success).toBe(true);
      expect(mockSendVerificationEmail).toHaveBeenCalled();
    });

    it('audits FAILURE when sendVerificationEmail throws', async () => {
      mockFindUserByEmail.mockResolvedValueOnce({ id: 'u-1', emailVerified: false });
      mockCreateToken.mockResolvedValueOnce('verify-token');
      mockSendVerificationEmail.mockRejectedValueOnce(new Error('email error'));

      const result = await resendVerificationAction(toFormData({ email: 'a@b.com' }));

      expect(result.success).toBe(true); // anti-enumeration
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EMAIL_VERIFICATION_RESENT',
          status: 'FAILURE',
          metadata: { reason: 'token_or_email_failed' },
        })
      );
    });
  });

  describe('validateResetTokenAction', () => {
    it('returns valid: true for valid token', async () => {
      mockIsTokenValid.mockResolvedValueOnce(true);

      const result = await validateResetTokenAction('valid-token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.valid).toBe(true);
      }
    });

    it('returns valid: false for invalid token', async () => {
      mockIsTokenValid.mockResolvedValueOnce(false);

      const result = await validateResetTokenAction('bad-token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.valid).toBe(false);
      }
    });

    it('returns valid: false for empty token', async () => {
      const result = await validateResetTokenAction('');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.valid).toBe(false);
      }
    });

    it('returns rate_limit_exceeded when rate limited', async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce({
        success: false, limit: 5, remaining: 0, reset: Date.now(),
      });

      const result = await validateResetTokenAction('some-token');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('rate_limit_exceeded');
      }
    });
  });

  describe('validateInviteCodeAction', () => {
    it('returns valid: false when not in invite mode', async () => {
      // config.REGISTRATION_MODE is 'open' (default mock)
      const result = await validateInviteCodeAction(toFormData({ code: 'ABC123' }));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.valid).toBe(false);
      }
    });

    it('returns valid: true for a redeemable code in invite mode', async () => {
      const original = config.REGISTRATION_MODE;
      (config as { REGISTRATION_MODE: string }).REGISTRATION_MODE = 'invite';

      try {
        mockFindByCode.mockResolvedValueOnce({ id: 'code-1', type: 'personal', organizationId: null });
        mockValidateCodeRedeemable.mockReturnValueOnce(null); // null = redeemable

        const result = await validateInviteCodeAction(toFormData({ code: 'VALID1' }));

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data?.valid).toBe(true);
          expect(result.data?.type).toBe('personal');
        }
        expect(mockAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'INVITE_CODE_VALIDATED' })
        );
      } finally {
        (config as { REGISTRATION_MODE: string }).REGISTRATION_MODE = original;
      }
    });

    it('returns valid: false for an expired code in invite mode', async () => {
      const original = config.REGISTRATION_MODE;
      (config as { REGISTRATION_MODE: string }).REGISTRATION_MODE = 'invite';

      try {
        mockFindByCode.mockResolvedValueOnce({ id: 'code-2', type: 'personal', organizationId: null });
        mockValidateCodeRedeemable.mockReturnValueOnce('expired'); // non-null = not redeemable

        const result = await validateInviteCodeAction(toFormData({ code: 'EXPIRED' }));

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data?.valid).toBe(false);
        }
        expect(mockAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'INVITE_CODE_VALIDATION_FAILED' })
        );
      } finally {
        (config as { REGISTRATION_MODE: string }).REGISTRATION_MODE = original;
      }
    });

    it('returns valid: false for a nonexistent code in invite mode', async () => {
      const original = config.REGISTRATION_MODE;
      (config as { REGISTRATION_MODE: string }).REGISTRATION_MODE = 'invite';

      try {
        mockFindByCode.mockResolvedValueOnce(null);

        const result = await validateInviteCodeAction(toFormData({ code: 'NOPE00' }));

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data?.valid).toBe(false);
        }
      } finally {
        (config as { REGISTRATION_MODE: string }).REGISTRATION_MODE = original;
      }
    });
  });
});
