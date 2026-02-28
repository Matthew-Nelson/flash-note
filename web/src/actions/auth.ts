'use server';

import { redirect } from 'next/navigation';

import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  requestPasswordResetSchema,
  fullResetPasswordSchema,
  validateResetTokenSchema,
  validateInviteCodeSchema,
} from '@/lib/schemas/auth';
import { getSession } from '@/server/lib/get-session';
import { getRequestContext } from '@/server/lib/request-context';
import { setSessionCookie, clearSessionCookie } from '@/server/lib/session-cookie';
import {
  checkRateLimit,
  rateLimitKey,
  loginRateLimit,
  registerRateLimit,
  verificationCompleteRateLimit,
  verificationResendRateLimit,
  passwordResetRequestRateLimit,
  passwordResetCompleteRateLimit,
  passwordResetValidateRateLimit,
  inviteCodeValidateRateLimit,
} from '@/server/lib/rate-limit';
import { config } from '@/server/db/config';
import { login, register, completePasswordReset, verifyEmail } from '@/server/services/auth';
import type { SanitizedUser } from '@/server/services/auth';
import { isTokenValid, findUserIdFromToken, createToken } from '@/server/services/token';
import { sendVerificationEmail, sendPasswordResetEmail } from '@/server/services/email';
import { findUserByEmail, findUserById } from '@/server/dal/users';
import { deleteSession } from '@/server/dal/sessions';
import { findByCode, validateCodeRedeemable } from '@/server/dal/invite-codes';
import { auditService } from '@/server/services/audit';
import { AuditAction } from '@/server/types';
import type { SessionEndReason } from '@/lib/types';

// --- Result type ---

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// --- Actions ---

/**
 * Clear a stale session cookie and redirect to login with a session-end reason.
 * Used by dashboard layout when getSession() returns null but a cookie exists.
 * Must be a Server Action (not inline in a Server Component) because
 * Server Components cannot mutate cookies, and redirect() in streaming
 * context produces a meta-tag redirect that doesn't re-run the proxy.
 */
export async function expireSessionAction(reason: SessionEndReason): Promise<never> {
  await clearSessionCookie();
  redirect(`/login?reason=${encodeURIComponent(reason)}`);
}

export async function loginAction(formData: FormData): Promise<ActionResult<{ user: SanitizedUser; emailVerificationRequired: boolean }>> {
  const raw = Object.fromEntries(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'validation_error', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;
  const context = await getRequestContext();

  // Rate limit by IP:email (normalize to prevent case-variant bypass)
  const rl = await checkRateLimit(loginRateLimit, rateLimitKey(context.ipAddress ?? 'unknown', email.toLowerCase().trim()));
  if (!rl.success) {
    return { success: false, error: 'rate_limit_exceeded' };
  }

  const result = await login(email, password, context);

  if (!result.success) {
    // Audit failed login (fire-and-forget — auditService.log swallows errors)
    await auditService.log({
      userId: null,
      action: AuditAction.LOGIN_FAILED,
      status: 'FAILURE',
      metadata: { emailProvided: true },  // H-4: never log the email
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return { success: false, error: result.error };
  }

  // Audit successful login (fire-and-forget)
  await auditService.log({
    userId: result.user.id,
    action: AuditAction.LOGIN,
    status: 'SUCCESS',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  await setSessionCookie(result.token);

  return { success: true, data: { user: result.user, emailVerificationRequired: result.emailVerificationRequired } };
}

export async function registerAction(formData: FormData): Promise<ActionResult<{ user: SanitizedUser }>> {
  const raw = Object.fromEntries(formData);
  // FormData values are strings — convert boolean field before Zod parsing
  const input = {
    ...raw,
    acceptedLegalTerms: raw.acceptedLegalTerms === 'true' ? true : raw.acceptedLegalTerms,
  };
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'validation_error', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, password, inviteCode } = parsed.data;
  const context = await getRequestContext();

  // Rate limit by IP
  const rl = await checkRateLimit(registerRateLimit, context.ipAddress ?? 'unknown');
  if (!rl.success) {
    return { success: false, error: 'rate_limit_exceeded' };
  }

  // Registration gating
  if (config.REGISTRATION_MODE === 'closed') {
    return { success: false, error: 'registration_closed' };
  }

  const isInviteMode = config.REGISTRATION_MODE === 'invite';
  const normalizedCode = isInviteMode ? inviteCode?.trim().toUpperCase() : undefined;

  if (isInviteMode && !normalizedCode) {
    return { success: false, error: 'invite_code_required' };
  }

  // Pre-validate invite code (fast fail before expensive bcrypt)
  if (normalizedCode) {
    const code = await findByCode(normalizedCode);
    if (!code) {
      return { success: false, error: 'invalid_invite_code' };
    }
    const invalidReason = validateCodeRedeemable(code);
    if (invalidReason) {
      return { success: false, error: 'invalid_invite_code' };
    }
  }

  const result = await register(email, password, {
    ...context,
    inviteCode: normalizedCode,
  });

  if (!result.success) {
    // Map email_exists → generic code to prevent email enumeration;
    // pass through actionable errors (invalid_invite_code, no_seats_available)
    const error = result.error === 'email_exists' ? 'registration_failed' : result.error;
    return { success: false, error };
  }

  await setSessionCookie(result.token);

  return { success: true, data: { user: result.user } };
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  const context = await getRequestContext();

  if (session) {
    // Delete current session only (not all sessions)
    let sessionDeleted = false;
    try {
      await deleteSession(session.sessionId);
      sessionDeleted = true;
    } catch (error) {
      // TODO: Replace with Pino structured logger when available
      console.error('Failed to delete session during logout:', {
        sessionId: session.sessionId,
        userId: session.userId,
        errorType: error instanceof Error ? error.constructor.name : 'unknown',
      });
    }

    // Audit — status reflects whether session was actually deleted (fire-and-forget)
    await auditService.log({
      userId: session.userId,
      action: AuditAction.LOGOUT,
      status: sessionDeleted ? 'SUCCESS' : 'FAILURE',
      metadata: sessionDeleted ? undefined : { reason: 'session_deletion_failed' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  await clearSessionCookie();

  // redirect throws internally — must be called last
  redirect('/login');
}

export async function requestPasswordResetAction(formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = requestPasswordResetSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'validation_error', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email } = parsed.data;
  const context = await getRequestContext();

  // Rate limit by IP
  const rl = await checkRateLimit(passwordResetRequestRateLimit, context.ipAddress ?? 'unknown');
  if (!rl.success) {
    return { success: false, error: 'rate_limit_exceeded' };
  }

  // Anti-enumeration: always return success regardless of whether user exists
  const user = await findUserByEmail(email);

  if (user) {
    let emailSent = false;
    try {
      const token = await createToken(user.id, 'password_reset');
      await sendPasswordResetEmail(email, token);
      emailSent = true;
    } catch (error) {
      // TODO: Replace with Pino structured logger when available
      console.error('Password reset token/email failed:', {
        userId: user.id,
        errorType: error instanceof Error ? error.constructor.name : 'unknown',
      });
    }

    // Audit (fire-and-forget)
    await auditService.log({
      userId: user.id,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      status: emailSent ? 'SUCCESS' : 'FAILURE',
      metadata: emailSent ? undefined : { reason: 'token_or_email_failed' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  return { success: true };
}

export async function resetPasswordAction(formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = fullResetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'validation_error', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { token, password } = parsed.data;
  const context = await getRequestContext();

  // Rate limit by IP
  const rl = await checkRateLimit(passwordResetCompleteRateLimit, context.ipAddress ?? 'unknown');
  if (!rl.success) {
    return { success: false, error: 'rate_limit_exceeded' };
  }

  const result = await completePasswordReset(token, password, context);
  if (!result.success) {
    // Audit with appropriate action based on error type (fire-and-forget)
    const isTokenError = result.error === 'invalid_token';
    await auditService.log({
      userId: null,
      action: isTokenError ? AuditAction.PASSWORD_RESET_TOKEN_INVALID : AuditAction.PASSWORD_RESET_FAILED,
      status: 'FAILURE',
      metadata: { reason: result.error },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return { success: false, error: 'reset_failed' };
  }

  return { success: true };
}

export async function verifyEmailAction(formData: FormData): Promise<ActionResult<{ alreadyVerified?: boolean }>> {
  const raw = Object.fromEntries(formData);
  const parsed = verifyEmailSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'validation_error', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { token } = parsed.data;
  const context = await getRequestContext();

  // Rate limit by IP
  const rl = await checkRateLimit(verificationCompleteRateLimit, context.ipAddress ?? 'unknown');
  if (!rl.success) {
    return { success: false, error: 'rate_limit_exceeded' };
  }

  const userId = await verifyEmail(token);

  if (!userId) {
    // Token invalid — check if user is already verified (idempotent handling)
    const tokenUserId = await findUserIdFromToken(token, 'email_verification');

    if (tokenUserId) {
      const user = await findUserById(tokenUserId);
      if (user?.emailVerified) {
        return { success: true, data: { alreadyVerified: true } };
      }
    }

    // Audit (fire-and-forget)
    await auditService.log({
      userId: null,
      action: AuditAction.EMAIL_VERIFICATION_FAILED,
      status: 'FAILURE',
      metadata: { reason: 'invalid_or_expired_token' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return { success: false, error: 'invalid_token' };
  }

  // Audit (fire-and-forget)
  await auditService.log({
    userId,
    action: AuditAction.EMAIL_VERIFICATION_SUCCESS,
    status: 'SUCCESS',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return { success: true };
}

export async function resendVerificationAction(formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = resendVerificationSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'validation_error', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email } = parsed.data;
  const context = await getRequestContext();

  // Rate limit by IP
  const rl = await checkRateLimit(verificationResendRateLimit, context.ipAddress ?? 'unknown');
  if (!rl.success) {
    return { success: false, error: 'rate_limit_exceeded' };
  }

  // Anti-enumeration: always return success
  const user = await findUserByEmail(email);

  if (user && !user.emailVerified) {
    let emailSent = false;
    try {
      const token = await createToken(user.id, 'email_verification');
      await sendVerificationEmail(email, token);
      emailSent = true;
    } catch (error) {
      // TODO: Replace with Pino structured logger when available
      console.error('Verification token/email failed:', {
        userId: user.id,
        errorType: error instanceof Error ? error.constructor.name : 'unknown',
      });
    }

    // Audit (fire-and-forget)
    await auditService.log({
      userId: user.id,
      action: AuditAction.EMAIL_VERIFICATION_RESENT,
      status: emailSent ? 'SUCCESS' : 'FAILURE',
      metadata: emailSent ? undefined : { reason: 'token_or_email_failed' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  return { success: true };
}

export async function validateResetTokenAction(token: string): Promise<ActionResult<{ valid: boolean }>> {
  const parsed = validateResetTokenSchema.safeParse({ token });
  if (!parsed.success) {
    return { success: true, data: { valid: false } };
  }

  const context = await getRequestContext();

  // Rate limit by IP
  const rl = await checkRateLimit(passwordResetValidateRateLimit, context.ipAddress ?? 'unknown');
  if (!rl.success) {
    return { success: false, error: 'rate_limit_exceeded' };
  }

  const valid = await isTokenValid(parsed.data.token, 'password_reset');
  return { success: true, data: { valid } };
}

export async function validateInviteCodeAction(formData: FormData): Promise<ActionResult<{ valid: boolean; type?: string }>> {
  const raw = Object.fromEntries(formData);
  const parsed = validateInviteCodeSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'validation_error', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { code } = parsed.data;
  const context = await getRequestContext();

  // Rate limit by IP
  const rl = await checkRateLimit(inviteCodeValidateRateLimit, context.ipAddress ?? 'unknown');
  if (!rl.success) {
    return { success: false, error: 'rate_limit_exceeded' };
  }

  // Only validate codes when registration is in invite mode
  if (config.REGISTRATION_MODE !== 'invite') {
    return { success: true, data: { valid: false } };
  }

  const uppercased = code.trim().toUpperCase();
  const inviteCode = await findByCode(uppercased);
  const invalidReason = inviteCode ? validateCodeRedeemable(inviteCode) : 'not_found';
  const valid = invalidReason === null;

  // Audit (fire-and-forget)
  if (valid && inviteCode) {
    await auditService.log({
      userId: null,
      action: AuditAction.INVITE_CODE_VALIDATED,
      status: 'SUCCESS',
      metadata: { codeId: inviteCode.id },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  } else {
    await auditService.log({
      userId: null,
      action: AuditAction.INVITE_CODE_VALIDATION_FAILED,
      status: 'FAILURE',
      metadata: {
        codeId: inviteCode?.id ?? null,
        reason: invalidReason,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  return { success: true, data: { valid, type: valid ? inviteCode?.type : undefined } };
}