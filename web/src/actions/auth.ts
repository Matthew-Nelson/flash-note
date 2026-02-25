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
  inviteCodeValidateRateLimit,
} from '@/server/lib/rate-limit';
import { config } from '@/server/db/config';
import { login, register, completePasswordReset } from '@/server/services/auth';
import type { SanitizedUser } from '@/server/services/auth';
import { validateAndConsumeToken, isTokenValid, findUserIdFromToken, createToken } from '@/server/services/token';
import { sendVerificationEmail, sendPasswordResetEmail } from '@/server/services/email';
import { findUserByEmail, findUserById, markEmailVerified } from '@/server/dal/users';
import { deleteSession } from '@/server/dal/sessions';
import { findByCode, validateCodeRedeemable } from '@/server/dal/invite-codes';
import { auditService } from '@/server/services/audit';
import { AuditAction } from '@/server/types';

// --- Result type ---

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// --- Actions ---

export async function loginAction(formData: FormData): Promise<ActionResult<{ user: SanitizedUser }>> {
  const raw = Object.fromEntries(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'validation_error', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;
  const context = await getRequestContext();

  // Rate limit by IP:email
  const rl = await checkRateLimit(loginRateLimit, rateLimitKey(context.ipAddress ?? 'unknown', email));
  if (!rl.success) {
    return { success: false, error: 'rate_limit_exceeded' };
  }

  const result = await login(email, password, context);

  if (!result.success) {
    // Audit failed login (fire-and-forget)
    try {
      await auditService.log({
        userId: null,
        action: AuditAction.LOGIN_FAILED,
        status: 'FAILURE',
        metadata: { emailProvided: true },  // H-4: never log the email
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    } catch {
      // Non-critical audit failure
    }
    return { success: false, error: result.error };
  }

  // Audit successful login
  try {
    await auditService.log({
      userId: result.user.id,
      action: AuditAction.LOGIN,
      status: 'SUCCESS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  } catch {
    // Non-critical audit failure
  }

  await setSessionCookie(result.token);

  return { success: true, data: { user: result.user } };
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
    return { success: false, error: result.error };
  }

  await setSessionCookie(result.token);

  return { success: true, data: { user: result.user } };
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  const context = await getRequestContext();

  if (session) {
    // Delete current session only (not all sessions)
    await deleteSession(session.sessionId);

    // Audit
    try {
      await auditService.log({
        userId: session.userId,
        action: AuditAction.LOGOUT,
        status: 'SUCCESS',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    } catch {
      // Non-critical audit failure
    }
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
    try {
      const token = await createToken(user.id, 'password_reset');
      await sendPasswordResetEmail(email, token);
    } catch {
      // Non-critical — user can retry
    }

    try {
      await auditService.log({
        userId: user.id,
        action: AuditAction.PASSWORD_RESET_REQUESTED,
        status: 'SUCCESS',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    } catch {
      // Non-critical audit failure
    }
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

  // Validate and consume token
  const userId = await validateAndConsumeToken(token, 'password_reset');
  if (!userId) {
    try {
      await auditService.log({
        userId: null,
        action: AuditAction.PASSWORD_RESET_TOKEN_INVALID,
        status: 'FAILURE',
        metadata: { reason: 'invalid_or_expired_token' },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    } catch {
      // Non-critical audit failure
    }
    return { success: false, error: 'invalid_token' };
  }

  const result = await completePasswordReset(userId, password, context);
  if (!result.success) {
    return { success: false, error: result.error };
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

  const userId = await validateAndConsumeToken(token, 'email_verification');

  if (!userId) {
    // Token invalid — check if user is already verified (idempotent handling)
    const tokenUserId = await findUserIdFromToken(token, 'email_verification');

    if (tokenUserId) {
      const user = await findUserById(tokenUserId);
      if (user?.emailVerified) {
        return { success: true, data: { alreadyVerified: true } };
      }
    }

    try {
      await auditService.log({
        userId: null,
        action: AuditAction.EMAIL_VERIFICATION_FAILED,
        status: 'FAILURE',
        metadata: { reason: 'invalid_or_expired_token' },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    } catch {
      // Non-critical audit failure
    }

    return { success: false, error: 'invalid_token' };
  }

  await markEmailVerified(userId);

  try {
    await auditService.log({
      userId,
      action: AuditAction.EMAIL_VERIFICATION_SUCCESS,
      status: 'SUCCESS',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  } catch {
    // Non-critical audit failure
  }

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
    try {
      const token = await createToken(user.id, 'email_verification');
      await sendVerificationEmail(email, token);
    } catch {
      // Non-critical — user can retry
    }

    try {
      await auditService.log({
        userId: user.id,
        action: AuditAction.EMAIL_VERIFICATION_RESENT,
        status: 'SUCCESS',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    } catch {
      // Non-critical audit failure
    }
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
  const rl = await checkRateLimit(passwordResetCompleteRateLimit, context.ipAddress ?? 'unknown');
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

  if (valid && inviteCode) {
    try {
      await auditService.log({
        userId: null,
        action: AuditAction.INVITE_CODE_VALIDATED,
        status: 'SUCCESS',
        metadata: { codeId: inviteCode.id },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    } catch {
      // Non-critical
    }
  } else {
    try {
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
    } catch {
      // Non-critical
    }
  }

  return { success: true, data: { valid, type: valid ? inviteCode?.type : undefined } };
}