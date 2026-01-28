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
}

export interface AuditLogEntry {
  userId: string | null;
  action: AuditAction;
  status: 'SUCCESS' | 'FAILURE';
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
