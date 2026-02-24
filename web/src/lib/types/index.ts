/**
 * Shared type definitions used by both client and server code.
 *
 * Re-exports client types for backwards compatibility with @/lib/types imports.
 * Server-only types (with passwordHash, lockout fields, etc.) live in server/types.ts.
 */

// Shared types used by both client and server
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'unpaid';

export type OrgRole = 'owner' | 'admin' | 'member';

export type NoteType =
  | 'daily_note'
  | 'initial_eval'
  | 'progress_note'
  | 'discharge';

// Client-side types (re-exported for @/lib/types compatibility)
export type {
  User,
  StoredAuth,
  AuthResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  UsageResponse,
  SessionEndReason,
} from './client';
