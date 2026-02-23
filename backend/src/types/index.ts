import { Request } from 'express';

// Import Zod-inferred types from LLM schemas for use in this file
import type {
  BillingSummary,
  GoalsTracking,
} from '../services/llm/schemas.js';

// Re-export all billing/goals types from LLM schemas
// This ensures type consistency between LLM structured output and API responses
export type {
  SuggestedCode,
  BillingCharge,
  BillingSummary,
  GoalStatus,
  GoalsTracking,
  PTNoteOutput,
} from '../services/llm/schemas.js';

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
  // Organization membership (PR 1C)
  organizationId: string | null;
  // Soft-delete (H-18)
  isDeleted: boolean;
  deletedAt: Date | null;
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

// Organization types (PR 1C)
// Must stay in sync with CHECK constraint in migration 011
export type OrgRole = 'owner' | 'admin' | 'member';

export interface OrgMembership {
  organizationId: string;
  role: OrgRole;
  isBillable: boolean;
}

export interface OrgMembershipRequest extends AuthenticatedRequest {
  orgMembership: OrgMembership;
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
  // Core SOAP sections
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;

  // Structured billing reference (optional)
  // Not for pasting into EMR billing - for visual reference
  billing?: BillingSummary;

  // Goal tracking (optional)
  goals?: GoalsTracking;

  // Alerts for the therapist (optional)
  // Billing warnings, documentation gaps, modifier reminders
  alerts?: string[];

  // Metadata
  metadata: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number; // inputTokens + outputTokens
    generationTimeMs: number;
  };

  // Security metadata for audit purposes (MEDIUM-005)
  // Optional for backwards compatibility with mock service
  securityMetadata?: PromptSecurityMetadata;
}

// Usage types
export interface MonthlyUsageStats {
  notesGenerated: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
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
  // Legal consent
  LEGAL_CONSENT_ACCEPTED = 'LEGAL_CONSENT_ACCEPTED',
  // Invite codes (PR 1B)
  INVITE_CODE_REDEEMED = 'INVITE_CODE_REDEEMED',
  INVITE_CODE_VALIDATED = 'INVITE_CODE_VALIDATED',
  INVITE_CODE_VALIDATION_FAILED = 'INVITE_CODE_VALIDATION_FAILED',
  // Organization lifecycle (PR 1C)
  ORG_CREATED = 'ORG_CREATED',
  ORG_SUBSCRIPTION_CHANGED = 'ORG_SUBSCRIPTION_CHANGED',
  // Membership changes (PR 1C)
  ORG_MEMBER_JOINED = 'ORG_MEMBER_JOINED',
  ORG_MEMBER_REMOVED = 'ORG_MEMBER_REMOVED',
  ORG_MEMBER_LEFT = 'ORG_MEMBER_LEFT',
  ORG_MEMBER_ROLE_CHANGED = 'ORG_MEMBER_ROLE_CHANGED',
  ORG_OWNERSHIP_TRANSFERRED = 'ORG_OWNERSHIP_TRANSFERRED',
  // Invite lifecycle (used in Wave 2+)
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
