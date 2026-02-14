/**
 * Web App Type Definitions
 *
 * Shared types for the FlashNote web application.
 */

/**
 * User data returned from authentication
 */
export interface User {
  id: string;
  email: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  emailVerified?: boolean;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
}

/**
 * Stored authentication data in sessionStorage
 */
export interface StoredAuth {
  user: User;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  expiresAt: number;
}

/**
 * Authentication response from API
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  emailVerificationRequired?: boolean;
}

/**
 * Standard API response envelope (success)
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Standard API response envelope (error)
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Union type for API responses
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Usage data returned from GET /usage/me
 */
export interface UsageResponse {
  currentMonth: string;
  notesGenerated: number;
  organization: { name: string; role: string } | null;
}

/**
 * Reasons for session ending - used by SessionAlert component
 */
export type SessionEndReason =
  | 'session_invalidated' // Password reset, token version mismatch
  | 'session_expired' // Refresh token expired naturally
  | 'session_limit' // Too many devices, oldest session kicked
  | 'session_revoked'; // Admin action or security event
