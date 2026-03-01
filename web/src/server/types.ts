import 'server-only';

import type { SubscriptionStatus, OrgRole, NoteType } from '@/lib/types';

// Re-export shared types for convenience in server code
export type { SubscriptionStatus, OrgRole, NoteType };

export type TokenType = 'email_verification' | 'password_reset';

/**
 * Full server-side User type (camelCase).
 * Includes sensitive fields (passwordHash, lockout state) that the client User type omits.
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date;
  createdAt: Date;
  updatedAt: Date;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastFailedLoginAt: Date | null;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  organizationId: string | null;
  isDeleted: boolean;
  deletedAt: Date | null;
}

export interface OrgMembership {
  organizationId: string;
  role: OrgRole;
  isBillable: boolean;
}

export interface MonthlyUsageStats {
  notesGenerated: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// Audit types
export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  REGISTER = 'REGISTER',
  NOTE_GENERATED = 'NOTE_GENERATED',
  SUBSCRIPTION_CREATED = 'SUBSCRIPTION_CREATED',
  SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
  AUTH_FAILED = 'AUTH_FAILED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  CSRF_FAILED = 'CSRF_FAILED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  LOGIN_BLOCKED_LOCKED = 'LOGIN_BLOCKED_LOCKED',
  EMAIL_VERIFICATION_SENT = 'EMAIL_VERIFICATION_SENT',
  EMAIL_VERIFICATION_SUCCESS = 'EMAIL_VERIFICATION_SUCCESS',
  EMAIL_VERIFICATION_FAILED = 'EMAIL_VERIFICATION_FAILED',
  EMAIL_VERIFICATION_RESENT = 'EMAIL_VERIFICATION_RESENT',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  PASSWORD_RESET_FAILED = 'PASSWORD_RESET_FAILED',
  PASSWORD_RESET_TOKEN_INVALID = 'PASSWORD_RESET_TOKEN_INVALID',
  SESSION_DEVICE_CHANGE = 'SESSION_DEVICE_CHANGE',
  SESSION_LIMIT_EXCEEDED = 'SESSION_LIMIT_EXCEEDED',
  WEBHOOK_PROCESSING_FAILED = 'WEBHOOK_PROCESSING_FAILED',
  LEGAL_CONSENT_ACCEPTED = 'LEGAL_CONSENT_ACCEPTED',
  INVITE_CODE_REDEEMED = 'INVITE_CODE_REDEEMED',
  INVITE_CODE_VALIDATED = 'INVITE_CODE_VALIDATED',
  INVITE_CODE_VALIDATION_FAILED = 'INVITE_CODE_VALIDATION_FAILED',
  ORG_CREATED = 'ORG_CREATED',
  ORG_SUBSCRIPTION_CHANGED = 'ORG_SUBSCRIPTION_CHANGED',
  ORG_MEMBER_JOINED = 'ORG_MEMBER_JOINED',
  ORG_MEMBER_REMOVED = 'ORG_MEMBER_REMOVED',
  ORG_MEMBER_LEFT = 'ORG_MEMBER_LEFT',
  ORG_MEMBER_ROLE_CHANGED = 'ORG_MEMBER_ROLE_CHANGED',
  ORG_OWNERSHIP_TRANSFERRED = 'ORG_OWNERSHIP_TRANSFERRED',
  INVITE_CODE_GENERATED = 'INVITE_CODE_GENERATED',
  INVITE_CODE_REVOKED = 'INVITE_CODE_REVOKED',
}

export interface AuditLogEntry {
  userId: string | null;
  action: AuditAction;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  email: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date;
  emailVerified: boolean;
  organizationId: string | null;
}

export interface SessionContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
