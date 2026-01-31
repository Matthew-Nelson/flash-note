import { Request } from 'express';

// User types
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
  // Lockout fields (HIGH-005)
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastFailedLoginAt: Date | null;
  // Email verification fields (HIGH-007)
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  // Token versioning for immediate session invalidation
  tokenVersion: number;
}

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'unpaid';

// Auth types
export interface TokenPayload {
  userId: string;
  email: string;
  tokenVersion: number;
}

export interface AuthenticatedRequest extends Request {
  user: TokenPayload;
}

// Note types
export type NoteType =
  | 'daily_note'
  | 'initial_eval'
  | 'progress_note'
  | 'discharge';

export interface GenerateNoteInput {
  noteType: NoteType;
  patientContext?: string;
  quickNotes: string;
}

// Prompt security metadata for audit logging (MEDIUM-005)
export interface PromptSecurityMetadata {
  suspiciousPatternDetected: boolean;
  suspiciousPatternCount: number;
}

export interface GeneratedNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  metadata: {
    model: string;
    tokensUsed: number;
    generationTimeMs: number;
  };
  // Security metadata for audit purposes (MEDIUM-005)
  // Optional for backwards compatibility with mock service
  securityMetadata?: PromptSecurityMetadata;
}

// AI types
export interface AIGenerationResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  generationTimeMs: number;
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
  // Email verification (HIGH-007)
  EMAIL_VERIFICATION_SENT = 'EMAIL_VERIFICATION_SENT',
  EMAIL_VERIFICATION_SUCCESS = 'EMAIL_VERIFICATION_SUCCESS',
  EMAIL_VERIFICATION_FAILED = 'EMAIL_VERIFICATION_FAILED',
  EMAIL_VERIFICATION_RESENT = 'EMAIL_VERIFICATION_RESENT',
  // Password reset (HIGH-001)
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  PASSWORD_RESET_FAILED = 'PASSWORD_RESET_FAILED',
  PASSWORD_RESET_TOKEN_INVALID = 'PASSWORD_RESET_TOKEN_INVALID',
  // Session management (HIGH-006, MEDIUM-011)
  SESSION_DEVICE_CHANGE = 'SESSION_DEVICE_CHANGE',
  SESSION_LIMIT_EXCEEDED = 'SESSION_LIMIT_EXCEEDED',
  // Webhook processing (MEDIUM-013)
  WEBHOOK_PROCESSING_FAILED = 'WEBHOOK_PROCESSING_FAILED',
}

export interface AuditLogEntry {
  userId: string | null;
  action: AuditAction;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// API response types
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
